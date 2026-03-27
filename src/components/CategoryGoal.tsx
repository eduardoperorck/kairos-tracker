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
    'bg-zinc-600'

  const percentColor =
    goalPercent >= 100 ? 'text-emerald-400' :
    goalPercent >= 80  ? 'text-amber-400' :
    'text-zinc-600'

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

  if (editingGoal) {
    return (
      <div className="px-3 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <input
            ref={goalInputRef}
            aria-label="Weekly goal hours"
            type="text"
            inputMode="decimal"
            placeholder="0"
            className="w-12 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-center text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/20 tabular-nums"
            value={goalDraft}
            onChange={e => setGoalDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitGoal()
              if (e.key === 'Escape') cancelGoal()
            }}
            onBlur={e => {
              if (!e.relatedTarget?.closest('[data-suggestion]')) commitGoal()
            }}
          />
          <span className="text-[10px] text-zinc-600">{t('goal.hoursPerWeek')}</span>
          {suggestedMs !== undefined && suggestedMs > 0 && (
            <button
              data-suggestion
              className="text-[10px] text-zinc-600 hover:text-zinc-300 underline transition-colors"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSetGoal(suggestedMs); setEditingGoal(false); setGoalDraft('') }}
            >
              {t('goal.useSuggestion')} {formatWeekly(suggestedMs)}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (goalMs === 0) {
    return (
      <div className="px-3 pb-1.5">
        <button
          className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors"
          onClick={() => { setGoalDraft(''); setEditingGoal(true) }}
        >
          {t('goal.setWeekly')}
        </button>
      </div>
    )
  }

  // Goal set — thin progress bar + stats on hover
  return (
    <div className="group/goal px-3 pb-2">
      {/* Stats row — visible only on hover */}
      <div className="flex items-center justify-between mb-1 h-3 overflow-hidden">
        <span className="text-[10px] text-zinc-700 opacity-0 group-hover/goal:opacity-100 transition-opacity">
          {formatWeekly(weeklyMs)} / {formatGoalHours(goalMs)}
          {todayMs > 0 && <span className="ml-1 text-zinc-800">+{formatWeekly(todayMs)} {t('goal.today')}</span>}
        </span>
        <button
          className={`text-[10px] tabular-nums opacity-0 group-hover/goal:opacity-100 transition-opacity ${percentColor}`}
          onClick={() => { setGoalDraft(String(goalMs / 3_600_000)); setEditingGoal(true) }}
          aria-label="Edit goal"
        >
          {goalPercent}%
        </button>
      </div>

      {/* Progress bar — always visible, 1px thin */}
      <div className={`relative h-px w-full rounded-full bg-white/[0.06] overflow-hidden${goalPercent >= 100 ? ' animate-pulse' : ''}`}>
        <div
          className={`absolute left-0 h-full rounded-full ${barColor} opacity-30`}
          style={{ width: `${priorPercent}%` }}
        />
        <div
          className={`absolute h-full rounded-full ${barColor}`}
          style={{ left: `${priorPercent}%`, width: `${todayPercent}%` }}
        />
      </div>

      {suggestedMs !== undefined && suggestedMs > 0 && Math.abs(suggestedMs - goalMs) / goalMs > 0.15 && (
        <button
          className="mt-1 text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover/goal:opacity-100"
          onClick={() => onSetGoal(suggestedMs)}
        >
          {t('goal.recalibrate')} {formatWeekly(suggestedMs)}?
        </button>
      )}
    </div>
  )
}
