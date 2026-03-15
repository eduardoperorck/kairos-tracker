import { describe, it, expect } from 'vitest'
import { createIntention, createEveningReview, getIntentionsForDate } from './intentions'

describe('createIntention', () => {
  it('returns an Intention with the given text and date', () => {
    const intention = createIntention('Write unit tests', '2026-03-15')
    expect(intention.text).toBe('Write unit tests')
    expect(intention.date).toBe('2026-03-15')
    expect(intention.createdAt).toBeGreaterThan(0)
  })
})

describe('createEveningReview', () => {
  it('returns an EveningReview with the given fields', () => {
    const review = createEveningReview('2026-03-15', 4, 'Good day!')
    expect(review.date).toBe('2026-03-15')
    expect(review.mood).toBe(4)
    expect(review.notes).toBe('Good day!')
    expect(review.createdAt).toBeGreaterThan(0)
  })
})

describe('getIntentionsForDate', () => {
  it('returns only intentions matching the given date', () => {
    const intentions = [
      createIntention('Task A', '2026-03-15'),
      createIntention('Task B', '2026-03-16'),
      createIntention('Task C', '2026-03-15'),
    ]
    const result = getIntentionsForDate(intentions, '2026-03-15')
    expect(result).toHaveLength(2)
    expect(result.every(i => i.date === '2026-03-15')).toBe(true)
  })

  it('returns empty array when no intentions match', () => {
    const intentions = [createIntention('Task A', '2026-03-14')]
    const result = getIntentionsForDate(intentions, '2026-03-15')
    expect(result).toHaveLength(0)
  })
})
