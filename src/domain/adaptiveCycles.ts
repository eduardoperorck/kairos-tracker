import type { CaptureBlock } from './passiveCapture'

export type NaturalCycle = {
  focusMs: number
  breakMs: number
  confidence: number  // 0–1
  sampleCount: number
  stddevMs: number
}

const MIN_SESSION_MS = 10 * 60_000  // 10 min
const MIN_SAMPLES = 10

export function computeNaturalCycle(blocks: CaptureBlock[]): NaturalCycle | null {
  const confirmedBlocks = blocks.filter(b => b.categoryId !== null && b.confirmed)
  const durations = confirmedBlocks
    .map(b => b.endedAt - b.startedAt)
    .filter(d => d >= MIN_SESSION_MS)

  if (durations.length < MIN_SAMPLES) return null

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  const variance = durations.map(d => (d - mean) ** 2).reduce((a, b) => a + b, 0) / durations.length
  const stddev = Math.sqrt(variance)
  const confidence = Math.min(durations.length / 30, 1)

  // Compute actual break durations from inter-block gaps
  const sortedBlocks = [...confirmedBlocks].sort((a, b) => a.startedAt - b.startedAt)
  const breakGaps: number[] = []
  for (let i = 1; i < sortedBlocks.length; i++) {
    const gap = sortedBlocks[i].startedAt - sortedBlocks[i - 1].endedAt
    const MIN_BREAK = 60_000        // 1 minute
    const MAX_BREAK = 60 * 60_000   // 60 minutes
    if (gap >= MIN_BREAK && gap <= MAX_BREAK) {
      breakGaps.push(gap)
    }
  }

  // Use median of gap durations if we have enough samples, otherwise fall back to 25% heuristic
  const breakMs = breakGaps.length >= 3
    ? (() => {
        const sorted = [...breakGaps].sort((a, b) => a - b)
        return sorted[Math.floor(sorted.length / 2)]
      })()
    : Math.round(mean * 0.25)

  return {
    focusMs: Math.round(mean),
    breakMs,
    confidence,
    sampleCount: durations.length,
    stddevMs: Math.round(stddev),
  }
}

export function formatCycleDescription(cycle: NaturalCycle): string {
  const focusMin = Math.round(cycle.focusMs / 60_000)
  const breakMin = Math.round(cycle.breakMs / 60_000)
  const confidencePct = Math.round(cycle.confidence * 100)
  return `${focusMin}m focus / ${breakMin}m break — based on ${cycle.sampleCount} sessions (${confidencePct}% confidence)`
}
