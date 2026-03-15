import { groupSessionsByDate, exportSessionsToCSV, isFlowSession } from '../domain/history'
import { formatElapsed } from '../domain/format'
import type { Session, Category } from '../domain/timer'

type Props = {
  sessions: Session[]
  categories: Category[]
}

function formatTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16)
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

export function HistoryView({ sessions, categories }: Props) {
  const groups = groupSessionsByDate(sessions, categories)

  function handleExportCSV() {
    const csv = exportSessionsToCSV(sessions, categories)
    downloadBlob(csv, 'sessions.csv', 'text/csv')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">History</h2>
        <button
          className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
          onClick={handleExportCSV}
        >
          Export CSV
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-700">No history yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map(day => (
            <div key={day.date}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{day.date}</span>
                <span className="font-mono text-xs text-zinc-600">{formatElapsed(day.totalMs)}</span>
              </div>
              <ul className="space-y-2">
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
