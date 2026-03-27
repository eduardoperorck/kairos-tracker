import { useI18n } from '../i18n'
import type { Session } from '../domain/timer'

/** M88: Recovery time per context switch — 23 minutes per research */
const RECOVERY_MIN = 23

type Props = {
  sessions: Session[]
  date: string        // YYYY-MM-DD — only sessions on this date are considered
  hourlyRate?: number // from settings; undefined = not configured
}

/**
 * Count category switches in a day's sessions (ordered by startedAt).
 * A switch happens whenever the category changes from one session to the next.
 */
function countContextSwitches(sessions: Session[], date: string): number {
  const ordered = sessions
    .filter(s => s.date === date)
    .sort((a, b) => a.startedAt - b.startedAt)

  let switches = 0
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].categoryId !== ordered[i - 1].categoryId) switches++
  }
  return switches
}

export function InterruptCostWidget({ sessions, date, hourlyRate }: Props) {
  const { t } = useI18n()

  const switches = countContextSwitches(sessions, date)
  const lostMinutes = switches * RECOVERY_MIN
  const lostHours = lostMinutes / 60
  const cost = hourlyRate !== undefined ? lostHours * hourlyRate : null

  if (switches === 0) return null

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-xs space-y-1">
      <p className="font-medium text-amber-300 text-[11px] uppercase tracking-wider">{t('interrupt.title')}</p>
      <div className="flex flex-wrap gap-4 mt-1">
        <div>
          <span className="text-2xl font-semibold text-zinc-100">{switches}</span>
          <span className="ml-1 text-zinc-500">{t('interrupt.switches')}</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-amber-300">~{lostMinutes}</span>
          <span className="ml-1 text-zinc-500">{t('interrupt.lost')}</span>
        </div>
        {cost !== null && (
          <div>
            <span className="text-2xl font-semibold text-red-400">${cost.toFixed(0)}</span>
            <span className="ml-1 text-zinc-500">{t('interrupt.cost')}</span>
          </div>
        )}
      </div>
      {cost === null && (
        <p className="text-zinc-600 text-[10px]">{t('interrupt.noRate')}</p>
      )}
    </div>
  )
}
