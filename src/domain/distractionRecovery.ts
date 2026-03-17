import type { CaptureBlock } from './passiveCapture'

export type DRTMetrics = {
  averageDrtMs: number
  byApp: Record<string, { avgMs: number; count: number }>
  trend: 'improving' | 'worsening' | 'stable'
  worstInterruptor: string | null
}

const FOCUS_THRESHOLD_MS = 10 * 60_000 // 10 min continuous focus

export function computeDRT(
  blocks: CaptureBlock[],
  distractionApps: string[],
  prevAverageDrtMs?: number
): DRTMetrics {
  if (blocks.length < 2) {
    return { averageDrtMs: 0, byApp: {}, trend: 'stable', worstInterruptor: null }
  }

  const isDistraction = (b: CaptureBlock) =>
    distractionApps.some(app => b.process.toLowerCase().includes(app.toLowerCase()))

  const isFocusBlock = (b: CaptureBlock) => (b.endedAt - b.startedAt) >= FOCUS_THRESHOLD_MS

  const byApp: Record<string, { total: number; count: number }> = {}
  const allDrtMs: number[] = []

  for (let i = 0; i < blocks.length - 1; i++) {
    const block = blocks[i]
    if (!isDistraction(block)) continue

    // Find next focus block after this distraction
    for (let j = i + 1; j < blocks.length; j++) {
      if (isFocusBlock(blocks[j])) {
        const drt = blocks[j].startedAt - block.endedAt
        if (drt >= 0) {
          allDrtMs.push(drt)
          const key = block.process
          if (!byApp[key]) byApp[key] = { total: 0, count: 0 }
          byApp[key].total += drt
          byApp[key].count++
        }
        break
      }
    }
  }

  const averageDrtMs = allDrtMs.length > 0
    ? allDrtMs.reduce((a, b) => a + b, 0) / allDrtMs.length
    : 0

  const byAppResult: DRTMetrics['byApp'] = {}
  let worstMs = 0
  let worstInterruptor: string | null = null
  for (const [app, data] of Object.entries(byApp)) {
    const avg = data.total / data.count
    byAppResult[app] = { avgMs: avg, count: data.count }
    if (avg > worstMs) { worstMs = avg; worstInterruptor = app }
  }

  let trend: 'improving' | 'worsening' | 'stable' = 'stable'
  if (prevAverageDrtMs !== undefined && allDrtMs.length > 0) {
    const diff = averageDrtMs - prevAverageDrtMs
    if (diff < -60_000) trend = 'improving'   // improved by > 1 min
    else if (diff > 60_000) trend = 'worsening' // worsened by > 1 min
  }

  return { averageDrtMs, byApp: byAppResult, trend, worstInterruptor }
}
