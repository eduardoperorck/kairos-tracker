/**
 * Slack status auto-update via users.profile.set API.
 * Token must have users.profile:write scope.
 */

export type SlackStatus = {
  text: string    // e.g. "Focused: Work · 45m"
  emoji: string   // e.g. ":timer_clock:"
  expirationMs?: number  // 0 = no expiration
}

async function setSlackStatus(token: string, status: SlackStatus): Promise<void> {
  const profile = {
    status_text: status.text,
    status_emoji: status.emoji,
    status_expiration: status.expirationMs ? Math.floor((Date.now() + status.expirationMs) / 1000) : 0,
  }
  const response = await fetch('https://slack.com/api/users.profile.set', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ profile }),
  })
  if (!response.ok) throw new Error(`Slack API error: ${response.status}`)
  const data = await response.json() as { ok: boolean; error?: string }
  if (!data.ok) throw new Error(`Slack API: ${data.error ?? 'unknown error'}`)
}

export async function setSlackFocusStatus(token: string, categoryName: string): Promise<void> {
  await setSlackStatus(token, {
    text: `Focused: ${categoryName}`,
    emoji: ':timer_clock:',
    expirationMs: 2 * 3_600_000, // clear after 2 hours
  })
}

export async function clearSlackStatus(token: string): Promise<void> {
  await setSlackStatus(token, { text: '', emoji: '' })
}
