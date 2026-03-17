import { computeDistractionBudget } from '../domain/distractionBudget'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { DistractionRule } from '../domain/distractionBudget'

type Props = {
  blocks: CaptureBlock[]
  budgetMs?: number
  rules?: DistractionRule[]
}

function formatMs(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function DistractionBudgetWidget({ blocks, budgetMs = 30 * 60_000, rules }: Props) {
  const status = computeDistractionBudget(blocks, rules, budgetMs)

  const barColor = status.overBudget
    ? 'bg-red-500'
    : status.pctUsed >= 80
      ? 'bg-orange-500'
      : 'bg-emerald-500'

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/2 px-4 py-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-zinc-300">🎯 Distraction Budget</span>
        <span className={`text-xs font-mono ${status.overBudget ? 'text-red-400' : 'text-zinc-500'}`}>
          {formatMs(status.usedMs)} / {formatMs(status.budgetMs)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${status.pctUsed}%` }}
          role="progressbar"
          aria-valuenow={status.pctUsed}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {status.topDistractors.length > 0 && (
        <ul className="space-y-1">
          {status.topDistractors.map(d => (
            <li key={d.label} className="flex justify-between text-xs text-zinc-500">
              <span>{d.label}</span>
              <span className="font-mono">{formatMs(d.usedMs)}</span>
            </li>
          ))}
        </ul>
      )}

      {status.overBudget && (
        <p className="mt-2 text-xs text-red-400">
          Over budget by {formatMs(status.usedMs - status.budgetMs)}
        </p>
      )}

      {!status.overBudget && status.usedMs === 0 && (
        <p className="text-xs text-zinc-600">No distraction apps detected today.</p>
      )}
    </div>
  )
}
