import { describe, it, expect } from 'vitest'
import { createCategory, startTimer, stopTimer, getElapsed, computeTodayMs, toDateString, getWeekDates, computeWeekMs, computeStreak } from './timer'

describe('createCategory', () => {
  it('creates a category with a name', () => {
    const category = createCategory('Work')
    expect(category.name).toBe('Work')
  })

  it('creates a category with a unique id', () => {
    const a = createCategory('Work')
    const b = createCategory('Study')
    expect(a.id).not.toBe(b.id)
  })

  it('creates a category with no active timer', () => {
    const category = createCategory('Work')
    expect(category.activeEntry).toBeNull()
  })
})

describe('startTimer', () => {
  it('returns an entry with a start timestamp', () => {
    const entry = startTimer()
    expect(entry.startedAt).toBeTypeOf('number')
    expect(entry.endedAt).toBeNull()
  })

  it('records the current time as startedAt', () => {
    const before = Date.now()
    const entry = startTimer()
    const after = Date.now()
    expect(entry.startedAt).toBeGreaterThanOrEqual(before)
    expect(entry.startedAt).toBeLessThanOrEqual(after)
  })
})

describe('stopTimer', () => {
  it('returns an entry with an end timestamp', () => {
    const entry = startTimer()
    const stopped = stopTimer(entry)
    expect(stopped.endedAt).toBeTypeOf('number')
  })

  it('does not change the startedAt timestamp', () => {
    const entry = startTimer()
    const stopped = stopTimer(entry)
    expect(stopped.startedAt).toBe(entry.startedAt)
  })
})

describe('computeStreak', () => {
  const today = '2026-03-15'

  it('returns 0 when there are no sessions', () => {
    expect(computeStreak([], today)).toBe(0)
  })

  it('returns 1 when only today has a session', () => {
    expect(computeStreak([today], today)).toBe(1)
  })

  it('counts consecutive days ending today', () => {
    const dates = ['2026-03-13', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today)).toBe(3)
  })

  it('counts consecutive days ending yesterday when today is missing', () => {
    const dates = ['2026-03-13', '2026-03-14']
    expect(computeStreak(dates, today)).toBe(2)
  })

  it('returns 0 when the last session was 2 or more days ago', () => {
    const dates = ['2026-03-12', '2026-03-13']
    expect(computeStreak(dates, today)).toBe(0)
  })

  it('stops counting at a gap in the sequence', () => {
    // gap on 2026-03-13 breaks the streak
    const dates = ['2026-03-11', '2026-03-12', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today)).toBe(2)
  })

  it('handles duplicate dates by deduplicating', () => {
    const dates = ['2026-03-14', '2026-03-14', '2026-03-15', '2026-03-15']
    expect(computeStreak(dates, today)).toBe(2)
  })

  it('default behavior (allowedGapDays=0) is unchanged — gap breaks streak', () => {
    // gap on 2026-03-13 → streak is only 2 (14 + 15)
    const dates = ['2026-03-11', '2026-03-12', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 0)).toBe(2)
  })

  it('counts streak of 5 with one gap day when allowedGapDays=1', () => {
    // 11, 12, [13 missing], 14, 15 — gap of 1 is tolerated
    const dates = ['2026-03-11', '2026-03-12', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 1)).toBe(4)
  })

  it('returns streak across a single allowed gap spanning the whole sequence', () => {
    // 10, 11, 12, [13 missing], 14, 15 — one gap, allowedGapDays=1
    const dates = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 1)).toBe(5)
  })

  it('breaks streak on two consecutive gap days when allowedGapDays=1', () => {
    // 11, [12 missing], [13 missing], 14, 15 — two consecutive gaps, streak breaks
    const dates = ['2026-03-11', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 1)).toBe(2)
  })

  it('respects a gap at the beginning of the sequence (gap before first date)', () => {
    // 10, 11, [12 missing], 13, 14, 15 — gap between 11 and 13 (allowedGapDays=0)
    // walking backwards from 15: 15, 14, 13 → gap to 11 is 2 days → streak stops at 3
    const dates = ['2026-03-10', '2026-03-11', '2026-03-13', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 0)).toBe(3)
  })

  it('two separate gaps within the streak both break when allowedGapDays=1', () => {
    // 9, [10 missing], 11, [12 missing], [13 missing], 14, 15
    // allowedGapDays=1: walking back from 15: 15, 14, [gap of 2 to 11] → breaks at gap between 11 and 14
    const dates = ['2026-03-09', '2026-03-11', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 1)).toBe(2)
  })

  it('single gap at the very start of dates array is tolerated when allowedGapDays=1', () => {
    // [2026-03-09 missing], 10, 11, 12, 13, 14, 15 — gap between hypothetical 09 and 10
    // The actual first date is 10, so no gap issue when walking back from 15 to 10
    const dates = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15']
    expect(computeStreak(dates, today, 1)).toBe(6)
  })
})

