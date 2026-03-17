import type { CaptureBlock } from './passiveCapture'

export type DayMode = 'maker' | 'manager' | 'mixed' | 'unknown'

export type DayClassification = {
  mode: DayMode
  makerPct: number // percentage of blocks ≥ 30min
  managerPct: number
  totalBlocks: number
  longestBlockMs: number
}

const MAKER_THRESHOLD_MS = 30 * 60_000 // 30 minutes

export function classifyDay(blocks: CaptureBlock[]): DayClassification {
  if (blocks.length === 0) {
    return { mode: 'unknown', makerPct: 0, managerPct: 0, totalBlocks: 0, longestBlockMs: 0 }
  }

  const durations = blocks.map(b => b.endedAt - b.startedAt)
  const longestBlockMs = Math.max(...durations)
  const makerBlocks = durations.filter(d => d >= MAKER_THRESHOLD_MS).length
  const managerBlocks = durations.filter(d => d < MAKER_THRESHOLD_MS).length

  const total = blocks.length
  const makerPct = Math.round((makerBlocks / total) * 100)
  const managerPct = Math.round((managerBlocks / total) * 100)

  let mode: DayMode
  if (makerPct >= 60) mode = 'maker'
  else if (managerPct >= 60) mode = 'manager'
  else mode = 'mixed'

  return { mode, makerPct, managerPct, totalBlocks: total, longestBlockMs }
}

export function getMakerManagerLabel(mode: DayMode): string {
  switch (mode) {
    case 'maker': return 'Maker Day — deep, uninterrupted work'
    case 'manager': return 'Manager Day — many short tasks & meetings'
    case 'mixed': return 'Mixed Day — blend of deep work and meetings'
    default: return 'Unknown — not enough data'
  }
}
