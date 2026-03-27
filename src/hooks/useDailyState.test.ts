import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDailyState } from './useDailyState'

const TODAY = '2023-11-14'
const YESTERDAY = '2023-11-13'

function makeStorage(overrides: Record<string, any> = {}) {
  return {
    loadIntentionsByDate: vi.fn().mockResolvedValue([]),
    loadEveningReviewByDate: vi.fn().mockResolvedValue(null),
    saveIntention: vi.fn().mockResolvedValue(undefined),
    saveEveningReview: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any
}

function t(key: string) { return key }

describe('useDailyState', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('loads intentions and evening review on mount', async () => {
    const intention = { id: 'i1', text: 'Focus', date: TODAY, done: false }
    const review = { date: TODAY, mood: 3, notes: 'ok' }
    const storage = makeStorage({
      loadIntentionsByDate: vi.fn().mockResolvedValue([intention]),
      loadEveningReviewByDate: vi.fn().mockResolvedValue(review),
    })
    const { result } = renderHook(() => useDailyState({ storage, today: TODAY, historySessions: [], t }))
    await waitFor(() => expect(result.current.intentions).toHaveLength(1))
    expect(result.current.intentions[0]).toEqual(intention)
    expect(result.current.eveningReview).toEqual(review)
  })

  it('initialises with empty intentions and null review', async () => {
    const { result } = renderHook(() => useDailyState({ storage: makeStorage(), today: TODAY, historySessions: [], t }))
    await waitFor(() => expect(result.current.intentions).toEqual([]))
    expect(result.current.eveningReview).toBeNull()
  })

  it('handleAddIntention saves and appends to state', async () => {
    const storage = makeStorage()
    const { result } = renderHook(() => useDailyState({ storage, today: TODAY, historySessions: [], t }))
    // wait for initial load to settle
    await waitFor(() => expect(storage.loadIntentionsByDate).toHaveBeenCalled())
    await act(async () => { await result.current.handleAddIntention('Write tests') })
    expect(storage.saveIntention).toHaveBeenCalledWith(expect.objectContaining({ text: 'Write tests', date: TODAY }))
    expect(result.current.intentions).toHaveLength(1)
    expect(result.current.intentions[0].text).toBe('Write tests')
  })

  it('handleSaveReview saves and updates state', async () => {
    const storage = makeStorage()
    const { result } = renderHook(() => useDailyState({ storage, today: TODAY, historySessions: [], t }))
    // wait for initial load to settle
    await waitFor(() => expect(storage.loadEveningReviewByDate).toHaveBeenCalled())
    await act(async () => { await result.current.handleSaveReview(4, 'Great day') })
    expect(storage.saveEveningReview).toHaveBeenCalledWith(expect.objectContaining({ date: TODAY, mood: 4, notes: 'Great day' }))
    expect(result.current.eveningReview).not.toBeNull()
  })

  it('showMorningPrompt defaults to true when not dismissed today', () => {
    const { result } = renderHook(() => useDailyState({ storage: makeStorage(), today: TODAY, historySessions: [], t }))
    // localStorage has no dismissed key → should default to true
    expect(result.current.showMorningPrompt).toBe(true)
  })

  it('dailyRecap is null initially', () => {
    const { result } = renderHook(() => useDailyState({ storage: makeStorage(), today: TODAY, historySessions: [], t }))
    expect(result.current.dailyRecap).toBeNull()
  })
})