describe('computeTodayMs', () => {
  const today = '2026-03-15'
  const catId = 'cat-1'

  it('returns 0 when there are no sessions', () => {
    expect(computeTodayMs([], catId, today)).toBe(0)
  })

  it('sums duration of sessions matching category and date', () => {
    const sessions = [
      { id: '1', categoryId: catId, startedAt: 0, endedAt: 3000, date: today },
      { id: '2', categoryId: catId, startedAt: 5000, endedAt: 7000, date: today },
    ]
    expect(computeTodayMs(sessions, catId, today)).toBe(5000)
  })

  it('ignores sessions from other categories', () => {
    const sessions = [
      { id: '1', categoryId: 'other', startedAt: 0, endedAt: 10000, date: today },
      { id: '2', categoryId: catId, startedAt: 0, endedAt: 2000, date: today },
    ]
    expect(computeTodayMs(sessions, catId, today)).toBe(2000)
  })

  it('ignores sessions from other dates', () => {
    const sessions = [
      { id: '1', categoryId: catId, startedAt: 0, endedAt: 10000, date: '2026-03-14' },
      { id: '2', categoryId: catId, startedAt: 0, endedAt: 1000, date: today },
    ]
    expect(computeTodayMs(sessions, catId, today)).toBe(1000)
  })

  it('toDateString formats ms timestamp as YYYY-MM-DD', () => {
    // 2026-03-15T00:00:00.000Z
    expect(toDateString(1742000400000)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    expect(getWeekDates('2026-03-15')).toHaveLength(7)
  })

  it('starts on Monday', () => {
    // 2026-03-15 is a Sunday → week starts 2026-03-09 (Monday)
    expect(getWeekDates('2026-03-15')[0]).toBe('2026-03-09')
  })

  it('ends on Sunday', () => {
    expect(getWeekDates('2026-03-15')[6]).toBe('2026-03-15')
  })

  it('includes the given date', () => {
    const dates = getWeekDates('2026-03-11') // Wednesday
    expect(dates).toContain('2026-03-11')
  })

  it('dates are consecutive', () => {
    const dates = getWeekDates('2026-03-15')
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00Z')
      const curr = new Date(dates[i] + 'T12:00:00Z')
      expect(curr.getTime() - prev.getTime()).toBe(86_400_000)
    }
  })
})

describe('computeWeekMs', () => {
  const catId = 'cat-1'
  const weekDates = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15']

  it('returns 0 with no sessions', () => {
    expect(computeWeekMs([], catId, weekDates)).toBe(0)
  })

  it('sums sessions within the week', () => {
    const sessions = [
      { id: '1', categoryId: catId, startedAt: 0, endedAt: 5000, date: '2026-03-09' },
      { id: '2', categoryId: catId, startedAt: 0, endedAt: 3000, date: '2026-03-13' },
    ]
    expect(computeWeekMs(sessions, catId, weekDates)).toBe(8000)
  })

  it('ignores sessions outside the week', () => {
    const sessions = [
      { id: '1', categoryId: catId, startedAt: 0, endedAt: 9000, date: '2026-03-08' },
      { id: '2', categoryId: catId, startedAt: 0, endedAt: 1000, date: '2026-03-15' },
    ]
    expect(computeWeekMs(sessions, catId, weekDates)).toBe(1000)
  })

  it('ignores sessions from other categories', () => {
    const sessions = [
      { id: '1', categoryId: 'other', startedAt: 0, endedAt: 9000, date: '2026-03-15' },
      { id: '2', categoryId: catId, startedAt: 0, endedAt: 2000, date: '2026-03-15' },
    ]
    expect(computeWeekMs(sessions, catId, weekDates)).toBe(2000)
  })
})

describe('getElapsed', () => {
  it('returns elapsed ms for a stopped entry', () => {
    const entry = startTimer()
    const stopped = stopTimer(entry)
    const elapsed = getElapsed(stopped)
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  it('returns elapsed ms for a running entry using current time', () => {
    const entry = startTimer()
    const elapsed = getElapsed(entry)
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  it('returns correct duration', () => {
    const entry = { startedAt: 1000, endedAt: 4000 }
    const elapsed = getElapsed(entry)
    expect(elapsed).toBe(3000)
  })
})
