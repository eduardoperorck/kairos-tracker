import { describe, it, expect } from 'vitest'
import { computeContextSwitches, getSwitchStatusColor, getSwitchStatusEmoji } from './contextSwitching'
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

  it('classifies as moderate between 6 and 15 switches/h', () => {
    const now = Date.now()
    const blocks: CaptureBlock[] = []
    // 10 blocks over 1 hour = 9 switches = ~9/h = moderate
    for (let i = 0; i < 10; i++) {
      blocks.push(makeBlock(
        now - (10 - i) * 360000,
        now - (9 - i) * 360000,
        i % 2 === 0 ? 'Code.exe' : 'chrome.exe'
      ))
    }
    const m = computeContextSwitches(blocks, 2 * 3600000)
    expect(m.status).toBe('moderate')
  })
})

describe('getSwitchStatusColor', () => {
  it('returns emerald for focused', () => {
    expect(getSwitchStatusColor('focused')).toContain('emerald')
  })

  it('returns yellow for moderate', () => {
    expect(getSwitchStatusColor('moderate')).toContain('yellow')
  })

  it('returns red for fragmented', () => {
    expect(getSwitchStatusColor('fragmented')).toContain('red')
  })
})

describe('getSwitchStatusEmoji', () => {
  it('returns green circle for focused', () => {
    expect(getSwitchStatusEmoji('focused')).toBe('🟢')
  })

  it('returns yellow circle for moderate', () => {
    expect(getSwitchStatusEmoji('moderate')).toBe('🟡')
  })

  it('returns red circle for fragmented', () => {
    expect(getSwitchStatusEmoji('fragmented')).toBe('🔴')
  })
})
