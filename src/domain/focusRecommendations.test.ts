import { describe, it, expect } from 'vitest'
import { generateRecommendations } from './focusRecommendations'

describe('generateRecommendations', () => {
  it('returns "more data" recommendation with no sessions', () => {
    const recs = generateRecommendations({ sessions: [], blocks: [] })
    expect(recs.some(r => r.id === 'more-data')).toBe(true)
  })

  it('warns about meeting overhead', () => {
    const recs = generateRecommendations({
      sessions: [],
      blocks: [],
      meetingMinutesThisWeek: 700, // ~11.7h
    })
    expect(recs.some(r => r.id === 'meeting-overhead')).toBe(true)
  })

  it('does not warn about meetings below threshold', () => {
    const recs = generateRecommendations({
      sessions: [],
      blocks: [],
      meetingMinutesThisWeek: 300, // 5h
    })
    expect(recs.some(r => r.id === 'meeting-overhead')).toBe(false)
  })

  it('warns about build time above 30min', () => {
    const recs = generateRecommendations({
      sessions: [],
      blocks: [],
      buildMinutesThisWeek: 60,
    })
    expect(recs.some(r => r.id === 'build-time')).toBe(true)
  })

  it('warns about tracking consistency when tracked < 5 days', () => {
    const recs = generateRecommendations({
      sessions: [],
      blocks: [],
      daysTracked: 3,
    })
    expect(recs.some(r => r.id === 'tracking-consistency')).toBe(true)
  })

  it('does not warn about tracking consistency with 0 days tracked', () => {
    const recs = generateRecommendations({ sessions: [], blocks: [], daysTracked: 0 })
    expect(recs.some(r => r.id === 'tracking-consistency')).toBe(false)
  })

  it('warns about fragmented context switching', () => {
    const base = Date.now()
    // Create 20 blocks each 1 minute apart to get high switch rate
    const blocks = Array.from({ length: 20 }, (_, i) => ({
      process: `App${i % 2 === 0 ? 'A' : 'B'}.exe`,
      title: `Window ${i}`,
      startedAt: base - (20 - i) * 60_000,
      endedAt: base - (19 - i) * 60_000,
      categoryId: null,
      confirmed: false,
    }))
    const recs = generateRecommendations({ sessions: [], blocks })
    expect(recs.some(r => r.id === 'context-switching')).toBe(true)
  })

  it('recommends peak hours when enough sessions exist', () => {
    // Build 10+ sessions all in the same hour (9am) to create clear peak
    const sessions = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      categoryId: 'c1',
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      startedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}T09:00:00Z`).getTime(),
      endedAt: new Date(`2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`).getTime(),
    }))
    const recs = generateRecommendations({ sessions, blocks: [] })
    expect(recs.some(r => r.id === 'peak-hours')).toBe(true)
  })
})
