import { formatElapsed } from '../domain/format'
import type { StatEntry } from '../domain/stats'

type Props = {
  stats: StatEntry[]
  onBack: () => void
}

export function StatsView({ stats, onBack }: Props) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-lg px-4 py-12">

        <div className="mb-8 flex items-center gap-4">
          <button
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
            onClick={onBack}
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-white">Statistics</h1>
        </div>

        {stats.length === 0 ? (
          <p className="mt-12 text-center text-sm text-zinc-600">No data yet.</p>
        ) : (
          <ul className="space-y-4">
            {stats.map(entry => (
              <li key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-100">{entry.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-zinc-300">
                      {formatElapsed(entry.totalMs)}
                    </span>
                    <span className="w-10 text-right text-xs text-zinc-500">
                      {entry.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${entry.percentage}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  )
}
