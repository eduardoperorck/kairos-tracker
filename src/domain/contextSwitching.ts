import type { CaptureBlock } from './passiveCapture'

export type ContextSwitchMetrics = {
  switchesPerHour: number
  status: 'focused' | 'moderate' | 'fragmented'
  switchCount: number
  elapsedHours: number
}

export function computeContextSwitches(
  blocks: CaptureBlock[],
  windowMs: number = 60 * 60_000 // 1 hour window
): ContextSwitchMetrics {
  if (blocks.length === 0) {
    return { switchesPerHour: 0, status: 'focused', switchCount: 0, elapsedHours: 0 }
  }

  const now = Date.now()
  const windowStart = now - windowMs
  const recentBlocks = blocks.filter(b => b.endedAt >= windowStart)
  const switchCount = Math.max(0, recentBlocks.length - 1)
  const elapsedMs = recentBlocks.length > 0
    ? recentBlocks[recentBlocks.length - 1].endedAt - recentBlocks[0].startedAt
    : 0
  const elapsedHours = elapsedMs / 3_600_000

  const switchesPerHour = elapsedHours > 0 ? switchCount / elapsedHours : 0

  let status: 'focused' | 'moderate' | 'fragmented'
  if (switchesPerHour < 6) status = 'focused'
  else if (switchesPerHour <= 15) status = 'moderate'
  else status = 'fragmented'

  return { switchesPerHour: Math.round(switchesPerHour * 10) / 10, status, switchCount, elapsedHours }
}

export function getSwitchStatusColor(status: 'focused' | 'moderate' | 'fragmented'): string {
  if (status === 'focused') return 'text-emerald-400'
  if (status === 'moderate') return 'text-yellow-400'
  return 'text-red-400'
}

export function getSwitchStatusEmoji(status: 'focused' | 'moderate' | 'fragmented'): string {
  if (status === 'focused') return '🟢'
  if (status === 'moderate') return '🟡'
  return '🔴'
}
