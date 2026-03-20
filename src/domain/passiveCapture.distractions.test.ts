import { describe, it, expect } from 'vitest'
import { detectDistractionApps } from './passiveCapture'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(process: string, durationMs: number): CaptureBlock {
  const now = Date.now()
  return { process, title: '', startedAt: now, endedAt: now + durationMs, categoryId: null, confirmed: false }
}

describe('detectDistractionApps', () => {
  it('returns empty for no blocks', () => {
    expect(detectDistractionApps([])).toEqual([])
  })

  it('returns empty when fewer than minVisits', () => {
    const blocks = Array.from({ length: 4 }, () => makeBlock('twitter.exe', 2 * 60_000))
    expect(detectDistractionApps(blocks)).toEqual([])
  })

  it('detects process with mostly short visits', () => {
    // 8 short visits, 2 long visits = 80% short > threshold
    const blocks = [
      ...Array.from({ length: 8 }, () => makeBlock('twitter.exe', 2 * 60_000)),
      ...Array.from({ length: 2 }, () => makeBlock('twitter.exe', 10 * 60_000)),
    ]
    const result = detectDistractionApps(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].process).toBe('twitter.exe')
    expect(result[0].visitCount).toBe(10)
  })

  it('does not flag process with mostly long visits', () => {
    // 2 short, 8 long = 20% short < threshold
    const blocks = [
      ...Array.from({ length: 2 }, () => makeBlock('vscode.exe', 2 * 60_000)),
      ...Array.from({ length: 8 }, () => makeBlock('vscode.exe', 30 * 60_000)),
    ]
    expect(detectDistractionApps(blocks)).toEqual([])
  })

  it('sorts by visit count descending', () => {
    const blocks = [
      ...Array.from({ length: 5 }, () => makeBlock('app-a.exe', 1 * 60_000)),
      ...Array.from({ length: 10 }, () => makeBlock('app-b.exe', 1 * 60_000)),
    ]
    const result = detectDistractionApps(blocks)
    expect(result[0].process).toBe('app-b.exe')
    expect(result[1].process).toBe('app-a.exe')
  })

  it('respects custom shortBlockMs threshold', () => {
    // 6 visits at 8 min each — short if threshold is 10 min
    const blocks = Array.from({ length: 6 }, () => makeBlock('app.exe', 8 * 60_000))
    expect(detectDistractionApps(blocks, 10 * 60_000)).toHaveLength(1)
    expect(detectDistractionApps(blocks, 5 * 60_000)).toHaveLength(0) // 8 min > 5 min not short
  })
})
