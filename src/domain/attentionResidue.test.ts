import { describe, it, expect } from 'vitest'
import {
  computeAttentionResidue,
  formatResidueCountdown,
  SETTLING_DURATION_MS,
} from './attentionResidue'

describe('computeAttentionResidue', () => {
  it('returns settling=false when elapsed >= 5 minutes', () => {
    const switchedAt = 0
    const now = SETTLING_DURATION_MS
    const result = computeAttentionResidue(switchedAt, 'Work', now)
    expect(result.settling).toBe(false)
  })

  it('returns settling=true with remainingMs when within 5 minutes', () => {
    const switchedAt = 0
    const now = 60_000 // 1 minute later
    const result = computeAttentionResidue(switchedAt, 'Work', now)
    expect(result.settling).toBe(true)
    if (result.settling) {
      expect(result.remainingMs).toBe(SETTLING_DURATION_MS - 60_000)
      expect(result.fromCategory).toBe('Work')
    }
  })

  it('returns settling=true immediately after switch', () => {
    const now = Date.now()
    const result = computeAttentionResidue(now, 'Deep Work', now)
    expect(result.settling).toBe(true)
  })

  it('returns settling=false exactly at boundary', () => {
    const switchedAt = 1000
    const now = switchedAt + SETTLING_DURATION_MS
    const result = computeAttentionResidue(switchedAt, 'Work', now)
    expect(result.settling).toBe(false)
  })

  it('returns correct fromCategory', () => {
    const now = Date.now()
    const result = computeAttentionResidue(now - 30_000, 'Study', now)
    if (result.settling) {
      expect(result.fromCategory).toBe('Study')
    }
  })
})

describe('formatResidueCountdown', () => {
  it('formats 5 minutes as 5:00', () => {
    expect(formatResidueCountdown(5 * 60_000)).toBe('5:00')
  })

  it('formats 1 min 30 sec as 1:30', () => {
    expect(formatResidueCountdown(90_000)).toBe('1:30')
  })

  it('formats 59 seconds as 0:59', () => {
    expect(formatResidueCountdown(59_000)).toBe('0:59')
  })

  it('pads seconds with leading zero', () => {
    expect(formatResidueCountdown(65_000)).toBe('1:05')
  })
})
