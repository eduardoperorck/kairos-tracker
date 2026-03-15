// ─── Webhook event types ───────────────────────────────────────────────────────

export type WebhookEvent =
  | { type: 'timer.started'; category: string; startedAt: number }
  | { type: 'timer.stopped'; category: string; startedAt: number; endedAt: number; durationMs: number; tag?: string }
  | { type: 'goal.reached'; category: string; goalMs: number; weeklyMs: number }
  | { type: 'streak.milestone'; category: string; streak: number; milestone: 7 | 14 | 30 | 100 }
  | { type: 'focus.break_skipped'; category: string; sessionMs: number }
  | { type: 'daily.review'; mood: number; totalMs: number; topCategory: string }

async function postWebhook(url: string, event: WebhookEvent): Promise<void> {
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

  function onTimerStopped(category: string, startedAt: number, endedAt: number, tag?: string) {
    send({ type: 'timer.stopped', category, startedAt, endedAt, durationMs: endedAt - startedAt, tag })
  }

  function onGoalReached(category: string, goalMs: number, weeklyMs: number) {
    send({ type: 'goal.reached', category, goalMs, weeklyMs })
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

  function onDailyReview(mood: number, totalMs: number, topCategory: string) {
    send({ type: 'daily.review', mood, totalMs, topCategory })
  }

  return { onTimerStarted, onTimerStopped, onGoalReached, onStreakMilestone, onBreakSkipped, onDailyReview }
}
