package app.forgetools.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
