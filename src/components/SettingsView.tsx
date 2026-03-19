import { useState, useRef, useEffect } from 'react'
import { exportSessionsToJSON } from '../domain/history'
import { FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { getLLMStatus } from '../services/llm'
import { useI18n } from '../i18n'
import type { Category, Session } from '../domain/timer'
import type { Storage } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import { saveCredential, loadCredential } from '../services/credentials'

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
  onScreenshotsEnabledChange?: (enabled: boolean) => void
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

// ─── AIBackendStatus ──────────────────────────────────────────────────────────

function AIBackendStatus({ apiKey }: { apiKey: string }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<{ backend: string; model?: string; available: boolean } | null>(null)

  useEffect(() => {
    getLLMStatus(apiKey.startsWith('••') ? null : apiKey || null).then(setStatus)
  }, [apiKey])

  if (!status) return null

  const label = status.backend === 'ollama' ? t('settings.aiBackendOllama')
    : status.backend === 'claude' ? t('settings.aiBackendClaude')
    : t('settings.aiBackendNone')

  const color = status.available ? 'text-emerald-400' : 'text-zinc-600'
  const dot = status.available ? '●' : '○'

  return (
    <p className={`text-xs ${color}`}>
      {dot} {label}{status.model ? ` — ${status.model}` : ''}
    </p>
  )
}

// ─── SyncSection ──────────────────────────────────────────────────────────────

function SyncSection({ storage, sessions, categories }: { storage: Storage; sessions: Session[]; categories: Category[] }) {
  const { t } = useI18n()
  const [syncPath, setSyncPath] = useState('')
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState('')

  useEffect(() => {
    Promise.all([
      storage.getSetting(SettingKey.SyncPath),
      storage.getSetting(SettingKey.WorkspaceRoot),
    ]).then(([sp, wr]) => {
      setSyncPath(sp ?? '')
      setWorkspaceRoot(wr ?? '')
    })
  }, [])

  async function handleSaveSyncPath() {
    await storage.setSetting(SettingKey.SyncPath, syncPath)
    setSyncStatus('Sync path saved.')
  }

  async function handleManualSync() {
    const path = await storage.getSetting(SettingKey.SyncPath)
    if (!path) { setSyncStatus('No sync path configured.'); return }
    // Block path traversal: reject paths containing '..' segments
    if (path.includes('..') || path.includes('\\\\') || (!path.startsWith('/') && !/^[A-Za-z]:[/\\]/.test(path))) {
      setSyncStatus('Invalid sync path.')
      return
    }
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

      <h3 className="mt-5 mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Workspace Root</h3>
      <p className="mb-2 text-xs text-zinc-600">Base folder for your projects. Used to auto-detect the active repo from your VSCode window title.</p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="C:\Users\…\Projects"
          className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
          value={workspaceRoot}
          onChange={e => setWorkspaceRoot(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void storage.setSetting(SettingKey.WorkspaceRoot, workspaceRoot)
          }}
        />
        <button
          onClick={() => void storage.setSetting(SettingKey.WorkspaceRoot, workspaceRoot)}
          className="rounded-md border border-white/[0.07] bg-white/3 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
        >
          Save
        </button>
      </div>
    </section>
  )
}

// ─── ScreenshotSettingsSection ────────────────────────────────────────────────

const RETENTION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'Never auto-delete' },
]

function ScreenshotSettingsSection({ storage, onEnabledChange }: { storage: Storage; onEnabledChange?: (enabled: boolean) => void }) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [retention, setRetention] = useState('7')

  useEffect(() => {
    Promise.all([
      storage.getSetting(SettingKey.ScreenshotsEnabled),
      storage.getSetting(SettingKey.ScreenshotsRetention),
    ]).then(([e, r]) => {
      if (e) setEnabled(e === 'true')
      if (r) setRetention(r)
    })
  }, [])

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    await storage.setSetting(SettingKey.ScreenshotsEnabled, next ? 'true' : 'false')
    onEnabledChange?.(next)
  }

  async function handleRetentionChange(value: string) {
    setRetention(value)
    await storage.setSetting(SettingKey.ScreenshotsRetention, value)
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {t('screenshot.title')}
      </h3>
      <p className="mb-3 text-xs text-zinc-600">
        Capture a screenshot every 5 minutes while a timer is active. Stored locally, never uploaded.
        <span className="ml-1 text-zinc-700">Opt-in only.</span>
      </p>
      <div className="flex items-center gap-3 mb-3">
        <button
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? 'bg-emerald-500/60' : 'bg-white/[0.08]'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-1'
          }`} />
        </button>
        <span className="text-xs text-zinc-500">
          {t('screenshot.enable')} — {enabled ? 'on' : 'off'}
        </span>
      </div>
      {enabled && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600">Retention:</span>
          <div className="flex gap-2">
            {RETENTION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleRetentionChange(opt.value)}
                className={`rounded px-3 py-1 text-xs transition-all ${
                  retention === opt.value
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'border border-white/[0.07] text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ─── ProcessRulesSection ──────────────────────────────────────────────────────

const USER_RULES_KEY = 'user_window_rules'

type WindowRule = {
  id: string
  matchType: 'process' | 'title'
  pattern: string
  categoryId: string | null
  mode: 'auto' | 'suggest' | 'ignore'
  enabled: boolean
}

function loadUserRules(): WindowRule[] {
  try { return JSON.parse(localStorage.getItem(USER_RULES_KEY) ?? '[]') } catch { return [] }
}

function StartupSection() {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const on = await invoke<boolean>('get_startup_enabled')
        setEnabled(on)
      } catch { /* browser env */ }
    })()
  }, [])

  async function handleToggle() {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const next = !enabled
      await invoke('set_startup_enabled', { enabled: next })
      setEnabled(next)
      setStatus(next ? 'App will start on login.' : 'Removed from startup.')
    } catch {
      setStatus('Not available (Windows only).')
    }
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Startup</h3>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Launch Time Tracker when Windows starts</span>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-zinc-500">{status}</p>}
    </section>
  )
}

