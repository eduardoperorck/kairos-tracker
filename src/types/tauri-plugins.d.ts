// Type declarations for Tauri plugins that are resolved natively at runtime
// and are not present in node_modules. These allow TypeScript to type-check
// dynamic imports (/* @vite-ignore */) without errors.

declare module '@tauri-apps/plugin-notification' {
  export function sendNotification(options: { title: string; body: string }): Promise<void>
  export function isPermissionGranted(): Promise<boolean>
  export function requestPermission(): Promise<'granted' | 'denied' | 'default'>
}

declare module '@tauri-apps/plugin-global-shortcut' {
  export function register(shortcut: string, handler: () => void): Promise<void>
  export function unregister(shortcut: string): Promise<void>
  export function unregisterAll(): Promise<void>
}

declare module '@tauri-apps/plugin-fs' {
  export function writeTextFile(path: string, content: string): Promise<void>
  export function readTextFile(path: string): Promise<string>
  export function exists(path: string): Promise<boolean>
}
