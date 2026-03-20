import { useState, useEffect } from 'react'
import { remainingBreakMs } from '../domain/focusGuard'
import { useI18n } from '../i18n'
import type { TKey } from '../i18n'
import type { FocusPreset } from '../domain/focusGuard'

type Props = {
  activeCategory: string | null
  startedAt: number | null
  preset: FocusPreset
  allowPostpone: boolean
  strictMode?: boolean
  onBreakComplete: () => void
  onPostpone: () => void
  onBreakSkipped?: () => void
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const SUGGESTION_KEYS: TKey[] = [
  'focusGuard.suggestion0',
  'focusGuard.suggestion1',
  'focusGuard.suggestion2',
  'focusGuard.suggestion3',
  'focusGuard.suggestion4',
]

export function FocusGuard({ activeCategory, startedAt: _startedAt, preset, allowPostpone, strictMode = false, onBreakComplete, onPostpone, onBreakSkipped }: Props) {
  const { t } = useI18n()
  const [breakStartedAt] = useState(() => Date.now())
  const [remaining, setRemaining] = useState(() => preset.breakMs)
  const [skipped, setSkipped] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [suggestionIdx] = useState(() => Math.floor(Math.random() * SUGGESTION_KEYS.length))

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
    if (strictMode) return // strict mode: no skip allowed
    setShowSkipConfirm(true)
  }

  const focusedMins = Math.round((Date.now() - (_startedAt ?? Date.now())) / 60_000)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative pointer-events-auto rounded-2xl border border-white/[0.1] bg-zinc-900 px-10 py-8 shadow-2xl text-center max-w-sm w-full mx-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-zinc-500">{preset.name} · {t('focusGuard.breakTime')}</p>

        {activeCategory && (
          <p className="mb-1 text-sm text-zinc-400">{activeCategory}</p>
        )}

        {focusedMins > 0 && (
          <p className="mb-4 text-xs text-zinc-600">{t('focusGuard.focused')} {focusedMins} {t('focusGuard.earned')}</p>
        )}

        <p className="mb-6 font-mono text-5xl tabular-nums text-emerald-400">
          {formatCountdown(remaining)}
        </p>

        <p className="mb-8 text-sm text-zinc-400 italic">{t(SUGGESTION_KEYS[suggestionIdx])}</p>

        {strictMode ? (
          <p className="text-xs text-zinc-700 italic">{t('focusGuard.strict')}</p>
        ) : !showSkipConfirm ? (
          <button
            className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
            onClick={handleSkipAttempt}
          >
            {allowPostpone ? t('focusGuard.skipPostpone') : t('focusGuard.skipBreak')}
          </button>
        ) : allowPostpone ? (
          <div className="space-y-2">
            <button
              className="block w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
              onClick={() => { setShowSkipConfirm(false); onPostpone() }}
            >
              {t('focusGuard.postpone5')}
            </button>
            <button
              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
              onClick={() => { setSkipped(true); onBreakSkipped?.(); onBreakComplete() }}
            >
              {t('focusGuard.skipAnyway')}
            </button>
          </div>
        ) : (
          <button
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            onClick={() => { setSkipped(true); onBreakSkipped?.(); onBreakComplete() }}
          >
            {t('focusGuard.skipBreak')}
          </button>
        )}
      </div>
    </div>
  )
}
