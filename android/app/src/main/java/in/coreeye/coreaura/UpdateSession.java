package in.coreeye.coreaura;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.*;

/** Modern self-update sessions; Android decides whether confirmation is needed. */
public final class UpdateSession {
    static final String PREFS="core-aura-update-session", ACTION="in.coreeye.coreaura.UPDATE_RESULT";
    private UpdateSession() {}
    static SharedPreferences preferences(Context context) {return context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    public static void commit(Context context,File apk,UpdatePolicy.Spec spec,VerifiedUpdate.Cancelled cancelled) throws Exception {
        PackageInstaller installer=context.getPackageManager().getPackageInstaller();
        SharedPreferences preferences=preferences(context);
        int old=preferences.getInt("session",-1);
        if(old!=-1) {
            preferences.edit().putInt("session",-1).commit();
            try { if(installer.getSessionInfo(old)!=null) installer.abandonSession(old); }
            catch(Exception error) {preferences.edit().putInt("session",old).commit();throw new IOException("Android is already handling an update. Wait, then reopen Core-aura.");}
        }
        VerifiedUpdate.check(cancelled);
        PackageInstaller.SessionParams params=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(UpdatePolicy.APP_ID);params.setSize(spec.size);
        if(Build.VERSION.SDK_INT>=31) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            params.setInstallReason(PackageManager.INSTALL_REASON_USER);
        }
        if(Build.VERSION.SDK_INT>=33) params.setPackageSource(PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE);
        int id=installer.createSession(params);
        preferences.edit().putInt("session",id).putString("phase","installing").commit();
        try(PackageInstaller.Session session=installer.openSession(id)) {
            try(InputStream input=new FileInputStream(apk);OutputStream output=session.openWrite("base.apk",0,spec.size)) {
                byte[] bytes=new byte[65536];int count;
                while((count=input.read(bytes))!=-1) {VerifiedUpdate.check(cancelled);output.write(bytes,0,count);}
                session.fsync(output);
            }
            VerifiedUpdate.check(cancelled);
            Intent status=new Intent(context,UpdateResultReceiver.class).setAction(ACTION);
            PendingIntent callback=PendingIntent.getBroadcast(context,id,status,PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0));
            session.commit(callback.getIntentSender());
        } catch(Exception error) {
            preferences.edit().putInt("session",-1).putString("phase","error").commit();
            try {installer.abandonSession(id);}catch(Exception ignored){}
            throw error;
        }
    }
}
