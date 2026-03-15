// ─── Webhook event types ───────────────────────────────────────────────────────

export type WebhookEvent =
  | { type: 'timer.started'; category: string; startedAt: number }
  | { type: 'timer.stopped'; category: string; startedAt: number; endedAt: number; durationMs: number; tag?: string }
  | { type: 'goal.reached'; category: string; goalMs: number; weeklyMs: number }

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

  return { onTimerStarted, onTimerStopped, onGoalReached }
}
