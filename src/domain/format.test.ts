import { describe, it, expect } from 'vitest'
import { formatElapsed } from './format'

describe('formatElapsed', () => {
  it('formats zero as 00:00', () => {
    expect(formatElapsed(0)).toBe('00:00')
  })

  it('formats 1 second', () => {
    expect(formatElapsed(1000)).toBe('00:01')
  })

  it('formats 1 minute', () => {
    expect(formatElapsed(60_000)).toBe('01:00')
  })

  it('formats 1 minute and 5 seconds', () => {
    expect(formatElapsed(65_000)).toBe('01:05')
  })

  it('formats 59 minutes and 59 seconds', () => {
    expect(formatElapsed(3_599_000)).toBe('59:59')
  })

  it('rolls over at 60 minutes', () => {
    expect(formatElapsed(3_600_000)).toBe('60:00')
  })

  it('ignores sub-second precision', () => {
    expect(formatElapsed(1_500)).toBe('00:01')
  })
})
