package app.forgetools.mobile;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

/**
 * Local-only reminders: schedules a plain Android notification for a time the person chose, and nothing else.
 * No text ever leaves the device; this plugin only talks to Android's own AlarmManager and NotificationManager.
 * Repeats are re-armed by ReminderReceiver each time one fires, so they keep working through Doze.
 */
@CapacitorPlugin(name = "Reminders", permissions = { @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" }) })
public class RemindersPlugin extends Plugin {
    static final String CHANNEL_ID = "forgetools_reminders";

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Reminders you set in ForgeTools. Nothing is sent off this device.");
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(ch);
        }
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return getPermissionState("notifications") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void permissionStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", notificationsAllowed());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (notificationsAllowed()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", notificationsAllowed());
        call.resolve(ret);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        String id = call.getString("id");
        Long at = call.getLong("at");
        if (id == null || at == null) {
            call.reject("id and at are required");
            return;
        }
        String title = call.getString("title", "Reminder");
        String body = call.getString("body", "");
        Integer repeatMinutes = call.getInt("repeatMinutes", 0);
        scheduleAt(getContext(), id, title, body, at, repeatMinutes == null ? 0 : repeatMinutes);
        call.resolve();
    }

    static void scheduleAt(Context ctx, String id, String title, String body, long at, int repeatMinutes) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = pendingIntent(ctx, id, title, body, repeatMinutes);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private static PendingIntent pendingIntent(Context ctx, String id, String title, String body, int repeatMinutes) {
        Intent intent = new Intent(ctx, ReminderReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("repeatMinutes", repeatMinutes);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, id.hashCode(), intent, flags);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        cancelId(getContext(), id);
        call.resolve();
    }

    static void cancelId(Context ctx, String id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pendingIntent(ctx, id, "", "", 0));
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(id.hashCode());
    }
}
