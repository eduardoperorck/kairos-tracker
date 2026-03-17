import { describe, it, expect } from 'vitest'
import { computeNaturalCycle, formatCycleDescription } from './adaptiveCycles'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(durationMs: number): CaptureBlock {
  const now = Date.now()
  return {
    process: 'Code.exe', title: '', startedAt: now - durationMs, endedAt: now,
    categoryId: 'work', confirmed: true,
  }
}

describe('computeNaturalCycle', () => {
  it('returns null with fewer than 10 samples', () => {
    const blocks = [makeBlock(30 * 60_000), makeBlock(45 * 60_000)]
    expect(computeNaturalCycle(blocks)).toBeNull()
  })

  it('returns a cycle with sufficient data', () => {
    const blocks = Array.from({ length: 20 }, () => makeBlock(60 * 60_000))
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.focusMs).toBe(60 * 60_000)
    expect(cycle!.breakMs).toBe(15 * 60_000)
    expect(cycle!.confidence).toBeGreaterThan(0)
  })

  it('filters out blocks shorter than 10 min', () => {
    const blocks = Array.from({ length: 20 }, () => makeBlock(5 * 60_000)) // all too short
    expect(computeNaturalCycle(blocks)).toBeNull()
  })
})

describe('formatCycleDescription', () => {
  it('formats correctly', () => {
    const cycle = { focusMs: 60 * 60_000, breakMs: 15 * 60_000, confidence: 0.8, sampleCount: 24, stddevMs: 5 * 60_000 }
    const desc = formatCycleDescription(cycle)
    expect(desc).toContain('60m focus')
    expect(desc).toContain('15m break')
    expect(desc).toContain('24 sessions')
  })
})
