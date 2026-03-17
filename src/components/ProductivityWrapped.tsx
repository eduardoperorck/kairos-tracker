import { useState, useMemo } from 'react'
import { formatElapsed } from '../domain/format'
import { computeEnergyPattern, isFlowSession } from '../domain/history'
import { computeStreak, toDateString } from '../domain/timer'
import { useI18n } from '../i18n'
import type { Session, Category } from '../domain/timer'

type Props = {
  sessions: Session[]
  categories: Category[]
  onClose: () => void
}

type Slide = {
  emoji: string
  label: string
  value: string
  sub?: string
}

function buildSlides(sessions: Session[], categories: Category[]): Slide[] {
  if (sessions.length === 0) return []

  const totalMs = sessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)

  // Dominant category
  const msById: Record<string, number> = {}
  for (const s of sessions) {
    msById[s.categoryId] = (msById[s.categoryId] ?? 0) + (s.endedAt - s.startedAt)
  }
  const topId = Object.entries(msById).sort((a, b) => b[1] - a[1])[0]?.[0]
  const topCat = categories.find(c => c.id === topId)
  const topPct = topCat ? Math.round((msById[topId] / totalMs) * 100) : 0

  // Flow sessions
  const flowCount = sessions.filter(isFlowSession).length

  // Best streak across all categories
  const today = toDateString(Date.now())
  const bestStreak = Math.max(...categories.map(c =>
    computeStreak(sessions.filter(s => s.categoryId === c.id).map(s => s.date), today)
  ), 0)

  // Peak hour
  const energy = computeEnergyPattern(sessions, 30)
  const peakHour = energy.peakHours[0]

  // Best day of week
  const msByDow: Record<number, number> = {}
  for (const s of sessions) {
    const dow = new Date(s.date).getDay()
    msByDow[dow] = (msByDow[dow] ?? 0) + (s.endedAt - s.startedAt)
  }
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const bestDow = Object.entries(msByDow).sort((a, b) => Number(b[1]) - Number(a[1]))[0]

  const slides: Slide[] = [
    { emoji: '⏱', label: 'This month you tracked', value: formatElapsed(totalMs), sub: 'of focused time' },
  ]

  if (topCat) {
    slides.push({ emoji: '🏆', label: 'Your dominant category was', value: topCat.name, sub: `${topPct}% of your time` })
  }

  if (flowCount > 0) {
    slides.push({ emoji: '⚡', label: 'You entered flow state', value: `${flowCount} times`, sub: 'sessions longer than 45 min' })
  }

  if (bestStreak > 0) {
    slides.push({ emoji: '🔥', label: 'Your longest streak was', value: `${bestStreak} days`, sub: 'consecutive days tracked' })
  }

  if (peakHour !== undefined) {
    slides.push({ emoji: '🧠', label: 'Your peak focus hour is', value: `${peakHour}:00`, sub: 'based on your last 30 days' })
  }

  if (bestDow) {
    slides.push({ emoji: '📅', label: 'Your most productive day', value: DOW[Number(bestDow[0])], sub: formatElapsed(Number(bestDow[1])) + ' avg' })
  }

  return slides
}

export function ProductivityWrapped({ sessions, categories, onClose }: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const slides = useMemo(() => buildSlides(sessions, categories), [sessions, categories])

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Not enough data yet.</p>
          <button onClick={onClose} className="mt-4 text-xs text-zinc-600 hover:text-zinc-300">{t('wrapped.close')}</button>
        </div>
      </div>
    )
  }

  const slide = slides[step]
  const isLast = step === slides.length - 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-zinc-700 hover:text-zinc-300 transition-colors text-sm"
      >
        {t('wrapped.close')}
      </button>

      {/* Step indicator */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5">
        {slides.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-zinc-300' : 'w-2 bg-zinc-700'}`} />
        ))}
      </div>

      {/* Slide */}
      <div className="text-center px-8 max-w-md">
        <div className="text-6xl mb-8">{slide.emoji}</div>
        <p className="text-zinc-500 text-sm mb-3 uppercase tracking-widest">{slide.label}</p>
        <p className="text-5xl font-bold text-zinc-100 mb-3">{slide.value}</p>
        {slide.sub && <p className="text-zinc-600 text-sm">{slide.sub}</p>}
      </div>

      {/* Nav */}
      <div className="absolute bottom-10 flex gap-4">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Back
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-6 py-2.5 text-sm text-zinc-300 hover:text-zinc-100 transition-all"
          >
            {t('wrapped.next')}
          </button>
        ) : (
          <button
            onClick={onClose}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/20 transition-all"
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}
