import { analyzeInputActivity } from '../domain/inputIntelligence'
import type { InputActivity } from '../domain/inputIntelligence'

type Props = {
  activity: InputActivity
}

const INTENSITY_STYLES: Record<string, string> = {
  idle: 'text-zinc-600',
  light: 'text-zinc-400',
  moderate: 'text-sky-400',
  active: 'text-indigo-400',
  intense: 'text-violet-400',
}

const INTENSITY_BARS: Record<string, number> = {
  idle: 0,
  light: 1,
  moderate: 2,
  active: 3,
  intense: 4,
}

export function InputIntelligenceWidget({ activity }: Props) {
  const signal = analyzeInputActivity(activity)
  const barsFilled = INTENSITY_BARS[signal.intensity]
  const textColor = INTENSITY_STYLES[signal.intensity]

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-600">⌨️</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4].map(level => (
          <div
            key={level}
            className={`h-2.5 w-1 rounded-sm transition-colors ${
              level <= barsFilled ? 'bg-current' : 'bg-white/8'
            } ${textColor}`}
          />
        ))}
      </div>
      <span className={`capitalize ${textColor}`}>{signal.intensity}</span>
      <span className="text-zinc-700 font-mono">{Math.round(signal.keystrokesPerMin)}kpm</span>
    </div>
  )
}
