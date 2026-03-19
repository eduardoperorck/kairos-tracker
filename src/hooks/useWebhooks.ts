// ─── Webhook event types ───────────────────────────────────────────────────────

export type WebhookEvent =
  | { type: 'timer.started'; category: string; startedAt: number }
  | {
      type: 'timer.stopped'
      category: string
      startedAt: number
      endedAt: number
      durationMs: number
      tag?: string
      // enrichment
      dailySessionCount?: number  // total sessions today after this stop
      weeklyMs?: number           // total ms this category has tracked this week
    }
  | {
      type: 'goal.reached'
      category: string
      goalMs: number
      weeklyMs: number
      weeklySessionCount?: number
      streakDays?: number
    }
  | { type: 'streak.milestone'; category: string; streak: number; milestone: 7 | 14 | 30 | 100 }
  | { type: 'focus.break_skipped'; category: string; sessionMs: number }
  | {
      type: 'daily.review'
      mood: number
      totalMs: number
      topCategory: string
      categoryBreakdown?: { category: string; durationMs: number }[]
    }

function isSafeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    // Block localhost and private IP ranges
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    if (/^10\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (/^192\.168\./.test(host)) return false
    if (/^169\.254\./.test(host)) return false  // link-local
    return true
  } catch {
    return false
  }
}

async function postWebhook(url: string, event: WebhookEvent): Promise<void> {
  if (!isSafeWebhookUrl(url)) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    // noop — webhooks are fire-and-forget
  }
}

export function useWebhooks(webhookUrl: string | null) {
  function send(event: WebhookEvent) {
    if (!webhookUrl) return
    postWebhook(webhookUrl, event)
  }

  function onTimerStarted(category: string, startedAt: number) {
    send({ type: 'timer.started', category, startedAt })
  }

  function onTimerStopped(
    category: string,
    startedAt: number,
    endedAt: number,
    tag?: string,
    dailySessionCount?: number,
    weeklyMs?: number,
  ) {
    send({ type: 'timer.stopped', category, startedAt, endedAt, durationMs: endedAt - startedAt, tag, dailySessionCount, weeklyMs })
  }

  function onGoalReached(category: string, goalMs: number, weeklyMs: number, weeklySessionCount?: number, streakDays?: number) {
    send({ type: 'goal.reached', category, goalMs, weeklyMs, weeklySessionCount, streakDays })
  }

  function onStreakMilestone(category: string, streak: number) {
    const milestones = [7, 14, 30, 100] as const
    const milestone = milestones.find(m => m === streak)
    if (!milestone) return
    send({ type: 'streak.milestone', category, streak, milestone })
  }

  function onBreakSkipped(category: string, sessionMs: number) {
    send({ type: 'focus.break_skipped', category, sessionMs })
  }

  function onDailyReview(mood: number, totalMs: number, topCategory: string, categoryBreakdown?: { category: string; durationMs: number }[]) {
    send({ type: 'daily.review', mood, totalMs, topCategory, categoryBreakdown })
  }

  return { onTimerStarted, onTimerStopped, onGoalReached, onStreakMilestone, onBreakSkipped, onDailyReview }
}
