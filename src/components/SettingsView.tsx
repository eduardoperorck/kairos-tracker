import { useState, useRef, useEffect } from 'react'
import { exportSessionsToJSON } from '../domain/history'
import { FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { useI18n } from '../i18n'
import type { Category, Session } from '../domain/timer'
import type { Storage } from '../persistence/storage'

type Props = {
  categories: Category[]
  sessions: Session[]
  storage: Storage
  webhookUrl: string
  onWebhookUrlChange: (url: string) => void
  focusPreset: FocusPreset
  onFocusPresetChange: (preset: FocusPreset) => void
  focusStrictMode: boolean
  onFocusStrictModeChange: (strict: boolean) => void
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
  const { t } = useI18n()
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
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.sync')}</h3>
      <p className="mb-3 text-xs text-zinc-600">{t('settings.syncDesc')}</p>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="C:\Users\…\OneDrive\TimeTracker"
          className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
          value={syncPath}
          onChange={e => setSyncPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveSyncPath()}
        />
        <button onClick={handleSaveSyncPath} className="rounded-md border border-white/[0.07] bg-white/3 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all">{t('settings.syncSave')}</button>
      </div>
      <button onClick={handleManualSync} className="rounded-md border border-white/[0.07] bg-white/3 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all">
        {t('settings.syncNow')}
      </button>
      {syncStatus && <p className="mt-2 text-xs text-emerald-400">{syncStatus}</p>}
    </section>
  )
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView({ categories, sessions, storage, webhookUrl, onWebhookUrlChange, focusPreset, onFocusPresetChange, focusStrictMode, onFocusStrictModeChange }: Props) {
  const { t, lang, setLang } = useI18n()
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [webhookDraft, setWebhookDraft] = useState(webhookUrl)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    storage.getSetting('anthropic_api_key').then(k => {
      if (k) setApiKeyDraft('••••••••' + k.slice(-4))
    })
  }, [])

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
      <h2 className="text-sm font-semibold text-zinc-200">{t('settings.title')}</h2>

      {/* Language */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.language')}</h3>
        <div className="flex gap-2">
          {(['en', 'pt'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-lg border px-4 py-2 text-xs transition-all ${
                lang === l
                  ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400'
                  : 'border-white/[0.07] bg-white/2 text-zinc-500 hover:text-zinc-200 hover:border-white/15'
              }`}
            >
              {l === 'en' ? 'English' : 'Português'}
            </button>
          ))}
        </div>
      </section>

      {/* Backup & Restore */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.backup')}</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleBackup}
            className="rounded-md border border-white/[0.07] bg-white/3 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all"
          >
            {t('settings.downloadBackup')}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-white/[0.07] bg-white/3 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all"
          >
            {t('settings.restoreBackup')}
          </button>
        </div>
        {restoreStatus && (
          <p className="mt-2 text-xs text-emerald-400">{restoreStatus}</p>
        )}
      </section>

      {/* Focus Guard preset */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.focusPreset')}</h3>
        <div className="flex flex-wrap gap-2">
          {FOCUS_PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => { onFocusPresetChange(p); storage.setSetting('focus_preset', p.name) }}
              className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                focusPreset.name === p.name
                  ? 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-400'
                  : 'border-white/[0.07] bg-white/[0.02] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.15]'
              }`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-1.5 text-zinc-600">
                {Math.round(p.workMs / 60_000)}m / {Math.round(p.breakMs / 60_000)}m
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            role="switch"
            aria-checked={focusStrictMode}
            onClick={() => {
              const next = !focusStrictMode
              onFocusStrictModeChange(next)
              storage.setSetting('focus_strict_mode', next ? 'true' : 'false')
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              focusStrictMode ? 'bg-red-500/60' : 'bg-white/[0.08]'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              focusStrictMode ? 'translate-x-4' : 'translate-x-1'
            }`} />
          </button>
          <span className="text-xs text-zinc-500">
            {t('settings.strictMode')} — {focusStrictMode ? t('settings.strictOn') : t('settings.strictOff')}
          </span>
        </div>
      </section>

      {/* AI API Key */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.apiKey')}</h3>
        <p className="mb-2 text-xs text-zinc-600">{t('settings.apiKeyDesc')}</p>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="sk-ant-…"
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
            value={apiKeyDraft.startsWith('••') ? '' : apiKeyDraft}
            onChange={e => { setApiKeyDraft(e.target.value); setApiKeySaved(false) }}
            onKeyDown={e => e.key === 'Enter' && !apiKeyDraft.startsWith('••') && storage.setSetting('anthropic_api_key', apiKeyDraft).then(() => setApiKeySaved(true))}
          />
          <button
            onClick={() => {
              if (!apiKeyDraft || apiKeyDraft.startsWith('••')) return
              storage.setSetting('anthropic_api_key', apiKeyDraft).then(() => {
                setApiKeySaved(true)
                setApiKeyDraft('••••••••' + apiKeyDraft.slice(-4))
              })
            }}
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
          >
            {apiKeySaved ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </section>

      {/* OneDrive / Sync */}
      <SyncSection storage={storage} sessions={sessions} categories={categories} />

      {/* Webhooks */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.webhooks')}</h3>
        <p className="mb-3 text-xs text-zinc-600">{t('settings.webhooksDesc')}</p>
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
            className="rounded-md border border-white/[0.07] bg-white/3 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
          >
            {t('settings.save')}
          </button>
        </div>
      </section>
    </div>
  )
}
