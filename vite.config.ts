import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the built app also works when loaded from a file:// or
// Capacitor webview origin. Routing is hash-based, so no server rewrites needed.
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
});
