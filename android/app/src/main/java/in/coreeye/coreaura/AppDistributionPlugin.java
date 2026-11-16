package in.coreeye.coreaura;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AppDistribution")
public class AppDistributionPlugin extends Plugin {
    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageManager manager = getContext().getPackageManager();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo info = manager.getPackageInfo(getContext().getPackageName(), flags);
            Signature[] signatures = Build.VERSION.SDK_INT >= 28 ? info.signingInfo.getApkContentsSigners() : info.signatures;
            if (signatures == null || signatures.length != 1) throw new Exception("Expected one app signing identity");
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
            StringBuilder fingerprint = new StringBuilder();
            for (byte value : digest) fingerprint.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            JSObject result = new JSObject();
            result.put("applicationId", info.packageName);
            result.put("versionName", info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
            result.put("sdk", Build.VERSION.SDK_INT);
            result.put("certificateSha256", fingerprint.toString());
            result.put("debug", (info.applicationInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
            call.resolve(result);
        } catch (Exception error) { call.reject("Could not read the installed Android app identity.", error); }
    }

    @PluginMethod
    public void openDownload(PluginCall call) {
        String value = call.getString("url");
        if (value == null) { call.reject("Missing APK download address."); return; }
        Uri uri = Uri.parse(value);
        if (!DownloadPolicy.allowed(value)) { call.reject("Only the official Core-aura Android download address is allowed."); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception error) { call.reject("No application could open the Android download.", error); }
        });
    }
}
