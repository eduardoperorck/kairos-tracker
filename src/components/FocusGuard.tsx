import { useState, useEffect } from 'react'
import { remainingBreakMs, getBreakSuggestions } from '../domain/focusGuard'
import type { FocusPreset } from '../domain/focusGuard'

type Props = {
  activeCategory: string | null
  startedAt: number | null
  preset: FocusPreset
  allowPostpone: boolean
  onBreakComplete: () => void
  onPostpone: () => void
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const suggestions = getBreakSuggestions()

export function FocusGuard({ activeCategory, startedAt: _startedAt, preset, allowPostpone, onBreakComplete, onPostpone }: Props) {
  const [breakStartedAt] = useState(() => Date.now())
  const [remaining, setRemaining] = useState(() => preset.breakMs)
  const [skipped, setSkipped] = useState(false)
  const [skipInput, setSkipInput] = useState('')
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [suggestionIdx] = useState(() => Math.floor(Math.random() * suggestions.length))

  useEffect(() => {
    if (skipped) return
    const id = setInterval(() => {
      const rem = remainingBreakMs(breakStartedAt, Date.now(), preset.breakMs)
      setRemaining(rem)
      if (rem === 0) {
        clearInterval(id)
        onBreakComplete()
      }
    }, 500)
    return () => clearInterval(id)
  }, [breakStartedAt, preset.breakMs, onBreakComplete, skipped])

  if (skipped) return null

  function handleSkipAttempt() {
    if (allowPostpone) {
      // First escape attempt: offer postpone instead
      setShowSkipConfirm(true)
    } else {
      // Postpone already used: require typing SKIP
      setShowSkipConfirm(true)
    }
  }

  function handleConfirmSkip() {
    if (!allowPostpone && skipInput !== 'SKIP') return
    setSkipped(true)
    onBreakComplete()
  }

  const focusedMins = Math.round((Date.now() - (_startedAt ?? Date.now())) / 60_000)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative pointer-events-auto rounded-2xl border border-white/[0.1] bg-zinc-900 px-10 py-8 shadow-2xl text-center max-w-sm w-full mx-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">{preset.name} · Break time</p>

        {activeCategory && (
          <p className="mb-1 text-sm text-zinc-400">{activeCategory}</p>
        )}

        {focusedMins > 0 && (
          <p className="mb-4 text-xs text-zinc-600">You focused for {focusedMins} min — you earned this.</p>
        )}

        <p className="mb-6 font-mono text-5xl tabular-nums text-emerald-400">
          {formatCountdown(remaining)}
        </p>

        <p className="mb-8 text-sm text-zinc-400 italic">{suggestions[suggestionIdx]}</p>

        {!showSkipConfirm ? (
          <button
            className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
            onClick={handleSkipAttempt}
          >
            {allowPostpone ? 'Skip / Postpone' : 'Skip break'}
          </button>
        ) : allowPostpone ? (
          <div className="space-y-2">
            <button
              className="block w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
              onClick={() => { setShowSkipConfirm(false); onPostpone() }}
            >
              Postpone 5 min
            </button>
            <button
              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
              onClick={() => { setSkipped(true); onBreakComplete() }}
            >
              Skip anyway
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-600">Type <span className="font-mono text-zinc-400">SKIP</span> to confirm</p>
            <input
              autoFocus
              className="w-full rounded border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-center font-mono text-xs text-zinc-100 outline-none focus:border-white/[0.2] transition-all"
              placeholder="SKIP"
              value={skipInput}
              onChange={e => setSkipInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleConfirmSkip()}
            />
            <button
              className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-30"
              disabled={skipInput !== 'SKIP'}
              onClick={handleConfirmSkip}
            >
              Confirm skip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
