import { useState, useRef, useEffect } from 'react'
import { exportSessionsToJSON } from '../domain/history'
import type { Category, Session } from '../domain/timer'
import type { Storage } from '../persistence/storage'

type Props = {
  categories: Category[]
  sessions: Session[]
  storage: Storage
  webhookUrl: string
  onWebhookUrlChange: (url: string) => void
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── SyncSection ──────────────────────────────────────────────────────────────

function SyncSection({ storage, sessions, categories }: { storage: Storage; sessions: Session[]; categories: Category[] }) {
  const [syncPath, setSyncPath] = useState('')
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  useEffect(() => {
    storage.getSetting('sync_path').then(p => setSyncPath(p ?? ''))
  }, [])

  async function handleSaveSyncPath() {
    await storage.setSetting('sync_path', syncPath)
    setSyncStatus('Sync path saved.')
  }

  async function handleManualSync() {
    const path = await storage.getSetting('sync_path')
    if (!path) { setSyncStatus('No sync path configured.'); return }
    const json = exportSessionsToJSON(sessions, categories)
    try {
      const { writeTextFile } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
      await writeTextFile(`${path}/timetracker-sync.json`, json)
      setSyncStatus(`Synced ${sessions.length} sessions to ${path}.`)
    } catch {
      // Fallback: just download
      downloadBlob(json, 'timetracker-sync.json', 'application/json')
      setSyncStatus('Downloaded sync file (Tauri FS not available).')
    }
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">OneDrive / Folder Sync</h3>
      <p className="mb-3 text-xs text-zinc-600">Export a JSON snapshot to a folder (e.g. OneDrive) for multi-device sync.</p>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="C:\Users\…\OneDrive\TimeTracker"
          className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
          value={syncPath}
          onChange={e => setSyncPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveSyncPath()}
        />
        <button onClick={handleSaveSyncPath} className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all">Save</button>
      </div>
      <button onClick={handleManualSync} className="rounded-md border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all">
        Sync Now
      </button>
      {syncStatus && <p className="mt-2 text-xs text-emerald-400">{syncStatus}</p>}
    </section>
  )
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView({ categories, sessions, storage, webhookUrl, onWebhookUrlChange }: Props) {
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [webhookDraft, setWebhookDraft] = useState(webhookUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleBackup() {
    const json = exportSessionsToJSON(sessions, categories)
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(json, `timetracker-backup-${date}.json`, 'application/json')
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const raw = await file.text()
      const data = JSON.parse(raw) as Array<{
        id: string; categoryId: string; startedAt: number; endedAt: number; date: string; tag?: string
      }>
      const sessions: Session[] = data.map(d => ({
        id: d.id,
        categoryId: d.categoryId,
        startedAt: d.startedAt,
        endedAt: d.endedAt,
        date: d.date,
        tag: d.tag,
      }))
      await storage.importSessions(sessions)
      setRestoreStatus(`Restored ${sessions.length} sessions.`)
    } catch {
      setRestoreStatus('Error: invalid backup file.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSaveWebhook() {
    await storage.setSetting('webhook_url', webhookDraft)
    onWebhookUrlChange(webhookDraft)
  }

  return (
    <div className="space-y-8">
      <h2 className="text-sm font-semibold text-zinc-200">Settings</h2>

      {/* Backup & Restore */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Backup & Restore</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleBackup}
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
          >
            Download Backup (JSON)
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
          >
            Restore from Backup
          </button>
        </div>
        {restoreStatus && (
          <p className="mt-2 text-xs text-emerald-400">{restoreStatus}</p>
        )}
      </section>

      {/* OneDrive / Sync */}
      <SyncSection storage={storage} sessions={sessions} categories={categories} />

      {/* Webhooks */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Webhooks</h3>
        <p className="mb-3 text-xs text-zinc-600">POST to this URL on timer start/stop events.</p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://…"
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
            value={webhookDraft}
            onChange={e => setWebhookDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveWebhook()}
          />
          <button
            onClick={handleSaveWebhook}
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
          >
            Save
          </button>
        </div>
      </section>
    </div>
  )
}
