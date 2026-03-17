import { describe, it, expect } from 'vitest'
import { computeDRT } from './distractionRecovery'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(startedAt: number, endedAt: number, process: string): CaptureBlock {
  return { process, title: '', startedAt, endedAt, categoryId: null, confirmed: true }
}

describe('computeDRT', () => {
  it('returns zeros for empty blocks', () => {
    const m = computeDRT([], ['Slack.exe'])
    expect(m.averageDrtMs).toBe(0)
    expect(m.worstInterruptor).toBeNull()
  })

  it('calculates DRT from distraction to focus block', () => {
    const now = Date.now()
    const blocks = [
      makeBlock(now - 90 * 60_000, now - 60 * 60_000, 'Code.exe'),  // focus block (60min)
      makeBlock(now - 60 * 60_000, now - 55 * 60_000, 'Slack.exe'), // distraction
      makeBlock(now - 50 * 60_000, now - 30 * 60_000, 'Code.exe'),  // focus block (20min)
    ]
    const m = computeDRT(blocks, ['Slack.exe'])
    expect(m.averageDrtMs).toBeGreaterThan(0)
    expect(m.worstInterruptor).toBe('Slack.exe')
  })

  it('identifies worsening trend', () => {
    const now = Date.now()
    const blocks = [
      makeBlock(now - 30 * 60_000, now - 20 * 60_000, 'Slack.exe'),
      makeBlock(now - 10 * 60_000, now, 'Code.exe'),
    ]
    // Current avg DRT ~10min, previous was ~5min → worsening
    const m = computeDRT(blocks, ['Slack.exe'], 5 * 60_000)
    expect(m.trend).toBe('worsening')
  })
})
