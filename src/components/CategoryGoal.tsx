import { useState, useRef, useEffect } from 'react'
import { formatElapsed } from '../domain/format'

type Props = {
  weeklyMs: number
  goalMs: number
  onSetGoal: (ms: number) => void
  suggestedMs?: number
}

export function CategoryGoal({ weeklyMs, goalMs, onSetGoal, suggestedMs }: Props) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const goalInputRef = useRef<HTMLInputElement>(null)

  const goalProgress = goalMs > 0 ? Math.min(weeklyMs / goalMs, 1) : 0
  const goalPercent = Math.round(goalProgress * 100)

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
      {goalMs > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-zinc-600">This week</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-zinc-600">
                {formatElapsed(weeklyMs)} / {formatElapsed(goalMs)}
              </span>
              <span className={`text-xs tabular-nums ${goalPercent >= 100 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {goalPercent}%
              </span>
            </div>
          </div>
          <div className="h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${goalPercent >= 100 ? 'bg-emerald-400' : 'bg-zinc-600'}`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2">
        {editingGoal ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                ref={goalInputRef}
                aria-label="Weekly goal hours"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="Hours per week"
                className="w-36 bg-transparent border-b border-zinc-700 focus:border-zinc-500 py-0.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-colors tabular-nums"
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
              <span className="text-xs text-zinc-700">h/week</span>
            </div>
            {suggestedMs && suggestedMs > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">Suggested: {formatElapsed(suggestedMs)}</span>
                <button
                  data-suggestion
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onSetGoal(suggestedMs); setEditingGoal(false); setGoalDraft('') }}
                >
                  Use suggestion
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors opacity-0 group-hover:opacity-100"
            onClick={() => {
              setGoalDraft(goalMs > 0 ? String(goalMs / 3_600_000) : '')
              setEditingGoal(true)
            }}
          >
            {goalMs > 0 ? 'Edit goal' : 'Set weekly goal'}
          </button>
        )}
      </div>
    </>
  )
}
