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
})
