import { useState, useRef, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'
import { groupSessionsByDate, exportSessionsToCSV, exportSessionsToJSON, exportSessionsToHTML, isFlowSession, parseTogglCSV, CSV_PRESETS } from '../domain/history'
import type { CSVColumn } from '../domain/history'
import { formatElapsed, formatLocalTime } from '../domain/format'
import { ActivityTimeline } from './ActivityTimeline'
import type { Session, Category } from '../domain/timer'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { Storage } from '../persistence/storage'
import { parseICS, icsEventsToSessions } from '../domain/calendarImport'

type Props = {
  sessions: Session[]
  categories: Category[]
  captureBlocks?: CaptureBlock[]
  onImportSessions?: (sessions: Session[]) => Promise<void>
  onBulkTag?: (sessionIds: string[], tag: string | null) => Promise<void>
  onTagSession?: (id: string, tag: string) => Promise<void>
  storage?: Storage
}

function formatTime(ms: number): string {
  return formatLocalTime(ms)
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

export function HistoryView({ sessions, categories, captureBlocks = [], onImportSessions, onBulkTag, onTagSession, storage }: Props) {
  const { t } = useI18n()
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [csvPreset, setCsvPreset] = useState<keyof typeof CSV_PRESETS>('default')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTagDraft, setBulkTagDraft] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  // M72: inline tag suggestion state
  const [taggingSessionId, setTaggingSessionId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const icsInputRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  // M72: handler — prefer dedicated prop, fall back to onBulkTag
  const handleTagSession = useCallback(async (id: string, tag: string) => {
    if (onTagSession) {
      await onTagSession(id, tag)
    } else if (onBulkTag) {
      await onBulkTag([id], tag)
    }
  }, [onTagSession, onBulkTag])

  useEffect(() => {
    if (!exportOpen) return
    function onClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [exportOpen])

  const groups = groupSessionsByDate(sessions, categories)

  async function handleImportICS(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const raw = await file.text()
    const events = parseICS(raw)
    const fallbackId = categories[0]?.id
    const { sessions: imported, unmatchedSummaries } = icsEventsToSessions(events, categories, fallbackId)
    if (imported.length === 0) {
      setImportStatus(t('calendar.noEvents'))
    } else {
      await onImportSessions?.(imported)
      const fallbackSuffix = unmatchedSummaries.length > 0
        ? t('calendar.importFallback').replace('{n}', String(unmatchedSummaries.length))
        : ''
      setImportStatus(t('calendar.importSuccess').replace('{n}', String(imported.length)) + fallbackSuffix)
    }
    if (icsInputRef.current) icsInputRef.current.value = ''
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const raw = await file.text()
    const { sessions: parsed, newCategories } = parseTogglCSV(raw, categories)
    const sessionsWithIds: Session[] = parsed.map((s, i) => ({
      ...s,
      id: `import-${Date.now()}-${i}`,
    }))
    await onImportSessions?.(sessionsWithIds)
    setImportStatus(`Imported ${sessionsWithIds.length} sessions${newCategories.length > 0 ? ` (${newCategories.length} new categories)` : ''}.`)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleExportCSV() {
    const columns = CSV_PRESETS[csvPreset] as CSVColumn[]
    const csv = exportSessionsToCSV(sessions, categories, columns)
    downloadBlob(csv, `sessions-${csvPreset}.csv`, 'text/csv')
  }

  function handleExportJSON() {
    const json = exportSessionsToJSON(sessions, categories)
    downloadBlob(json, 'sessions.json', 'application/json')
  }

  function handleExportHTML() {
    const weeklyStats = categories.map(c => ({ name: c.name, weeklyMs: 0 }))
    const html = exportSessionsToHTML(sessions, categories, weeklyStats)
    downloadBlob(html, 'report.html', 'text/html')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{t('history.title')}</h2>
        <div className="flex gap-2 items-center">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          <input ref={icsInputRef} type="file" accept=".ics" className="hidden" onChange={handleImportICS} />

          {/* Import — secondary, subtle */}
          {onImportSessions && (
            <div className="flex gap-1.5">
              <button
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('history.importToggl')}
              </button>
              <span className="text-zinc-800">·</span>
              <button
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                onClick={() => icsInputRef.current?.click()}
              >
                {t('history.importCalendar')}
              </button>
            </div>
          )}

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(p => !p)}
              className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all flex items-center gap-1.5"
            >
              {t('history.export')}
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-white/[0.1] bg-zinc-900 py-1 shadow-xl text-xs">
                <div className="px-3 py-1.5 text-zinc-600 text-[10px] uppercase tracking-wider">{t('history.format')}</div>
                {(['default', 'toggl', 'clockify'] as const).map(preset => (
                  <button key={preset}
                    className={`flex w-full items-center justify-between px-3 py-1.5 transition-colors ${
                      csvPreset === preset ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                    onClick={() => setCsvPreset(preset)}>
                    CSV — {preset}
                    {csvPreset === preset && <span>✓</span>}
                  </button>
                ))}
                <div className="border-t border-white/[0.06] my-1" />
                <button className="flex w-full px-3 py-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                  onClick={() => { handleExportCSV(); setExportOpen(false) }}>
                  {t('history.downloadCSV')}
                </button>
                <button className="flex w-full px-3 py-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                  onClick={() => { handleExportJSON(); setExportOpen(false) }}>
                  {t('history.downloadJSON')}
                </button>
                <button className="flex w-full px-3 py-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                  onClick={() => { handleExportHTML(); setExportOpen(false) }}>
                  {t('history.downloadHTML')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {importStatus && (
        <p className="mb-4 text-xs text-emerald-400">{importStatus}</p>
      )}

      {selected.size > 0 && onBulkTag && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2 text-xs">
          <span className="text-indigo-300">{selected.size} selected</span>
          <input
            type="text"
            placeholder={t('history.tagOrClear')}
            value={bulkTagDraft}
            onChange={e => setBulkTagDraft(e.target.value)}
            className="flex-1 rounded border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/15 transition-all"
          />
          <button
            onClick={async () => {
              await onBulkTag([...selected], bulkTagDraft || null)
              setSelected(new Set())
              setBulkTagDraft('')
            }}
            className="rounded border border-indigo-500/30 bg-indigo-500/15 px-2 py-1 text-xs text-indigo-300 hover:text-indigo-100 transition-all"
          >
            {t('history.applyTag')}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-zinc-600">{t('history.empty')}</p>
          {sessions.length === 0 && (
            <p className="max-w-xs text-xs text-zinc-700">
              {t('history.emptyStart')}
            </p>
          )}
          {sessions.length > 0 && (
            <p className="text-xs text-zinc-700">{t('history.emptyFilter')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(day => (
            <div key={day.date}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{day.date}</span>
                <span className="font-mono text-xs text-zinc-600">{formatElapsed(day.totalMs)}</span>
              </div>
              {/* Activity timeline for blocks that fall on this day */}
              {(() => {
                const dayStart = new Date(day.date + 'T00:00:00Z').getTime()
                const dayEnd = dayStart + 86_400_000
                const dayBlocks = captureBlocks.filter(b => b.startedAt >= dayStart && b.startedAt < dayEnd)
                return dayBlocks.length > 0
                  ? <ActivityTimeline blocks={dayBlocks} categories={categories} />
                  : null
              })()}
              <ul className="space-y-2 mt-3">
                {day.sessions.map((s, i) => {
                  const duration = s.endedAt - s.startedAt
                  const flow = isFlowSession(s)
                  return (
                    <li key={s.id ?? i} className={`flex items-center gap-2 text-sm text-zinc-400 rounded px-1 -mx-1 transition-colors ${selected.has(s.id) ? 'bg-indigo-500/[0.06]' : ''}`}>
                      {onBulkTag && (
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={e => setSelected(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(s.id)
                            else next.delete(s.id)
                            return next
                          })}
                          className="accent-indigo-400 shrink-0"
                        />
                      )}
                      <span className="font-mono text-xs text-zinc-600 shrink-0">
                        {formatTime(s.startedAt)} → {formatTime(s.endedAt)}
                      </span>
                      <span className="text-zinc-300">{s.categoryName}</span>
                      <span className="font-mono text-xs text-zinc-600">{formatElapsed(duration)}</span>
                      {s.tag && (
                        <span className="text-xs text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">{s.tag}</span>
                      )}
                      {flow && (
                        <span className="text-xs text-amber-500/80 border border-amber-500/20 rounded px-1.5 py-0.5">{t('history.flow')}</span>
                      )}
                      {/* M72: inline tag suggestion for untagged sessions */}
                      {!s.tag && (onTagSession || onBulkTag) && (
                        <span className="relative ml-auto">
                          {taggingSessionId === s.id ? (
                            <span className="flex gap-1">
                              {['deep-work', 'admin', 'meeting', 'learning'].map(tag => (
                                <button
                                  key={tag}
                                  onClick={async () => { await handleTagSession(s.id, tag); setTaggingSessionId(null) }}
                                  className="text-xs px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                                >
                                  {tag}
                                </button>
                              ))}
                              <button
                                onClick={() => setTaggingSessionId(null)}
                                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setTaggingSessionId(s.id)}
                              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
                            >
                              + tag
                            </button>
                          )}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
