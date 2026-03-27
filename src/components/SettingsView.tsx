import { useState, useRef, useEffect, useMemo } from 'react'
import { exportSessionsToJSON } from '../domain/history'
import { toLocalDateString } from '../domain/format'
import { FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { getLLMStatus } from '../services/llm'
import { useI18n, isI18nKey, translations } from '../i18n'
import type { TKey } from '../i18n'
import type { Category, Session } from '../domain/timer'
import type { Storage } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import { saveCredential, loadCredential } from '../services/credentials'
import { computeNaturalCycle } from '../domain/adaptiveCycles'
import { parseICS } from '../domain/calendarParser'
import type { CaptureBlock } from '../domain/passiveCapture'

type Props = {
  categories: Category[]
  sessions: Session[]
  storage: Storage
  focusPreset: FocusPreset
  onFocusPresetChange: (preset: FocusPreset) => void
  focusStrictMode: boolean
  onFocusStrictModeChange: (strict: boolean) => void
  onScreenshotsEnabledChange?: (enabled: boolean) => void
  captureBlocks?: CaptureBlock[]
  onToast?: (message: string) => void
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

// ─── ScreenshotSettingsSection ────────────────────────────────────────────────

const RETENTION_VALUES = ['7', '30', 'never'] as const
type RetentionKey = 'settings.retention7' | 'settings.retention30' | 'settings.retentionNever'
const RETENTION_I18N_KEYS: RetentionKey[] = ['settings.retention7', 'settings.retention30', 'settings.retentionNever']

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
        {t('settings.screenshotDesc')}
        <span className="ml-1 text-zinc-700">{t('settings.screenshotOptIn')}</span>
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
          {t('screenshot.enable')} — {enabled ? t('settings.strictOn') : t('settings.strictOff')}
        </span>
      </div>
      {enabled && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600">{t('settings.retention')}</span>
          <div className="flex gap-2">
            {RETENTION_VALUES.map((val, i) => (
              <button
                key={val}
                onClick={() => handleRetentionChange(val)}
                className={`rounded px-3 py-1 text-xs transition-all ${
                  retention === val
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'border border-white/[0.07] text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {t(RETENTION_I18N_KEYS[i])}
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
  const { t } = useI18n()
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
      setStatus(next ? t('settings.startupOn') : t('settings.startupOff'))
    } catch {
      setStatus(t('settings.startupUnavail'))
    }
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.startup')}</h3>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{t('settings.startupDesc')}</span>
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

function PurgeOldSessionsButton({ storage, onToast }: { storage: Storage; onToast?: (msg: string) => void }) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState<'before-today' | 'all' | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  async function handlePurge() {
    let count: number
    if (confirming === 'all') {
      count = await storage.deleteAllSessions()
      onToast?.(t('settings.deletedAllResult').replace('{count}', String(count)))
    } else {
      count = await storage.purgeSessionsBefore(today)
      onToast?.(t('settings.deletedBeforeResult').replace('{count}', String(count)).replace('{date}', today))
    }
    setConfirming(null)
  }

  if (!confirming) {
    return (
      <div className="flex gap-4">
        <button onClick={() => setConfirming('before-today')}
          className="text-xs text-red-700 hover:text-red-400 transition-colors">
          {t('settings.deleteBefore')}
        </button>
        <button onClick={() => setConfirming('all')}
          className="text-xs text-red-700 hover:text-red-400 transition-colors">
          {t('settings.deleteAll')}
        </button>
      </div>
    )
  }

  const label = confirming === 'all'
    ? t('settings.deleteAllConfirm')
    : `${t('settings.deleteBeforePrefix')} ${today}?`

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500">{label}</span>
      <button onClick={handlePurge}
        className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:text-red-200 transition-all">
        {t('settings.yesDelete')}
      </button>
      <button onClick={() => setConfirming(null)}
        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
        {t('category.cancel')}
      </button>
    </div>
  )
}

function ProcessRulesSection({ categories, onToast }: { categories: Category[]; onToast?: (msg: string) => void }) {
  const { t } = useI18n()
  const [rules, setRules] = useState<WindowRule[]>(() => loadUserRules())

  // Refresh when usePassiveCapture writes new rules via localStorage
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === USER_RULES_KEY) setRules(loadUserRules())
    }
    // Poll every 2s for same-tab updates (storage event doesn't fire for same tab)
    const id = setInterval(() => setRules(loadUserRules()), 2_000)
    window.addEventListener('storage', onStorage)
    return () => { clearInterval(id); window.removeEventListener('storage', onStorage) }
  }, [])

  function handleDelete(id: string) {
    const next = rules.filter(r => r.id !== id)
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(next))
    setRules(next)
    onToast?.(t('toast.ruleDeleted'))
  }

  function handleToggleMode(id: string) {
    const next = rules.map(r => r.id !== id ? r : { ...r, mode: r.mode === 'auto' ? 'suggest' as const : 'auto' as const })
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(next))
    setRules(next)
    onToast?.(t('toast.ruleUpdated'))
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('settings.processRules')}</h3>
      <p className="mb-3 text-xs text-zinc-600">{t('settings.processRulesDesc')}</p>
      {rules.length === 0 ? (
        <p className="text-xs text-zinc-600">{t('settings.processRulesEmpty')}</p>
      ) : (
        <>
          <div className="mb-2 flex gap-4 text-[10px] text-zinc-700">
            <span><span className="text-emerald-400 font-medium">auto</span> — {t('settings.modeAutoDesc')}</span>
            <span><span className="text-zinc-400 font-medium">suggest</span> — {t('settings.modeSuggestDesc')}</span>
          </div>
          <ul className="space-y-1">
            {rules.map(rule => {
              const catName = rule.categoryId
                ? (categories.find(c => c.id === rule.categoryId)?.name ?? rule.categoryId)
                : null
              return (
                <li key={rule.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                  <span className="flex-1 font-mono text-zinc-300 truncate">{rule.pattern}</span>
                  <span className="text-zinc-500 shrink-0">
                    {rule.mode === 'ignore' ? t('settings.ignore') : catName ?? '—'}
                  </span>
                  {rule.mode !== 'ignore' && (
                    <button
                      title={rule.mode === 'auto' ? t('settings.modeAutoDesc') : t('settings.modeSuggestDesc')}
                      onClick={() => handleToggleMode(rule.id)}
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                        rule.mode === 'auto'
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-white/[0.05] text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {rule.mode}
                    </button>
                  )}
                  <button
                    title={`Delete rule for ${rule.pattern}`}
                    onClick={() => handleDelete(rule.id)}
                    className="shrink-0 text-zinc-700 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

// ─── SettingsView ─────────────────────────────────────────────────────────────

export function SettingsView({ categories, sessions, storage, focusPreset, onFocusPresetChange, focusStrictMode, onFocusStrictModeChange, onScreenshotsEnabledChange, captureBlocks, onToast }: Props) {
  const { t, lang, setLang } = useI18n()
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null)

  const naturalCycle = useMemo(() => {
    if (!captureBlocks || captureBlocks.length === 0) return null
    try {
      return computeNaturalCycle(captureBlocks)
    } catch { return null }
  }, [captureBlocks])
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [githubUsername, setGithubUsername] = useState('')
  const [githubSaved, setGithubSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)

  function toggleIntegration(name: string) {
    setExpandedIntegration(p => p === name ? null : name)
  }

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
    const date = toLocalDateString(Date.now())
    downloadBlob(json, `kairos-backup-${date}.json`, 'application/json')
    onToast?.(t('toast.backupExported'))
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const raw = await file.text()
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) throw new Error('backup.errorBadFormat')
      const sessions: Session[] = data.map((d: unknown) => {
        if (typeof d !== 'object' || d === null) throw new Error('backup.errorBadSession')
        const s = d as Record<string, unknown>
        if (typeof s.id !== 'string' || typeof s.categoryId !== 'string' ||
            typeof s.startedAt !== 'number' || typeof s.endedAt !== 'number' ||
            typeof s.date !== 'string') throw new Error('backup.errorBadFields')
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
      onToast?.(t('backup.restoreSuccess').replace('{n}', String(sessions.length)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setRestoreStatus(isI18nKey(msg) ? t(msg as TKey) : t('backup.errorInvalid'))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const [hourlyRate, setHourlyRate] = useState('')
  const [hourlyRateSaved, setHourlyRateSaved] = useState(false)
  const [calendarEventCount, setCalendarEventCount] = useState<number | null>(null)
  const calendarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    storage.getSetting(SettingKey.HourlyRate).then(v => { if (v) setHourlyRate(v) })
  }, [storage])

  async function handleHourlyRateSave() {
    const trimmed = hourlyRate.trim()
    await storage.setSetting(SettingKey.HourlyRate, trimmed)
    setHourlyRateSaved(true)
    onToast?.(t('settings.hourlyRateSaved'))
  }

  async function handleCalendarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const events = parseICS(text)
      // Store in localStorage for App.tsx to read
      localStorage.setItem('calendar_events', JSON.stringify(events))
      setCalendarEventCount(events.length)
      onToast?.(t('settings.calendarLoaded').replace('{n}', String(events.length)))
    } catch {
      onToast?.('Failed to parse calendar file.')
    }
    if (calendarInputRef.current) calendarInputRef.current.value = ''
  }

  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  function toggleSection(name: string) {
    setExpandedSection(p => p === name ? null : name)
  }

  function AccordionRow({ id, label, status }: { id: string; label: string; status?: string }) {
    const open = expandedSection === id
    return (
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-xs text-zinc-400 hover:bg-white/[0.02] transition-colors"
        onClick={() => toggleSection(id)}
      >
        <span className="font-medium">{label}</span>
        <span className={status ? 'text-emerald-400' : 'text-zinc-600'}>
          {status ?? (open ? '▲' : '▼')}
        </span>
      </button>
    )
  }

  return (
    <div>
      <h2 className="mb-6 text-sm font-semibold text-zinc-200">{t('settings.title')}</h2>

      <div className="space-y-1">

        {/* ── Timer & Focus ── */}
        <h3 className="px-1 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Timer &amp; Focus</h3>

        {/* ── Focus Preset ── */}
        {(() => {
          const open = expandedSection === 'focus'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="focus" label={t('settings.focusPreset')} status={focusPreset.key ? t(`preset.${focusPreset.key}.label` as TKey) : focusPreset.name} />
              {open && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_PRESETS.map(p => (
                      <button key={p.name}
                        onClick={() => { onFocusPresetChange(p); storage.setSetting(SettingKey.FocusPreset, p.name) }}
                        className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                          focusPreset.name === p.name
                            ? 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-400'
                            : 'border-white/[0.07] bg-white/[0.02] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.15]'
                        }`}>
                        <span className="font-medium">{p.key ? t(`preset.${p.key}.label` as TKey) : p.name}</span>
                        <span className="ml-1.5 text-zinc-600">{Math.round(p.workMs / 60_000)}m / {Math.round(p.breakMs / 60_000)}m</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button role="switch" aria-checked={focusStrictMode}
                      onClick={() => { const next = !focusStrictMode; onFocusStrictModeChange(next); storage.setSetting(SettingKey.FocusStrictMode, next ? 'true' : 'false') }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${focusStrictMode ? 'bg-red-500/60' : 'bg-white/[0.08]'}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${focusStrictMode ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-xs text-zinc-500">{t('settings.strictMode')} — {focusStrictMode ? t('settings.strictOn') : t('settings.strictOff')}</span>
                  </div>
                  {naturalCycle && (
                    <div className="rounded-lg border border-white/[0.07] p-4">
                      <h4 className="text-xs font-medium text-zinc-300 mb-2">Your Focus Cycle</h4>
                      <p className="text-xs text-zinc-500">
                        Natural cycle: {Math.round(naturalCycle.focusMs / 60_000)}m focus / {Math.round(naturalCycle.breakMs / 60_000)}m break
                        ({naturalCycle.sampleCount} sessions, {Math.round(naturalCycle.confidence * 100)}% confidence)
                      </p>
                      <button
                        onClick={() => {
                          const preset = {
                            name: 'Natural',
                            workMs: naturalCycle.focusMs,
                            breakMs: naturalCycle.breakMs,
                          }
                          onFocusPresetChange(preset)
                          void storage.setSetting(SettingKey.FocusPreset, preset.name)
                        }}
                        className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        [Use as preset]
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Process Rules ── */}
        {(() => {
          const open = expandedSection === 'rules'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="rules" label={t('settings.processRules')} />
              {open && (
                <div className="px-4 pb-4">
                  <ProcessRulesSection categories={categories} onToast={onToast} />
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Startup ── */}
        {(() => {
          const open = expandedSection === 'startup'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="startup" label={t('settings.startup')} />
              {open && (
                <div className="px-4 pb-4">
                  <StartupSection />
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Productivity ── */}
        <h3 className="px-1 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{t('settings.productivity')}</h3>

        {(() => {
          const open = expandedSection === 'productivity'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="productivity" label={t('settings.hourlyRate')} status={hourlyRate ? `$${hourlyRate}/h` : undefined} />
              {open && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Hourly rate */}
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-600">{t('settings.hourlyRateDesc')}</p>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-zinc-500">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={t('settings.hourlyRatePlaceholder')}
                        value={hourlyRate}
                        onChange={e => { setHourlyRate(e.target.value); setHourlyRateSaved(false) }}
                        onKeyDown={e => e.key === 'Enter' && handleHourlyRateSave()}
                        className="w-32 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
                      />
                      <span className="text-xs text-zinc-500">/h</span>
                      <button
                        onClick={handleHourlyRateSave}
                        className="rounded-lg border border-white/[0.07] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
                      >
                        {hourlyRateSaved ? '✓' : t('settings.save')}
                      </button>
                    </div>
                  </div>

                  {/* M93: Calendar .ics import */}
                  <div className="space-y-2 border-t border-white/[0.04] pt-3">
                    <p className="text-xs font-medium text-zinc-500">{t('settings.calendarFile')}</p>
                    <p className="text-xs text-zinc-600">{t('settings.calendarDesc')}</p>
                    <div className="flex gap-2 items-center">
                      <input
                        ref={calendarInputRef}
                        type="file"
                        accept=".ics"
                        onChange={handleCalendarFile}
                        className="hidden"
                        id="calendar-file-input"
                      />
                      <label
                        htmlFor="calendar-file-input"
                        className="cursor-pointer rounded-lg border border-white/[0.07] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
                      >
                        Choose .ics file
                      </label>
                      {calendarEventCount !== null && (
                        <span className="text-xs text-emerald-400">
                          {t('settings.calendarLoaded').replace('{n}', String(calendarEventCount))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Integrations ── */}
        <h3 className="px-1 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Integrations</h3>

        {/* ── Integrations (parent accordion) ── */}
        {(() => {
          const connectedCount = [
            apiKeyDraft.startsWith('••'),
            !!githubUsername,
          ].filter(Boolean).length
          const subtitle = connectedCount > 0
            ? `${connectedCount} connected`
            : integrationsOpen ? '▲' : '▼'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-xs text-zinc-400 hover:bg-white/[0.02] transition-colors"
                onClick={() => setIntegrationsOpen(p => !p)}
              >
                <span className="font-medium">{t('settings.integrations')}</span>
                <span className={connectedCount > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                  {subtitle}
                </span>
              </button>
              {integrationsOpen && (
                <div className="border-t border-white/[0.04] divide-y divide-white/[0.04]">

                  {/* ── AI / Claude ── */}
                  {(() => {
                    const connected = apiKeyDraft.startsWith('••')
                    const open = expandedIntegration === 'ai'
                    return (
                      <div>
                        <button className="flex w-full items-center justify-between px-6 py-3 text-xs text-zinc-400 hover:bg-white/[0.02] transition-colors"
                          onClick={() => toggleIntegration('ai')}>
                          <span className="font-medium">{t('settings.apiKey')}</span>
                          <span className={connected ? 'text-emerald-400' : 'text-zinc-600'}>
                            {connected ? t('settings.connected') : open ? '▲' : t('settings.setup')}
                          </span>
                        </button>
                        {open && (
                          <div className="px-6 pb-4 space-y-2">
                            <p className="text-xs text-zinc-600">{t('settings.apiKeyDesc')}</p>
                            <div className="flex gap-2">
                              <input type="password" placeholder="sk-ant-…"
                                className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
                                value={apiKeyDraft.startsWith('••') ? '' : apiKeyDraft}
                                onChange={e => { setApiKeyDraft(e.target.value); setApiKeySaved(false) }}
                                onKeyDown={e => e.key === 'Enter' && !apiKeyDraft.startsWith('••') && saveCredential(SettingKey.AnthropicApiKey, apiKeyDraft).then(() => { setApiKeySaved(true); onToast?.(t('toast.apiKeySaved')) })}
                              />
                              <button onClick={() => {
                                  if (!apiKeyDraft || apiKeyDraft.startsWith('••')) return
                                  saveCredential(SettingKey.AnthropicApiKey, apiKeyDraft).then(() => { setApiKeySaved(true); setApiKeyDraft('••••••••' + apiKeyDraft.slice(-4)); onToast?.(t('toast.apiKeySaved')) })
                                }}
                                className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all">
                                {apiKeySaved ? t('settings.saved') : t('settings.save')}
                              </button>
                            </div>
                            <p className="text-xs text-zinc-600">{t('settings.ollamaDesc')}</p>
                            <AIBackendStatus apiKey={apiKeyDraft} />
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* ── GitHub ── */}
                  {(() => {
                    const connected = !!githubUsername
                    const open = expandedIntegration === 'github'
                    return (
                      <div>
                        <button className="flex w-full items-center justify-between px-6 py-3 text-xs text-zinc-400 hover:bg-white/[0.02] transition-colors"
                          onClick={() => toggleIntegration('github')}>
                          <span className="font-medium">{t('github.correlation')}</span>
                          <span className={connected ? 'text-emerald-400' : 'text-zinc-600'}>
                            {connected ? `✓ ${githubUsername}` : open ? '▲' : t('settings.setup')}
                          </span>
                        </button>
                        {open && (
                          <div className="px-6 pb-4 space-y-2">
                            <p className="text-xs text-zinc-600">{t('github.correlationDesc')}</p>
                            <div className="flex gap-2">
                              <input type="text" placeholder="GitHub username"
                                className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
                                value={githubUsername}
                                onChange={e => setGithubUsername(e.target.value)}
                                onBlur={() => { storage.getSetting(SettingKey.GithubUsername).then(v => { if (v !== githubUsername) storage.setSetting(SettingKey.GithubUsername, githubUsername).then(() => setGithubSaved(true)) }) }}
                                onKeyDown={e => e.key === 'Enter' && storage.setSetting(SettingKey.GithubUsername, githubUsername).then(() => setGithubSaved(true))}
                              />
                              {githubSaved && <span className="self-center text-xs text-emerald-400">{t('settings.saved')}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              )}
            </div>
          )
        })()}

        {/* ── Data & Export ── */}
        <h3 className="px-1 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Data &amp; Export</h3>

        {/* ── Screenshots ── */}
        {(() => {
          const open = expandedSection === 'screenshots'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="screenshots" label={t('screenshot.title')} />
              {open && (
                <div className="px-4 pb-4">
                  <ScreenshotSettingsSection storage={storage} onEnabledChange={onScreenshotsEnabledChange} />
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Backup & Restore ── */}
        {(() => {
          const open = expandedSection === 'data'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="data" label={t('settings.backup')} />
              {open && (
                <div className="px-4 pb-4 flex gap-2 flex-wrap">
                  <button onClick={handleBackup}
                    className="rounded-md border border-white/[0.07] bg-white/3 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all">
                    {t('settings.downloadBackup')}
                  </button>
                  <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-white/[0.07] bg-white/3 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all">
                    {t('settings.restoreBackup')}
                  </button>
                  {restoreStatus && <p className="mt-2 text-xs text-emerald-400 w-full">{restoreStatus}</p>}

                  {/* Purge old sessions */}
                  <div className="w-full mt-3 pt-3 border-t border-white/[0.05]">
                    <PurgeOldSessionsButton storage={storage} onToast={onToast} />
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Appearance ── */}
        <h3 className="px-1 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Appearance</h3>

        {/* ── Language ── */}
        {(() => {
          const open = expandedSection === 'language'
          return (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <AccordionRow id="language" label={t('settings.language')} status={t('settings.langName')} />
              {open && (
                <div className="px-4 pb-4 flex gap-2">
                  {(['en', 'pt'] as const).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`rounded-lg border px-4 py-2 text-xs transition-all ${
                        lang === l
                          ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400'
                          : 'border-white/[0.07] bg-white/2 text-zinc-500 hover:text-zinc-200 hover:border-white/15'
                      }`}>
                      {l === 'en' ? translations.en['settings.langName'] : translations.pt['settings.langName']}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

      </div>
    </div>
  )
}
