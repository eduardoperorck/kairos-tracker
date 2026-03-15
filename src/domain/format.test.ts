import { describe, it, expect } from 'vitest'
import { formatElapsed, formatRelativeTime } from './format'

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

describe('formatRelativeTime', () => {
  const now = 1_000_000_000

  it('returns "just now" for less than 1 minute ago', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now')
  })

  it('returns "just now" for exactly 0 ms ago', () => {
    expect(formatRelativeTime(now, now)).toBe('just now')
  })

  it('returns "X min ago" for minutes ago', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago')
  })

  it('returns "Xh ago" for hours ago (< 24h)', () => {
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe('2h ago')
  })

  it('returns "yesterday" for 1 day ago', () => {
    expect(formatRelativeTime(now - 86_400_000, now)).toBe('yesterday')
  })

  it('returns "X days ago" for multiple days', () => {
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe('3 days ago')
  })
})
