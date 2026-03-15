import type { Category, Session } from './timer'
import { computeWeekMs, computeStreak, toDateString, getWeekDates } from './timer'
import { computeEnergyPattern, isFlowSession } from './history'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DigestCategoryPayload = {
  name: string
  weeklyMs: number
  goalMs: number
  streak: number
  flowSessions: number
}

export type DigestPayload = {
  week: string
  categories: DigestCategoryPayload[]
  energyPeakHours: number[]
  totalMs: number
}

// ─── buildDigestPayload ───────────────────────────────────────────────────────

export function buildDigestPayload(
  categories: Category[],
  sessions: Session[],
  historySessions: Session[],
  today: string
): DigestPayload {
  const weekDates = getWeekDates(today)
  const weekKey = weekDates[0] // Monday date as week identifier

  const cats: DigestCategoryPayload[] = categories.map(cat => {
    const weeklyMs = computeWeekMs(sessions, cat.id, weekDates)
    const streak = computeStreak(
      historySessions.filter(s => s.categoryId === cat.id).map(s => s.date),
      today
    )
    const flowSessions = sessions.filter(s =>
      s.categoryId === cat.id && weekDates.includes(s.date) && isFlowSession(s)
    ).length

    return {
      name: cat.name,
      weeklyMs,
      goalMs: cat.weeklyGoalMs ?? 0,
      streak,
      flowSessions,
    }
  })

  const { peakHours } = computeEnergyPattern(historySessions, 30)
  const totalMs = cats.reduce((sum, c) => sum + c.weeklyMs, 0)

  return { week: weekKey, categories: cats, energyPeakHours: peakHours, totalMs }
}

// ─── formatDigestPrompt ───────────────────────────────────────────────────────

export function formatDigestPrompt(payload: DigestPayload): string {
  const msToH = (ms: number) => (ms / 3_600_000).toFixed(1)

  const catLines = payload.categories
    .filter(c => c.weeklyMs > 0 || c.goalMs > 0)
    .map(c => {
      const parts = [`${c.name}: ${msToH(c.weeklyMs)}h tracked`]
      if (c.goalMs > 0) parts.push(`goal ${msToH(c.goalMs)}h`)
      if (c.streak > 0) parts.push(`${c.streak}d streak`)
      if (c.flowSessions > 0) parts.push(`${c.flowSessions} flow sessions`)
      return parts.join(', ')
    })
    .join('\n')

  const peakStr = payload.energyPeakHours.length > 0
    ? `Peak hours: ${payload.energyPeakHours.map(h => `${h}h`).join(', ')}`
    : ''

  return `You are a productivity coach. Analyze this week's time tracking data and give a concise, encouraging 2-3 sentence insight in the same language the user appears to be using.

Week: ${payload.week}
Total tracked: ${msToH(payload.totalMs)}h

${catLines}
${peakStr}

Be specific, mention the strongest category and one actionable suggestion.`
}

// ─── callDigestAPI ────────────────────────────────────────────────────────────

export async function callDigestAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { content: { text: string }[] }
  return data.content[0]?.text ?? ''
}
