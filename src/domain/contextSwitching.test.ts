import { describe, it, expect } from 'vitest'
import { computeContextSwitches } from './contextSwitching'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(startedAt: number, endedAt: number, process = 'Code.exe'): CaptureBlock {
  return { process, title: '', startedAt, endedAt, categoryId: 'work', confirmed: true }
}

describe('computeContextSwitches', () => {
  it('returns zero for empty blocks', () => {
    const m = computeContextSwitches([])
    expect(m.switchesPerHour).toBe(0)
    expect(m.status).toBe('focused')
  })

  it('classifies as focused with < 6 switches/h', () => {
    const now = Date.now()
    const blocks = [
      makeBlock(now - 3600000, now - 2400000, 'Code.exe'),
      makeBlock(now - 2400000, now - 1800000, 'chrome.exe'),
      makeBlock(now - 1800000, now, 'Code.exe'),
    ]
    const m = computeContextSwitches(blocks, 2 * 3600000)
    expect(m.status).toBe('focused')
  })

  it('classifies as fragmented with > 15 switches/h', () => {
    const now = Date.now()
    const blocks: CaptureBlock[] = []
    for (let i = 0; i < 20; i++) {
      blocks.push(makeBlock(
        now - (20 - i) * 120000,
        now - (19 - i) * 120000,
        i % 2 === 0 ? 'Code.exe' : 'slack.exe'
      ))
    }
    const m = computeContextSwitches(blocks, 2 * 3600000)
    expect(m.status).toBe('fragmented')
  })
})
