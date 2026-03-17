import { describe, it, expect } from 'vitest'
import { analyzeInputActivity, isInputActive } from './inputIntelligence'
import type { InputActivity } from './inputIntelligence'

function makeActivity(overrides: Partial<InputActivity> = {}): InputActivity {
  return {
    keystrokes: 0,
    mouseClicks: 0,
    mouseDistancePx: 0,
    windowMs: 60_000,
    ...overrides,
  }
}

describe('analyzeInputActivity', () => {
  it('returns idle for zero keystrokes', () => {
    const result = analyzeInputActivity(makeActivity())
    expect(result.intensity).toBe('idle')
  })

  it('returns light for 5 keystrokes/min', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 5, windowMs: 60_000 }))
    expect(result.intensity).toBe('light')
  })

  it('returns moderate for 20 keystrokes/min', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 20, windowMs: 60_000 }))
    expect(result.intensity).toBe('moderate')
  })

  it('returns active for 50 keystrokes/min', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 50, windowMs: 60_000 }))
    expect(result.intensity).toBe('active')
  })

  it('returns intense for 100+ keystrokes/min', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 100, windowMs: 60_000 }))
    expect(result.intensity).toBe('intense')
  })

  it('computes keystrokesPerMin correctly', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 60, windowMs: 60_000 }))
    expect(result.keystrokesPerMin).toBe(60)
  })

  it('dwsBoost is 0 for idle', () => {
    const result = analyzeInputActivity(makeActivity())
    expect(result.dwsBoost).toBe(0)
  })

  it('dwsBoost is 20 for intense typing', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 100, windowMs: 60_000 }))
    expect(result.dwsBoost).toBe(20)
  })

  it('dwsBoost does not exceed 20', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 1000, windowMs: 60_000 }))
    expect(result.dwsBoost).toBeLessThanOrEqual(20)
  })

  it('handles zero window time without dividing by zero', () => {
    const result = analyzeInputActivity(makeActivity({ keystrokes: 100, windowMs: 0 }))
    expect(result.intensity).toBe('idle')
  })
})

describe('isInputActive', () => {
  it('returns false for idle', () => {
    expect(isInputActive(makeActivity())).toBe(false)
  })

  it('returns true when kpm >= threshold', () => {
    expect(isInputActive(makeActivity({ keystrokes: 10, windowMs: 60_000 }))).toBe(true)
  })

  it('uses custom threshold', () => {
    expect(isInputActive(makeActivity({ keystrokes: 3, windowMs: 60_000 }), 3)).toBe(true)
  })
})
