import { useMemo } from 'react'
import { computeDailyFocusScore, getDailyFocusLabel, getDailyFocusColor } from '../domain/dailyFocusScore'
import { toDateString } from '../domain/timer'
import type { Session } from '../domain/timer'

type Props = {
  sessions: Session[]
}

const RADIUS = 28
const STROKE = 5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DailyFocusRing({ sessions }: Props) {
  const today = toDateString(Date.now())
  const todaySessions = useMemo(
    () => sessions.filter(s => s.date === today),
    [sessions, today]
  )
  const score = useMemo(() => computeDailyFocusScore(todaySessions), [todaySessions])
  const label = getDailyFocusLabel(score)
  const color = getDailyFocusColor(score)
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE
  const size = RADIUS * 2 + STROKE * 2

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
          <circle
            cx={size / 2} cy={size / 2} r={RADIUS}
            fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
          style={{ color }}
        >
          {score}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        <p className="text-[10px] text-zinc-600">Today's focus score</p>
      </div>
    </div>
  )
}
