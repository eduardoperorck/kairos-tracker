import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../i18n'

type Props = {
  weeklyMs: number
  goalMs: number
  onSetGoal: (ms: number) => void
  suggestedMs?: number
  todayMs?: number
}

function formatGoalHours(ms: number): string {
  const h = ms / 3_600_000
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function formatWeekly(ms: number): string {
  if (ms < 60_000) return '0m'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function CategoryGoal({ weeklyMs, goalMs, onSetGoal, suggestedMs, todayMs = 0 }: Props) {
  const { t } = useI18n()
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const goalInputRef = useRef<HTMLInputElement>(null)

  const goalProgress = goalMs > 0 ? Math.min(weeklyMs / goalMs, 1) : 0
  const goalPercent = Math.round(goalProgress * 100)
  const todayPercent = goalMs > 0 ? Math.min(todayMs / goalMs, 1) * 100 : 0
  const priorPercent = Math.max(goalPercent - todayPercent, 0)

  const barColor =
    goalPercent >= 100 ? 'bg-emerald-400' :
    goalPercent >= 80  ? 'bg-amber-400' :
    goalPercent >= 50  ? 'bg-indigo-400' :
    'bg-zinc-500'

  const percentColor =
    goalPercent >= 100 ? 'text-emerald-400' :
    goalPercent >= 80  ? 'text-amber-400' :
    'text-zinc-500'

  useEffect(() => {
    if (editingGoal) goalInputRef.current?.focus()
  }, [editingGoal])

  function commitGoal() {
    const hours = parseFloat(goalDraft)
    if (!isNaN(hours) && hours > 0) onSetGoal(Math.round(hours * 3_600_000))
    setEditingGoal(false)
    setGoalDraft('')
  }

  function cancelGoal() {
    setEditingGoal(false)
    setGoalDraft('')
  }

  return (
    <>
      {goalMs > 0 && !editingGoal && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">{t('stats.thisWeek')}</span>
              {todayMs > 0 && (
                <span className="text-[10px] text-zinc-600">+{formatWeekly(todayMs)} {t('goal.today')}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="font-mono text-xs tabular-nums text-zinc-500 hover:text-zinc-300 transition-colors"
                onClick={() => { setGoalDraft(String(goalMs / 3_600_000)); setEditingGoal(true) }}
                aria-label="Edit goal"
              >
                {formatWeekly(weeklyMs)} / {formatGoalHours(goalMs)}
              </button>
              <span className={`text-xs tabular-nums font-medium ${percentColor}`}>
                {goalPercent}%
              </span>
            </div>
          </div>
          <div className={`relative h-1.5 w-full rounded-full bg-white/5 overflow-hidden${goalPercent >= 100 ? ' animate-pulse' : ''}`}>
            {/* Prior days this week */}
            <div
              className={`absolute left-0 h-full rounded-full transition-all ${barColor} opacity-40`}
              style={{ width: `${priorPercent}%` }}
            />
            {/* Today's contribution — brighter */}
            <div
              className={`absolute h-full rounded-full transition-all ${barColor}`}
              style={{ left: `${priorPercent}%`, width: `${todayPercent}%` }}
            />
          </div>
          {suggestedMs !== undefined && suggestedMs > 0 && Math.abs(suggestedMs - goalMs) / goalMs > 0.15 && (
            <button
              className="mt-1.5 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
              onClick={() => onSetGoal(suggestedMs)}
              title="Auto-calibrate goal based on recent averages"
            >
              {t('goal.recalibrate')} {formatWeekly(suggestedMs)}?
            </button>
          )}
        </div>
      )}

      {editingGoal && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                ref={goalInputRef}
                aria-label="Weekly goal hours"
                type="text"
                inputMode="decimal"
                placeholder="0"
                className="w-16 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-center text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-white/20 tabular-nums"
                value={goalDraft}
                onChange={e => setGoalDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitGoal()
                  if (e.key === 'Escape') cancelGoal()
                }}
                onBlur={e => {
                  // Only commit on blur if not clicking "Use suggestion"
                  if (!e.relatedTarget?.closest('[data-suggestion]')) commitGoal()
                }}
              />
              <span className="text-xs text-zinc-500">{t('goal.hoursPerWeek')}</span>
            </div>
            {suggestedMs !== undefined && suggestedMs > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">{t('goal.suggested')} {formatWeekly(suggestedMs)}</span>
                <button
                  data-suggestion
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSetGoal(suggestedMs); setEditingGoal(false); setGoalDraft('') }}
                >
                  {t('goal.useSuggestion')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!editingGoal && goalMs === 0 && (
        <div className="mt-2">
          <button
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100"
            onClick={() => { setGoalDraft(''); setEditingGoal(true) }}
          >
            {t('goal.setWeekly')}
          </button>
        </div>
      )}
    </>
  )
}
