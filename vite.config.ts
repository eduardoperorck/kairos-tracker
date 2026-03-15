import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const stubsDir = path.resolve(__dirname, 'src/tests/stubs')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    alias: {
      '@tauri-apps/plugin-global-shortcut': path.join(stubsDir, 'tauri-plugin-global-shortcut.ts'),
      '@tauri-apps/plugin-fs': path.join(stubsDir, 'tauri-plugin-fs.ts'),
      '@tauri-apps/plugin-notification': path.join(stubsDir, 'tauri-plugin-notification.ts'),
    },
  },
} as any)
