package in.coreeye.coreaura;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppDistribution")
public class AppDistributionPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean(false), cancelled=new AtomicBoolean(false);
    private volatile HttpURLConnection connection;
    private volatile String phase="idle";
    private volatile long received=0,total=0;
    private UpdatePolicy.Spec pending;
    private File verified;
    private int signatureFlags() { return Build.VERSION.SDK_INT>=28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
    private PackageInfo installed() throws Exception { return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),signatureFlags()); }
    private long code(PackageInfo info) { return Build.VERSION.SDK_INT>=28 ? info.getLongVersionCode() : info.versionCode; }
    private String certificate(PackageInfo info) throws Exception {
        Signature[] signatures=Build.VERSION.SDK_INT>=28 ? (info.signingInfo==null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        if (signatures==null || signatures.length!=1) throw new Exception("Expected one app signing identity.");
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
        StringBuilder fingerprint=new StringBuilder();
        for (byte value:digest) fingerprint.append(String.format(Locale.ROOT,"%02x",value & 255));
        return fingerprint.toString();
    }
    private JSObject status() {
        JSObject result=new JSObject();
        result.put("phase",phase);result.put("busy",busy.get());result.put("received",received);result.put("total",total);
        return result;
    }
    private void report(String value,long count,long size) {
        phase=value;received=count;total=size;notifyListeners("updateProgress",status(),true);
    }
    private void finish(PluginCall call,String result) {
        busy.set(false);report(result,received,total);
        JSObject value=new JSObject();value.put("status",result);call.resolve(value);
    }
    private void fail(PluginCall call,Exception error) {
        String message=cancelled.get() ? "Update cancelled." : error.getMessage();
        if (message==null || message.length()>300) message="The update could not complete. Retry after checking your connection and free storage.";
        busy.set(false);report(cancelled.get()?"cancelled":"error",received,total);
        call.reject(message,cancelled.get()?"CANCELLED":"UPDATE_FAILED",error);
    }
    @PluginMethod public void info(PluginCall call) {
        try {
            PackageInfo info=installed();JSObject result=new JSObject();
            result.put("applicationId",info.packageName);result.put("versionName",info.versionName);result.put("versionCode",code(info));
            result.put("sdk",Build.VERSION.SDK_INT);result.put("certificateSha256",certificate(info));
            result.put("debug",(info.applicationInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE)!=0);call.resolve(result);
        } catch (Exception error) { call.reject("Could not read the installed Android app identity.",error); }
    }
    @PluginMethod public void updateStatus(PluginCall call) { call.resolve(status()); }
    @PluginMethod public void cancelUpdate(PluginCall call) {
        if (!"installing".equals(phase)) {
            cancelled.set(true);HttpURLConnection active=connection;if (active!=null) active.disconnect();
        }
        call.resolve();
    }
    @PluginMethod public void installUpdate(PluginCall call) {
        if (!busy.compareAndSet(false,true)) { call.reject("An update is already in progress.");return; }
        cancelled.set(false);received=0;total=0;
        try {
            JSObject r=call.getObject("release");if(r==null) throw new Exception("Missing update information.");
            pending=new UpdatePolicy.Spec(r.getString("applicationId"),r.getString("versionName"),r.getLong("versionCode"),r.getInt("minSdk"),r.getString("url"),r.getString("sha256"),r.getString("certificateSha256"),r.getLong("size"));
            PackageInfo current=installed();
            UpdatePolicy.identity(pending,current.packageName,certificate(current),code(current),Build.VERSION.SDK_INT,UpdatePolicy.APP_ID,pending.certificate,pending.versionCode,pending.versionName);
        } catch(Exception error) { fail(call,error);return; }
        worker.execute(()->{
            try {
                UpdatePolicy.Spec spec=pending;
                report("downloading",0,spec.size);
                verified=VerifiedUpdate.download(spec,new File(getContext().getCacheDir(),"core-aura-updates"),cancelled::get,(count,size)->report("downloading",count,size),url->{
                    HttpURLConnection active=(HttpURLConnection)url.openConnection();connection=active;return active;
                });
                connection=null;report("verifying",spec.size,spec.size);verifyArchive();VerifiedUpdate.check(cancelled::get);
                getActivity().runOnUiThread(()->{
                    try {
                        VerifiedUpdate.check(cancelled::get);
                        if (Build.VERSION.SDK_INT>=26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            report("permission",spec.size,spec.size);
                            Intent intent=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName()));
                            startActivityForResult(call,intent,"updatePermissionResult");
                        } else launchInstaller(call);
                    } catch(Exception error) { fail(call,error); }
                });
            } catch(Exception error) { connection=null;fail(call,error); }
        });
    }
    private void verifyArchive() throws Exception {
        if (verified==null || pending==null || !verified.isFile() || verified.length()!=pending.size || !pending.sha256.equals(VerifiedUpdate.digest(verified))) throw new Exception("The update file is missing or failed verification. Retry the update.");
        PackageInfo archive=getContext().getPackageManager().getPackageArchiveInfo(verified.getAbsolutePath(),signatureFlags());
        if (archive==null) throw new Exception("The downloaded file is not a supported Android APK.");
        PackageInfo current=installed();
        UpdatePolicy.identity(pending,current.packageName,certificate(current),code(current),Build.VERSION.SDK_INT,archive.packageName,certificate(archive),code(archive),archive.versionName);
    }
    private void launchInstaller(PluginCall call) throws Exception {
        VerifiedUpdate.check(cancelled::get);
        Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",verified);
        Intent intent=new Intent(Intent.ACTION_VIEW);intent.setDataAndType(uri,"application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri("Core-aura update",uri));
        report("installing",pending.size,pending.size);startActivityForResult(call,intent,"updateInstallerResult");
    }
    @ActivityCallback private void updatePermissionResult(PluginCall call,ActivityResult result) {
        if (call==null) { busy.set(false);report("idle",0,0);return; }
        if (cancelled.get()) { fail(call,new Exception("Update cancelled."));return; }
        if (Build.VERSION.SDK_INT>=26 && !getContext().getPackageManager().canRequestPackageInstalls()) { finish(call,"permission-required");return; }
        worker.execute(()->{
            try { verifyArchive();getActivity().runOnUiThread(()->{try { launchInstaller(call); } catch(Exception error) { fail(call,error); }}); }
            catch(Exception error) { fail(call,error); }
        });
    }
    @ActivityCallback private void updateInstallerResult(PluginCall call,ActivityResult result) {
        if(call==null) { busy.set(false);report("closed",received,total);return; }
        try { finish(call,pending!=null && code(installed())>=pending.versionCode ? "installed":"closed"); }
        catch(Exception error) { fail(call,error); }
    }
    @Override protected void handleOnDestroy() {
        cancelled.set(true);HttpURLConnection active=connection;if(active!=null)active.disconnect();worker.shutdownNow();
    }
    // Retained only for the one-time debug-key migration help page.
    @PluginMethod public void openDownload(PluginCall call) {
        String value=call.getString("url");
        if (!DownloadPolicy.allowed(value)) { call.reject("Only the official Core-aura download address is allowed.");return; }
        getActivity().runOnUiThread(()->{
            try { Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(value));intent.addCategory(Intent.CATEGORY_BROWSABLE);getActivity().startActivity(intent);call.resolve(); }
            catch(Exception error) { call.reject("No application could open the download page.",error); }
        });
    }
}
