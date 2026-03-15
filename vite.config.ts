import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const stubsDir = path.resolve(__dirname, 'src/tests/stubs')

// Tauri plugins that are resolved natively at runtime but are not npm packages.
// Aliased to no-op stubs for dev server and Vitest so Vite's import analysis
// doesn't fail. In a real Tauri build these would be replaced by the installed
// npm packages (@tauri-apps/plugin-*) declared in Cargo.toml.
const tauriPluginAliases = {
  '@tauri-apps/plugin-global-shortcut': path.join(stubsDir, 'tauri-plugin-global-shortcut.ts'),
  '@tauri-apps/plugin-fs': path.join(stubsDir, 'tauri-plugin-fs.ts'),
  '@tauri-apps/plugin-notification': path.join(stubsDir, 'tauri-plugin-notification.ts'),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: tauriPluginAliases,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    alias: tauriPluginAliases,
  },
} as any)
