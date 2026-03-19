import { useState, useRef } from 'react'
import { useI18n } from '../i18n'
import { groupSessionsByDate, exportSessionsToCSV, exportSessionsToJSON, exportSessionsToHTML, isFlowSession, parseTogglCSV } from '../domain/history'
import { formatElapsed, formatLocalTime } from '../domain/format'
import { ActivityTimeline } from './ActivityTimeline'
import type { Session, Category } from '../domain/timer'
import type { CaptureBlock } from '../domain/passiveCapture'

type Props = {
  sessions: Session[]
  categories: Category[]
  captureBlocks?: CaptureBlock[]
  onImportSessions?: (sessions: Session[]) => Promise<void>
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

export function HistoryView({ sessions, categories, captureBlocks = [], onImportSessions }: Props) {
  const { t } = useI18n()
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const groups = groupSessionsByDate(sessions, categories)

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
    const csv = exportSessionsToCSV(sessions, categories)
    downloadBlob(csv, 'sessions.csv', 'text/csv')
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
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
          {onImportSessions && (
            <button
              className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('history.importToggl')}
            </button>
          )}
          <button
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
            onClick={handleExportCSV}
          >
            CSV
          </button>
          <button
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
            onClick={handleExportJSON}
          >
            JSON
          </button>
          <button
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
            onClick={handleExportHTML}
          >
            HTML
          </button>
        </div>
      </div>

      {importStatus && (
        <p className="mb-4 text-xs text-emerald-400">{importStatus}</p>
      )}

      {groups.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-700">{t('history.empty')}</p>
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
                    <li key={s.id ?? i} className="flex items-center gap-2 text-sm text-zinc-400">
                      <span className="font-mono text-xs text-zinc-600 shrink-0">
                        {formatTime(s.startedAt)} → {formatTime(s.endedAt)}
                      </span>
                      <span className="text-zinc-300">{s.categoryName}</span>
                      <span className="font-mono text-xs text-zinc-600">{formatElapsed(duration)}</span>
                      {s.tag && (
                        <span className="text-xs text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">{s.tag}</span>
                      )}
                      {flow && (
                        <span className="text-xs text-amber-500/80 border border-amber-500/20 rounded px-1.5 py-0.5">⚡ flow</span>
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
