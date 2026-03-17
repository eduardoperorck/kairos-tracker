import { useMemo } from 'react'
import { generateRecommendations } from '../domain/focusRecommendations'
import { useI18n } from '../i18n'
import type { Session } from '../domain/timer'
import type { CaptureBlock } from '../domain/passiveCapture'

type Props = {
  sessions: Session[]
  blocks: CaptureBlock[]
  meetingMinutesThisWeek?: number
  buildMinutesThisWeek?: number
  daysTracked?: number
}

export function RecommendationsView({ sessions, blocks, meetingMinutesThisWeek = 0, buildMinutesThisWeek = 0, daysTracked = 0 }: Props) {
  const { t } = useI18n()
  const recommendations = useMemo(() =>
    generateRecommendations({ sessions, blocks, meetingMinutesThisWeek, buildMinutesThisWeek, daysTracked }),
    [sessions, blocks, meetingMinutesThisWeek, buildMinutesThisWeek, daysTracked]
  )

  if (recommendations.length === 0) return null

  const priorityColors = {
    high: 'text-red-400 border-red-500/20 bg-red-500/5',
    medium: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
    low: 'text-zinc-500 border-white/[0.07] bg-white/[0.02]',
  }

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('recommendations.title')}</h3>
      <div className="space-y-2">
        {recommendations.slice(0, 3).map(rec => (
          <div key={rec.id} className={`rounded-lg border px-4 py-3 ${priorityColors[rec.priority]}`}>
            <p className="text-sm text-zinc-300">{rec.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
