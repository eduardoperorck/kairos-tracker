import { useState } from 'react'
import { useElapsed } from '../hooks/useElapsed'
import { formatElapsed } from '../domain/format'
import { useI18n } from '../i18n'
import type { Session, Category } from '../domain/timer'

type Props = {
  categoryName: string
  color?: string
  startedAt: number
  onStop: () => void
  onMeeting?: () => void
  isMeeting?: boolean
  presetName?: string
  classificationReason?: string | null
  todaySessions?: Session[]
  categories?: Category[]
}

function fmt2(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function SessionTimeline({ sessions, categories, currentStartedAt }: { sessions: Session[]; categories: Category[]; currentStartedAt: number }) {
  const now = Date.now()
  const allStarted = sessions.map(s => s.startedAt).concat([currentStartedAt])
  const dayStart = Math.min(...allStarted)
  const dayEnd = now
  const span = dayEnd - dayStart
  if (span <= 0) return null

  const catColorMap = new Map(categories.map(c => [c.id, c.color ?? '#10b981']))

  function toPercent(ts: number) {
    return Math.max(0, Math.min(100, ((ts - dayStart) / span) * 100))
  }

  const startHour = new Date(dayStart).getHours()
  const endHour = new Date(dayEnd).getHours()

  return (
    <div className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 pb-2">
      <div className="relative h-4 rounded bg-zinc-800/60 overflow-hidden">
        {sessions.map(s => {
          const left = toPercent(s.startedAt)
          const width = toPercent(s.endedAt) - left
          const color = catColorMap.get(s.categoryId) ?? '#52525b'
          return (
            <div
              key={s.id}
              title={`${new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              className="absolute inset-y-0 rounded-sm opacity-80"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%`, backgroundColor: color }}
            />
          )
        })}
        {/* Current session */}
        <div
          className="absolute inset-y-0 rounded-sm animate-pulse"
          style={{ left: `${toPercent(currentStartedAt)}%`, width: `${toPercent(now) - toPercent(currentStartedAt)}%`, backgroundColor: '#10b981', opacity: 0.9 }}
        />
        {/* Now marker */}
        <div className="absolute inset-y-0 w-0.5 bg-white/40" style={{ left: '100%' }} />
      </div>
      <div className="flex justify-between text-[9px] text-zinc-700 mt-0.5">
        <span>{fmt2(startHour)}</span>
        <span>{fmt2(endHour)}</span>
      </div>
    </div>
  )
}

export function ActiveTimerBar({ categoryName, color, startedAt, onStop, onMeeting, isMeeting, presetName, classificationReason, todaySessions, categories }: Props) {
  const { t } = useI18n()
  const liveMs = useElapsed(startedAt)
  const dot = color ?? '#10b981'
  const [showTimeline, setShowTimeline] = useState(false)

  return (
    <div
      className="border-b border-white/[0.06] transition-colors"
      style={{ backgroundColor: dot + '12', borderBottomColor: dot + '25' }}
      onMouseEnter={() => todaySessions && setShowTimeline(true)}
      onMouseLeave={() => setShowTimeline(false)}
    >
      <div className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 h-8 flex items-center gap-3">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
          style={{ backgroundColor: dot }}
        />
        <span className="text-xs font-medium text-zinc-200 flex-1 truncate">{categoryName}</span>
        {presetName && <span className="text-[10px] text-zinc-500">{presetName}</span>}
        {classificationReason && (
          <span className="text-[10px] text-zinc-600 ml-2">· {classificationReason}</span>
        )}
        <span className="font-mono text-xs tabular-nums text-zinc-400">{formatElapsed(liveMs)}</span>
        {onMeeting && (
          <button
            onClick={onMeeting}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors px-1"
          >
            {isMeeting ? t('meeting.end') : t('meeting.start')}
          </button>
        )}
        <button
          onClick={onStop}
          className="text-xs text-red-400 hover:text-red-300 transition-colors px-1"
        >
          {t('activeTimer.stop')}
        </button>
      </div>
      {showTimeline && todaySessions && todaySessions.length > 0 && categories && (
        <SessionTimeline
          sessions={todaySessions}
          categories={categories}
          currentStartedAt={startedAt}
        />
      )}
    </div>
  )
}
