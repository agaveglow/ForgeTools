// Capacitor wraps the built web app (dist/) as a native Android/iOS app.
// Not built or tested in the environment that wrote this file: see README, "Phone app".
const config = {
  appId: 'app.forgetools.mobile',
  appName: 'ForgeTools',
  webDir: 'dist',
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false, captureInput: false },
  plugins: {
    // Native fetch avoids browser CORS limits for the web lookup feature.
    CapacitorHttp: { enabled: true },
  },
};
export default config;
