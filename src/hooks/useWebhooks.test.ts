import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWebhooks } from './useWebhooks'

const WEBHOOK_URL = 'https://example.com/hook'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

describe('useWebhooks', () => {
  it('does not call fetch when url is null', () => {
    const hooks = useWebhooks(null)
    hooks.onTimerStarted('Work', Date.now())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts timer.started event', async () => {
    const hooks = useWebhooks(WEBHOOK_URL)
    const startedAt = 1_000_000
    hooks.onTimerStarted('Work', startedAt)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(WEBHOOK_URL)
    const body = JSON.parse(opts.body)
    expect(body).toMatchObject({ type: 'timer.started', category: 'Work', startedAt })
  })

  it('posts timer.stopped event with durationMs computed', async () => {
    const hooks = useWebhooks(WEBHOOK_URL)
    hooks.onTimerStopped('Work', 1000, 4000, 'deep work')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({
      type: 'timer.stopped',
      category: 'Work',
      startedAt: 1000,
      endedAt: 4000,
      durationMs: 3000,
      tag: 'deep work',
    })
  })

  it('posts goal.reached event', async () => {
    const hooks = useWebhooks(WEBHOOK_URL)
    hooks.onGoalReached('Work', 36_000_000, 38_000_000)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({ type: 'goal.reached', category: 'Work', goalMs: 36_000_000 })
  })

  it('posts streak.milestone only for milestone values (7, 14, 30, 100)', async () => {
    const hooks = useWebhooks(WEBHOOK_URL)
    hooks.onStreakMilestone('Work', 5)   // not a milestone
    await new Promise(r => setTimeout(r, 10))
    expect(fetch).not.toHaveBeenCalled()

    hooks.onStreakMilestone('Work', 7)   // milestone
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({ type: 'streak.milestone', category: 'Work', streak: 7, milestone: 7 })
  })

  it('posts focus.break_skipped event', async () => {
    const hooks = useWebhooks(WEBHOOK_URL)
    hooks.onBreakSkipped('Work', 3_600_000)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({ type: 'focus.break_skipped', category: 'Work', sessionMs: 3_600_000 })
  })

  it('posts daily.review event', async () => {
    const hooks = useWebhooks(WEBHOOK_URL)
    hooks.onDailyReview(4, 18_000_000, 'Work')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({ type: 'daily.review', mood: 4, totalMs: 18_000_000, topCategory: 'Work' })
  })

  it('silently ignores fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const hooks = useWebhooks(WEBHOOK_URL)
    await expect(async () => {
      hooks.onTimerStarted('Work', Date.now())
      await new Promise(r => setTimeout(r, 50))
    }).not.toThrow()
  })
})
