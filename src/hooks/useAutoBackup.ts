import { useEffect, useRef } from 'react'
import { exportSessionsToJSON } from '../domain/history'
import type { Storage } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import type { Session, Category } from '../domain/timer'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function isValidAbsolutePath(p: string): boolean {
  if (p.includes('..')) return false
  // Windows absolute: C:\... or C:/... or UNC \\server
  if (/^[A-Za-z]:[/\\]/.test(p)) return true
  // Unix absolute
  if (p.startsWith('/')) return true
  return false
}

export function useAutoBackup(
  storage: Storage,
  sessions: Session[],
  categories: Category[],
) {
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current || sessions.length === 0) return
    hasRunRef.current = true

    void (async () => {
      const syncPath = await storage.getSetting(SettingKey.SyncPath)
      if (!syncPath || !isValidAbsolutePath(syncPath)) return

      const date = todayDateString()
      const fileName = `timetracker-${date}.json`
      const fullPath = `${syncPath}/${fileName}`

      try {
        const { exists, writeTextFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
        if (await exists(fullPath)) return  // today's backup already written

        const json = exportSessionsToJSON(sessions, categories)
        await writeTextFile(fullPath, json)
      } catch {
        // Tauri FS not available (browser/test) — skip silently
      }
    })()
  }, [sessions, categories, storage])
}
