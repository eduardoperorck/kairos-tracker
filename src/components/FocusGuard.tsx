import { useState, useEffect } from 'react'
import { remainingBreakMs } from '../domain/focusGuard'
import type { FocusPreset } from '../domain/focusGuard'

type Props = {
  activeCategory: string | null
  startedAt: number | null
  preset: FocusPreset
  onBreakComplete: () => void
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function FocusGuard({ activeCategory, startedAt: _startedAt, preset, onBreakComplete }: Props) {
  const [breakStartedAt] = useState(() => Date.now())
  const [remaining, setRemaining] = useState(() => preset.breakMs)
  const [skipped, setSkipped] = useState(false)

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      aria-live="polite"
    >
      {/* Backdrop — non-interactive */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card — interactive */}
      <div className="relative pointer-events-auto rounded-2xl border border-white/[0.1] bg-zinc-900 px-10 py-8 shadow-2xl text-center max-w-sm w-full mx-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">Break preset: {preset.name}</p>

        {activeCategory && (
          <p className="mb-4 text-sm text-zinc-400">{activeCategory}</p>
        )}

        <p className="mb-6 text-xl font-semibold text-zinc-100">Take a break</p>

        <p className="mb-6 font-mono text-5xl tabular-nums text-emerald-400">
          {formatCountdown(remaining)}
        </p>

        <button
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          onClick={() => { setSkipped(true); onBreakComplete() }}
        >
          Skip break
        </button>
      </div>
    </div>
  )
}