function ProcessRulesSection({ categories }: { categories: Category[] }) {
  const [rules, setRules] = useState<WindowRule[]>(() => loadUserRules())

  function handleDelete(id: string) {
    const next = rules.filter(r => r.id !== id)
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(next))
    setRules(next)
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Process Rules</h3>
      {rules.length === 0 ? (
        <p className="text-xs text-zinc-600">No custom rules — classify a process from the Tracker tab to add rules here.</p>
      ) : (
        <ul className="space-y-1">
          {rules.map(rule => {
            const catName = rule.categoryId
              ? (categories.find(c => c.id === rule.categoryId)?.name ?? rule.categoryId)
              : null
            return (
              <li key={rule.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                <span className="font-mono text-zinc-300">{rule.pattern}</span>
                <span className="text-zinc-500">
                  {rule.mode === 'ignore' ? 'ignore' : catName ?? '—'}
                </span>
                <button
                  title={`Delete rule for ${rule.pattern}`}
                  onClick={() => handleDelete(rule.id)}
                  className="ml-4 text-zinc-700 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView({ categories, sessions, storage, webhookUrl, onWebhookUrlChange, focusPreset, onFocusPresetChange, focusStrictMode, onFocusStrictModeChange, onScreenshotsEnabledChange }: Props) {
  const { t, lang, setLang } = useI18n()
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)
  const [webhookDraft, setWebhookDraft] = useState(webhookUrl)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [githubUsername, setGithubUsername] = useState('')
  const [githubSaved, setGithubSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      loadCredential(SettingKey.AnthropicApiKey),
      storage.getSetting(SettingKey.GithubUsername),
    ]).then(([k, gh]) => {
      if (k) setApiKeyDraft('••••••••' + k.slice(-4))
      if (gh) setGithubUsername(gh)
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
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) throw new Error('Invalid format')
      const sessions: Session[] = data.map((d: unknown) => {
        if (typeof d !== 'object' || d === null) throw new Error('Invalid session')
        const s = d as Record<string, unknown>
        if (typeof s.id !== 'string' || typeof s.categoryId !== 'string' ||
            typeof s.startedAt !== 'number' || typeof s.endedAt !== 'number' ||
            typeof s.date !== 'string') throw new Error('Invalid session fields')
        return {
          id: s.id,
          categoryId: s.categoryId,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          date: s.date,
          tag: typeof s.tag === 'string' ? s.tag : undefined,
        }
      })
      await storage.importSessions(sessions)
      setRestoreStatus(`Restored ${sessions.length} sessions.`)
    } catch {
      setRestoreStatus('Error: invalid backup file.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSaveWebhook() {
    await storage.setSetting(SettingKey.WebhookUrl, webhookDraft)
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
              onClick={() => { onFocusPresetChange(p); storage.setSetting(SettingKey.FocusPreset, p.name) }}
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
              storage.setSetting(SettingKey.FocusStrictMode, next ? 'true' : 'false')
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
            onKeyDown={e => e.key === 'Enter' && !apiKeyDraft.startsWith('••') && saveCredential(SettingKey.AnthropicApiKey, apiKeyDraft).then(() => setApiKeySaved(true))}
          />
          <button
            onClick={() => {
              if (!apiKeyDraft || apiKeyDraft.startsWith('••')) return
              saveCredential(SettingKey.AnthropicApiKey, apiKeyDraft).then(() => {
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

      {/* AI Backend status */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.aiBackend')}</h3>
        <p className="mb-2 text-xs text-zinc-600">{t('settings.ollamaDesc')}</p>
        <AIBackendStatus apiKey={apiKeyDraft} />
      </section>

      {/* GitHub Correlation */}
      <section>
        <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('github.correlation')}</h3>
        <p className="mb-2 text-xs text-zinc-600">Show your GitHub commit activity overlaid on the heatmap.</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="GitHub username"
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
            value={githubUsername}
            onChange={e => setGithubUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && storage.setSetting(SettingKey.GithubUsername, githubUsername).then(() => setGithubSaved(true))}
          />
          <button
            onClick={() => storage.setSetting(SettingKey.GithubUsername, githubUsername).then(() => setGithubSaved(true))}
            className="rounded-md border border-white/[0.07] bg-white/3 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
          >
            {githubSaved ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </section>

      {/* Startup on login */}
      <StartupSection />

      {/* Process Rules */}
      <ProcessRulesSection categories={categories} />

      {/* Screenshots */}
      <ScreenshotSettingsSection storage={storage} onEnabledChange={onScreenshotsEnabledChange} />

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
