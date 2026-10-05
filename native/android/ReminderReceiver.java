package app.forgetools.mobile;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Fires when a reminder's alarm goes off: shows a plain notification and, for a repeating reminder,
 * re-arms the next one. Nothing here reads or writes app data or talks to the network.
 */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String id = intent.getStringExtra("id");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        int repeatMinutes = intent.getIntExtra("repeatMinutes", 0);
        if (id == null) return;
        show(ctx, id, title == null ? "Reminder" : title, body == null ? "" : body);
        if (repeatMinutes > 0) {
            long next = System.currentTimeMillis() + repeatMinutes * 60_000L;
            RemindersPlugin.scheduleAt(ctx, id, title, body, next, repeatMinutes);
        }
    }

    private void show(Context ctx, String id, String title, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(ctx, RemindersPlugin.CHANNEL_ID)
            : new Notification.Builder(ctx);
        int iconRes = ctx.getResources().getIdentifier("ic_launcher", "mipmap", ctx.getPackageName());
        b.setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(iconRes != 0 ? iconRes : android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            // Hides the title and note on a locked screen (shows a generic placeholder instead), since this
            // is work-related and may be seen by someone else glancing at the phone.
            .setVisibility(Notification.VISIBILITY_PRIVATE);
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) {
            PendingIntent pi = PendingIntent.getActivity(ctx, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setContentIntent(pi);
        }
        nm.notify(id.hashCode(), b.build());
    }
}
