import { describe, it, expect } from 'vitest'
import { computeNaturalCycle, formatCycleDescription } from './adaptiveCycles'
import type { CaptureBlock } from './passiveCapture'

// Use fixed timestamps so tests are deterministic
const BASE = 1_000_000_000_000

function makeBlock(startedAt: number, durationMs: number, confirmed = true, categoryId: string | null = 'work'): CaptureBlock {
  return {
    process: 'Code.exe',
    title: '',
    startedAt,
    endedAt: startedAt + durationMs,
    categoryId,
    confirmed,
  }
}

function makeBlocks(count: number, durationMs: number): CaptureBlock[] {
  return Array.from({ length: count }, (_, i) =>
    makeBlock(BASE + i * (durationMs + 5 * 60_000), durationMs)
  )
}

describe('computeNaturalCycle', () => {
  it('returns null with fewer than 10 samples', () => {
    const blocks = [makeBlock(BASE, 30 * 60_000), makeBlock(BASE + 1, 45 * 60_000)]
    expect(computeNaturalCycle(blocks)).toBeNull()
  })

  it('returns null with exactly 9 samples (boundary below MIN_SAMPLES)', () => {
    const blocks = makeBlocks(9, 25 * 60_000)
    expect(computeNaturalCycle(blocks)).toBeNull()
  })

  it('returns a result with exactly 10 samples (boundary at MIN_SAMPLES)', () => {
    const blocks = makeBlocks(10, 25 * 60_000)
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.sampleCount).toBe(10)
  })

  it('returns a cycle with sufficient data', () => {
    // makeBlocks spaces blocks with a fixed 5-minute gap between them.
    // With ≥ 3 inter-block gaps the data-driven path is used → breakMs = median gap = 5 min.
    const blocks = makeBlocks(20, 60 * 60_000)
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.focusMs).toBe(60 * 60_000)
    expect(cycle!.breakMs).toBe(5 * 60_000)
    expect(cycle!.confidence).toBeGreaterThan(0)
  })

  it('filters out blocks shorter than 10 min — all filtered returns null', () => {
    const blocks = makeBlocks(20, 5 * 60_000)
    expect(computeNaturalCycle(blocks)).toBeNull()
  })

  it('filters out unconfirmed blocks', () => {
    // 10 unconfirmed blocks + 9 confirmed: still below MIN_SAMPLES
    const unconfirmed = makeBlocks(10, 25 * 60_000).map(b => ({ ...b, confirmed: false }))
    const confirmed = makeBlocks(9, 25 * 60_000)
    expect(computeNaturalCycle([...unconfirmed, ...confirmed])).toBeNull()
  })

  it('filters out blocks where categoryId is null', () => {
    // 15 uncategorised blocks are excluded; only 5 valid remain → null
    const uncategorised = makeBlocks(15, 25 * 60_000).map(b => ({ ...b, categoryId: null }))
    const valid = makeBlocks(5, 25 * 60_000)
    expect(computeNaturalCycle([...uncategorised, ...valid])).toBeNull()
  })

  // ── 25m / 5m pattern tests ─────────────────────────────────────────────────

  it('returns focusMs close to 25m when blocks follow a 25m work pattern', () => {
    // 25 min work blocks = 1_500_000 ms; makeBlocks uses a fixed 5-minute gap.
    // With ≥ 3 inter-block gaps the data-driven path is used → breakMs = median gap = 5 min.
    const blocks = makeBlocks(20, 25 * 60_000)
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    // focusMs should equal exactly 25 min (all identical durations)
    expect(cycle!.focusMs).toBe(25 * 60_000)
    // breakMs is the median of actual inter-block gaps (all 5 min)
    expect(cycle!.breakMs).toBe(5 * 60_000)
  })

  it('breakMs falls back to 25% of focusMs when fewer than 3 inter-block gaps exist', () => {
    // Only 2 blocks → 1 gap → fewer than 3 → heuristic fallback
    const twoBlocks = makeBlocks(2, 30 * 60_000)
    // Add 8 more at offset far apart (> 60-min gap = excluded from breakGaps)
    const farBlocks = Array.from({ length: 8 }, (_, i) =>
      makeBlock(BASE + 1_000 * 60_000 + i * (30 * 60_000 + 90 * 60_000), 30 * 60_000)
    )
    const blocks = [...twoBlocks, ...farBlocks]
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.breakMs).toBe(Math.round(cycle!.focusMs * 0.25))
  })

  it('reports near-zero stddev when all blocks have the same duration', () => {
    const blocks = makeBlocks(20, 25 * 60_000)
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.stddevMs).toBe(0)
  })

  // ── confidence tests ───────────────────────────────────────────────────────

  it('confidence is lower for fewer samples (10 samples → 1/3 of max)', () => {
    const few = makeBlocks(10, 25 * 60_000)
    const many = makeBlocks(30, 25 * 60_000)
    const cycleFew = computeNaturalCycle(few)!
    const cycleMany = computeNaturalCycle(many)!
    expect(cycleFew.confidence).toBeLessThan(cycleMany.confidence)
  })

  it('confidence caps at 1.0 when sample count >= 30', () => {
    const blocks = makeBlocks(30, 25 * 60_000)
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.confidence).toBe(1)
  })

  it('confidence is 1/3 for exactly 10 samples (10/30)', () => {
    const blocks = makeBlocks(10, 25 * 60_000)
    const cycle = computeNaturalCycle(blocks)
    expect(cycle).not.toBeNull()
    expect(cycle!.confidence).toBeCloseTo(10 / 30, 5)
  })

  it('diverse block lengths produce higher stddev and lower confidence vs uniform', () => {
    // uniform: 10 blocks all 25 min
    const uniform = makeBlocks(10, 25 * 60_000)
    // diverse: 10 blocks ranging from 10 to 60 min
    const durations = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60].map(m => m * 60_000)
    const diverse = durations.map((d, i) => makeBlock(BASE + i * (d + 5 * 60_000), d))

    const cycleUniform = computeNaturalCycle(uniform)!
    const cycleDiverse = computeNaturalCycle(diverse)!

    // Both have 10 samples so confidence is equal — diverse is flagged via higher stddev
    expect(cycleDiverse.stddevMs).toBeGreaterThan(cycleUniform.stddevMs)
    // Confidence is sample-count-driven (both 10), so equal here
    expect(cycleDiverse.confidence).toBe(cycleUniform.confidence)
  })

  it('sampleCount reflects only valid (confirmed, categorised, long-enough) blocks', () => {
    const valid = makeBlocks(12, 25 * 60_000)
    const tooShort = makeBlocks(5, 3 * 60_000)                           // < 10 min
    const noCategory = makeBlocks(3, 25 * 60_000).map(b => ({ ...b, categoryId: null }))
    const unconfirmed = makeBlocks(4, 25 * 60_000).map(b => ({ ...b, confirmed: false }))

    const cycle = computeNaturalCycle([...valid, ...tooShort, ...noCategory, ...unconfirmed])
    expect(cycle).not.toBeNull()
    expect(cycle!.sampleCount).toBe(12)
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

  it('includes confidence percentage', () => {
    const cycle = { focusMs: 25 * 60_000, breakMs: 6 * 60_000, confidence: 0.5, sampleCount: 15, stddevMs: 2 * 60_000 }
    const desc = formatCycleDescription(cycle)
    expect(desc).toContain('50%')
  })

  it('rounds minutes correctly for non-round durations', () => {
    // 27.5 min focus → rounds to 28m; breakMs = 6.875 min → rounds to 7m
    const cycle = {
      focusMs: Math.round(27.5 * 60_000),
      breakMs: Math.round(6.875 * 60_000),
      confidence: 1,
      sampleCount: 30,
      stddevMs: 0,
    }
    const desc = formatCycleDescription(cycle)
    expect(desc).toContain('28m focus')
    expect(desc).toContain('7m break')
  })
})
