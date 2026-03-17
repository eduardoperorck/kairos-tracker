import { formatElapsed } from '../domain/format'

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type Props = {
  elapsedMs: number
  cycleMs: number
  isFlow?: boolean
  isBreak?: boolean
}

export function CircularTimer({ elapsedMs, cycleMs, isFlow = false, isBreak = false }: Props) {
  const progress = Math.min(elapsedMs / cycleMs, 1)
  const offset = CIRCUMFERENCE * (1 - progress)
  const arcColor = isBreak ? '#3b82f6' : '#10b981' // blue for break, green for focus

  return (
    <div className={`relative inline-flex items-center justify-center ${isFlow ? 'animate-pulse' : ''}`}>
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        {/* Track */}
        <circle
          cx="64" cy="64" r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-zinc-800"
        />
        {/* Progress arc */}
        <circle
          cx="64" cy="64" r={RADIUS}
          fill="none"
          stroke={arcColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="absolute font-mono text-xl tabular-nums text-zinc-100">
        {formatElapsed(elapsedMs)}
      </span>
    </div>
  )
}
