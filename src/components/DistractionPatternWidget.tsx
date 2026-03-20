import { useMemo } from 'react'
import { detectDistractionApps } from '../domain/passiveCapture'
import { formatElapsed } from '../domain/format'
import { useI18n } from '../i18n'
import type { CaptureBlock } from '../domain/passiveCapture'

type Props = {
  blocks: CaptureBlock[]
}

export function DistractionPatternWidget({ blocks }: Props) {
  const { t } = useI18n()
  const distractions = useMemo(() => {
    if (blocks.length === 0) return []
    // Require at least 7 days of data
    const oldest = Math.min(...blocks.map(b => b.startedAt))
    const newest = Math.max(...blocks.map(b => b.endedAt))
    if (newest - oldest < 7 * 86_400_000) return []
    return detectDistractionApps(blocks)
  }, [blocks])

  if (distractions.length === 0) return null

  return (
    <div className="mt-4 rounded-lg border border-orange-500/15 bg-orange-500/[0.05] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-orange-400">{t('distraction.patterns')}</span>
        <span className="text-[10px] text-zinc-600">{t('distraction.shortVisits')}</span>
      </div>
      <ul className="space-y-1">
        {distractions.slice(0, 5).map(d => (
          <li key={d.process} className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">{d.process}</span>
            <span className="text-zinc-600">
              {d.visitCount}{t('distraction.visitsAvg')} {formatElapsed(d.avgDurationMs)}
            </span>
          </li>
        ))}
      </ul>
      {distractions.length > 5 && (
        <p className="mt-1 text-[10px] text-zinc-600">+{distractions.length - 5} more</p>
      )}
    </div>
  )
}
