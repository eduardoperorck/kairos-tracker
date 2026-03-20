import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { formatElapsed, formatLocalTime } from '../domain/format'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { Category } from '../domain/timer'

const FLOW_THRESHOLD_MS = 45 * 60_000
const GAP_THRESHOLD_MS = 5 * 60_000

type GapSegment = { type: 'gap'; startedAt: number; endedAt: number }
type BlockSegment = { type: 'block'; block: CaptureBlock }
type Segment = BlockSegment | GapSegment

type Props = {
  blocks: CaptureBlock[]
  categories: Category[]
}

function formatTimeLabel(ms: number): string {
  return formatLocalTime(ms)
}

function categoryColor(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return '#52525b'
  return categories.find(c => c.id === categoryId)?.color ?? '#52525b'
}

function categoryName(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return ''
  return categories.find(c => c.id === categoryId)?.name ?? ''
}

export function ActivityTimeline({ blocks, categories }: Props) {
  const { t } = useI18n()

  const sorted = useMemo(
    () => [...blocks].sort((a, b) => a.startedAt - b.startedAt),
    [blocks]
  )

  const segments = useMemo<Segment[]>(() => {
    if (sorted.length === 0) return []
    const segs: Segment[] = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        const prev = sorted[i - 1]
        const gap = sorted[i].startedAt - prev.endedAt
        if (gap > GAP_THRESHOLD_MS) {
          segs.push({ type: 'gap', startedAt: prev.endedAt, endedAt: sorted[i].startedAt })
        }
      }
      segs.push({ type: 'block', block: sorted[i] })
    }
    return segs
  }, [sorted])

  const rangeStart = sorted[0]?.startedAt ?? 0
  const rangeEnd = sorted[sorted.length - 1]?.endedAt ?? 0
  const rangeDuration = Math.max(rangeEnd - rangeStart, 1)

  // Generate hour tick labels
  const hourTicks = useMemo(() => {
    if (sorted.length === 0) return []
    const ticks: { ms: number; label: string }[] = []
    const firstHour = Math.floor(rangeStart / 3_600_000) * 3_600_000
    for (let t = firstHour; t <= rangeEnd; t += 3_600_000) {
      if (t >= rangeStart) ticks.push({ ms: t, label: formatTimeLabel(t) })
    }
    return ticks
  }, [sorted, rangeStart, rangeEnd])

  if (sorted.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-zinc-700">
        {t('timeline.empty')}
      </p>
    )
  }

  function pct(ms: number): string {
    return `${((ms - rangeStart) / rangeDuration) * 100}%`
  }
  function widthPct(durationMs: number): string {
    return `${(durationMs / rangeDuration) * 100}%`
  }

  return (
    <div className="mt-4">
      {/* Hour tick ruler */}
      <div className="relative h-4 mb-1">
        {hourTicks.map(tick => (
          <span
            key={tick.ms}
            className="absolute text-[10px] text-zinc-700 -translate-x-1/2"
            style={{ left: pct(tick.ms) }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      {/* Timeline bar */}
      <div className="relative h-10 rounded-md bg-zinc-900 overflow-hidden">
        {segments.map((seg, i) => {
          if (seg.type === 'gap') {
            const w = widthPct(seg.endedAt - seg.startedAt)
            const l = pct(seg.startedAt)
            return (
              <div
                key={`gap-${i}`}
                className="absolute top-0 h-full bg-zinc-800/50 border-x border-zinc-700/30 flex items-center justify-center"
                style={{ left: l, width: w }}
                title={`${t('timeline.untrackedTitle')} — ${formatElapsed(seg.endedAt - seg.startedAt)}`}
              >
                {(seg.endedAt - seg.startedAt) > 20 * 60_000 && (
                  <span className="text-[9px] text-zinc-600">{t('timeline.untracked')}</span>
                )}
              </div>
            )
          }

          const { block } = seg
          const dur = block.endedAt - block.startedAt
          const flow = dur >= FLOW_THRESHOLD_MS
          const color = categoryColor(block.categoryId, categories)
          const name = categoryName(block.categoryId, categories)

          return (
            <div
              key={`block-${i}`}
              className="absolute top-0 h-full flex items-center gap-1 px-1.5 overflow-hidden group cursor-default"
              style={{
                left: pct(block.startedAt),
                width: widthPct(dur),
                backgroundColor: color + '33',
                borderLeft: `2px solid ${color}88`,
              }}
              title={`${block.process}${name ? ` · ${name}` : ''} — ${formatElapsed(dur)}`}
            >
              <span className="text-[10px] text-zinc-300 truncate">{block.process}</span>
              {name && <span className="text-[9px] text-zinc-500 truncate hidden group-hover:inline">{name}</span>}
              {flow && <span className="text-[10px] text-amber-400 shrink-0">⚡</span>}
            </div>
          )
        })}
      </div>

      {/* Duration summary */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-700">
        <span>{formatTimeLabel(rangeStart)}</span>
        <span>{formatElapsed(rangeDuration)} {t('timeline.trackedWindow')}</span>
        <span>{formatTimeLabel(rangeEnd)}</span>
      </div>
    </div>
  )
}
