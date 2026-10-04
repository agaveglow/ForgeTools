package app.forgetools.mobile;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Lets the person pick one folder on the phone (Android's own folder picker) and keeps permission to it.
 * The app writes and reads plain text files there. It only ever touches the files it is asked about,
 * and only inside the chosen folder. The app only sends already-encrypted data here.
 */
@CapacitorPlugin(name = "FolderSync")
public class FolderSyncPlugin extends Plugin {
    private static final String PREFS = "folder_sync";
    private static final String KEY = "tree";
    private static final long MAX_BYTES = 40L * 1024 * 1024;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private Uri savedTree() {
        String s = prefs().getString(KEY, null);
        if (s == null) return null;
        Uri tree = Uri.parse(s);
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(tree) && p.isReadPermission() && p.isWritePermission()) return tree;
        }
        return null;
    }

    private static String niceName(Uri tree) {
        String id = DocumentsContract.getTreeDocumentId(tree);
        int slash = id.lastIndexOf('/');
        int colon = id.lastIndexOf(':');
        String n = id.substring(Math.max(slash, colon) + 1);
        return n.isEmpty() ? "Storage" : n;
    }

    private static boolean safeName(String name) {
        return name != null && name.matches("[A-Za-z0-9._-]{1,80}") && !name.contains("..");
    }

    private Uri findChild(Uri tree, String name) {
        String parentId = DocumentsContract.getTreeDocumentId(tree);
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        ContentResolver r = getContext().getContentResolver();
        try (Cursor c = r.query(children, new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            while (c != null && c.moveToNext()) {
                if (name.equals(c.getString(1))) return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
            }
        }
        return null;
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            prefs().edit().putString(KEY, uri.toString()).apply();
            JSObject o = new JSObject();
            o.put("name", niceName(uri));
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not keep access to that folder.");
        }
    }

    @PluginMethod
    public void folderName(PluginCall call) {
        Uri tree = savedTree();
        JSObject o = new JSObject();
        o.put("name", tree == null ? null : niceName(tree));
        call.resolve(o);
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        Uri tree = savedTree();
        if (tree == null) { call.reject("no-folder"); return; }
        if (!safeName(name) || data == null) { call.reject("bad-request"); return; }
        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) { call.reject("too-big"); return; }
        try {
            ContentResolver r = getContext().getContentResolver();
            Uri doc = findChild(tree, name);
            if (doc == null) {
                Uri dir = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
                doc = DocumentsContract.createDocument(r, dir, "application/json", name);
            }
            if (doc == null) { call.reject("Could not create the file in that folder."); return; }
            try (OutputStream os = r.openOutputStream(doc, "wt")) {
                if (os == null) { call.reject("Could not open the file for writing."); return; }
                os.write(bytes);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not write to that folder.");
        }
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String name = call.getString("name");
        Uri tree = savedTree();
        if (tree == null) { call.reject("no-folder"); return; }
        if (!safeName(name)) { call.reject("bad-request"); return; }
        try {
            Uri doc = findChild(tree, name);
            JSObject o = new JSObject();
            if (doc == null) { o.put("data", null); call.resolve(o); return; }
            try (InputStream in = getContext().getContentResolver().openInputStream(doc)) {
                if (in == null) { o.put("data", null); call.resolve(o); return; }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                long total = 0;
                int n;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > MAX_BYTES) { call.reject("too-big"); return; }
                    out.write(buf, 0, n);
                }
                o.put("data", new String(out.toByteArray(), StandardCharsets.UTF_8));
                call.resolve(o);
            }
        } catch (Exception e) {
            call.reject("Could not read from that folder.");
        }
    }

    @PluginMethod
    public void forget(PluginCall call) {
        String s = prefs().getString(KEY, null);
        if (s != null) {
            try {
                getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(s), Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception ignored) { }
        }
        prefs().edit().remove(KEY).apply();
        call.resolve();
    }
}
