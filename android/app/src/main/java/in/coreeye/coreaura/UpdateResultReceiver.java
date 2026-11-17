package in.coreeye.coreaura;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import java.lang.ref.WeakReference;

/** Explicit, non-exported receiver for the OS installation result. */
public class UpdateResultReceiver extends BroadcastReceiver {
    static WeakReference<AppDistributionPlugin> listener=new WeakReference<>(null);
    @Override public void onReceive(Context context,Intent event) {
        if(!UpdateSession.ACTION.equals(event.getAction())) return;
        SharedPreferences preferences=UpdateSession.preferences(context);
        int id=event.getIntExtra(PackageInstaller.EXTRA_SESSION_ID,-1);
        if(id<0 || id!=preferences.getInt("session",-1)) return;
        int status=event.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
        Intent confirmation=event.getParcelableExtra(Intent.EXTRA_INTENT);
        String phase=status==PackageInstaller.STATUS_SUCCESS?"installed":status==PackageInstaller.STATUS_PENDING_USER_ACTION?"confirming":status==PackageInstaller.STATUS_FAILURE_ABORTED?"closed":"error";
        SharedPreferences.Editor saved=preferences.edit().putString("phase",phase);
        if(status!=PackageInstaller.STATUS_PENDING_USER_ACTION) saved.putInt("session",-1);
        saved.commit();
        AppDistributionPlugin plugin=listener.get();
        if(plugin!=null) plugin.installationResult(status,confirmation);
        else if(status==PackageInstaller.STATUS_PENDING_USER_ACTION && confirmation!=null) {
            try {confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(confirmation);}
            catch(Exception error) {preferences.edit().putString("phase","confirmation-required").apply();}
        }
    }
}
