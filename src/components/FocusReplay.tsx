import { useEffect, useRef, useState } from 'react'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { Session } from '../domain/timer'

export type FocusReplayProps = {
  blocks: CaptureBlock[]
  sessions: Session[]
  categories: { id: string; name: string; color?: string }[]
  date: string  // YYYY-MM-DD
  onClose?: () => void
}

/** Convert a YYYY-MM-DD date + hour offset to Unix ms for that day */
function dayStart(date: string): number {
  return new Date(date + 'T00:00:00').getTime()
}

const DAY_MS = 24 * 60 * 60 * 1_000

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const CATEGORY_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
]

function getCategoryColor(
  categoryId: string | null,
  categories: { id: string; name: string; color?: string }[],
  index: number
): string {
  if (!categoryId) return '#52525b' // zinc-600
  const cat = categories.find(c => c.id === categoryId)
  if (cat?.color) return cat.color
  const idx = categories.findIndex(c => c.id === categoryId)
  return CATEGORY_COLORS[(idx >= 0 ? idx : index) % CATEGORY_COLORS.length]
}

type Segment = {
  startFrac: number  // 0–1 fraction of the day
  endFrac: number
  color: string
  label: string
}

/** Build segments from both capture blocks and sessions for the given date */
function buildSegments(
  date: string,
  blocks: CaptureBlock[],
  sessions: Session[],
  categories: { id: string; name: string; color?: string }[]
): Segment[] {
  const start = dayStart(date)
  const end = start + DAY_MS
  const segments: Segment[] = []

  // Add capture blocks
  blocks.forEach((block, i) => {
    if (block.startedAt >= end || block.endedAt <= start) return
    const s = clamp(block.startedAt, start, end)
    const e = clamp(block.endedAt, start, end)
    if (e <= s) return
    segments.push({
      startFrac: (s - start) / DAY_MS,
      endFrac: (e - start) / DAY_MS,
      color: getCategoryColor(block.categoryId, categories, i),
      label: block.process,
    })
  })

  // Add timer sessions on top
  sessions.forEach((session) => {
    if (session.date !== date) return
    const s = clamp(session.startedAt, start, end)
    const e = clamp(session.endedAt, start, end)
    if (e <= s) return
    const cat = categories.find(c => c.id === session.categoryId)
    segments.push({
      startFrac: (s - start) / DAY_MS,
      endFrac: (e - start) / DAY_MS,
      color: getCategoryColor(session.categoryId, categories, 0),
      label: cat?.name ?? session.categoryId,
    })
  })

  return segments.sort((a, b) => a.startFrac - b.startFrac)
}

const ANIM_DURATION_MS = 3_000

export function FocusReplay({ blocks, sessions, categories, date, onClose }: FocusReplayProps) {
  const segments = buildSegments(date, blocks, sessions, categories)
  const [progress, setProgress] = useState(0)  // 0–1
  const [playing, setPlaying] = useState(true)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    startTimeRef.current = null

    function tick(now: number) {
      if (startTimeRef.current === null) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const p = Math.min(elapsed / ANIM_DURATION_MS, 1)
      setProgress(p)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setPlaying(false)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [playing])

  const SVG_W = 800
  const SVG_H = 80
  const TRACK_Y = 30
  const TRACK_H = 28
  const HOUR_TICKS = [0, 6, 12, 18, 24]

  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">Replay — {date}</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setProgress(0); setPlaying(true) }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-white/[0.07] rounded px-2 py-0.5"
          >
            ↺ Replay
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ height: SVG_H }}
        aria-label="Focus replay timeline"
        role="img"
      >
        {/* Track background */}
        <rect x={0} y={TRACK_Y} width={SVG_W} height={TRACK_H} rx={4} fill="#27272a" />

        {/* Segments clipped to current progress */}
        {segments.map((seg, i) => {
          const x = seg.startFrac * SVG_W
          // Only show up to current progress position
          const visibleEndFrac = Math.min(seg.endFrac, progress)
          if (visibleEndFrac <= seg.startFrac) return null
          const visibleW = (visibleEndFrac - seg.startFrac) * SVG_W
          return (
            <rect
              key={`${seg.label}-${i}`}
              x={x}
              y={TRACK_Y}
              width={visibleW}
              height={TRACK_H}
              rx={2}
              fill={seg.color}
              opacity={0.8}
            >
              <title>{seg.label}</title>
            </rect>
          )
        })}

        {/* Hour tick marks */}
        {HOUR_TICKS.map(h => {
          const frac = h / 24
          const x = frac * SVG_W
          return (
            <g key={h}>
              <line x1={x} y1={TRACK_Y - 4} x2={x} y2={TRACK_Y + TRACK_H + 4} stroke="#3f3f46" strokeWidth={1} />
              <text x={x} y={TRACK_Y + TRACK_H + 14} textAnchor="middle" fill="#71717a" fontSize={10}>
                {h === 24 ? '0' : `${h}h`}
              </text>
            </g>
          )
        })}

        {/* Progress cursor */}
        {playing && (
          <line
            x1={progress * SVG_W}
            y1={TRACK_Y - 6}
            x2={progress * SVG_W}
            y2={TRACK_Y + TRACK_H + 6}
            stroke="#e4e4e7"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Legend */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {categories.map((cat, i) => (
            <div key={cat.id} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: cat.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
              />
              <span className="text-xs text-zinc-500">{cat.name}</span>
            </div>
          ))}
        </div>
      )}

      {segments.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-2">No activity recorded for this day.</p>
      )}
    </div>
  )
}
