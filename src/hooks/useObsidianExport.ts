import { useEffect, useRef } from 'react'
import type { Session, Category } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'
import type { Storage } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import { exportDayAsMarkdown } from '../domain/history'
import { toLocalDateString } from '../domain/format'

function isValidAbsolutePath(p: string): boolean {
  if (p.includes('..')) return false
  if (/^[A-Za-z]:[/\\]/.test(p)) return true
  if (p.startsWith('/')) return true
  return false
}

/**
 * After the evening review is saved (or on first open of the next day),
 * write a daily note to the configured Obsidian vault path.
 * File: <vault>/<YYYY-MM-DD>.md
 */
export function useObsidianExport(
  storage: Storage,
  date: string,
  sessions: Session[],
  categories: Category[],
  intentions: Intention[],
  review: EveningReview | null,
) {
  const lastWrittenRef = useRef<string | null>(null)

  useEffect(() => {
    const key = `${date}-${review?.mood ?? 'none'}`
    if (lastWrittenRef.current === key) return
    lastWrittenRef.current = key

    void (async () => {
      const vaultPath = await storage.getSetting(SettingKey.ObsidianVaultPath)
      if (!vaultPath || !isValidAbsolutePath(vaultPath)) return

      const fileName = `${date}.md`
      const sep = vaultPath.includes('\\') ? '\\' : '/'
      const fullPath = `${vaultPath}${sep}${fileName}`

      const intentionItems = intentions.map(i => ({ text: i.text, done: false }))
      const markdown = exportDayAsMarkdown(date, sessions, categories, intentionItems, review)

      try {
        const { writeTextFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
        await writeTextFile(fullPath, markdown)
      } catch {
        // Tauri FS not available (browser/test) — skip silently
      }
    })()
  }, [date, review, sessions.length])

  // Also write on the first open of each new day
  useEffect(() => {
    const today = toLocalDateString(Date.now())
    if (today === date) return // same day
    // Write yesterday's note when a new day starts
    void (async () => {
      const vaultPath = await storage.getSetting(SettingKey.ObsidianVaultPath)
      if (!vaultPath || !isValidAbsolutePath(vaultPath)) return
      const fileName = `${date}.md`
      const sep = vaultPath.includes('\\') ? '\\' : '/'
      const fullPath = `${vaultPath}${sep}${fileName}`
      const intentionItems = intentions.map(i => ({ text: i.text, done: false }))
      const markdown = exportDayAsMarkdown(date, sessions, categories, intentionItems, review)
      try {
        const { writeTextFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
        await writeTextFile(fullPath, markdown)
      } catch {/* skip */}
    })()
  }, [])
}
