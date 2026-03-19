import type { Category, Session } from './timer'
import { computeWeekMs, computeStreak, getWeekDates } from './timer'
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

// ─── parseTimeEntryLocally ───────────────────────────────────────────────────

export function parseTimeEntryLocally(
  text: string,
  categories: { id: string; name: string }[],
  todayDate: string,
): ParsedTimeEntry | null {
  const lower = text.toLowerCase().trim()

  // Extract duration: "1h30m", "2h", "45m", "30min"
  const durationMatch = lower.match(/(\d+)h(?:\s*(\d+)\s*m(?:in)?)?|(\d+)\s*m(?:in)?\b/)
  if (!durationMatch) return null
  let hours: number, minutes: number
  if (durationMatch[1] !== undefined) {
    hours   = parseInt(durationMatch[1])
    minutes = durationMatch[2] !== undefined ? parseInt(durationMatch[2]) : 0
  } else {
    hours   = 0
    minutes = parseInt(durationMatch[3])
  }
  if (hours === 0 && minutes === 0) return null
  const durationMs = (hours * 60 + minutes) * 60_000

  // Extract date: "yesterday" → yesterday's ISO string, otherwise today
  let date = todayDate
  if (/yesterday/.test(lower)) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - 1)
    date = d.toISOString().slice(0, 10)
  }

  // Remove duration and date words to find remaining tokens
  const clean = lower
    .replace(/\d+h\s*\d*m?(?:in)?/g, '')
    .replace(/\d+\s*m(?:in)?/g, '')
    .replace(/yesterday|today/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Match category by longest common substring
  let bestCat: { id: string; name: string } | null = null
  let bestScore = 0
  for (const cat of categories) {
    const catLower = cat.name.toLowerCase()
    const catWords = catLower.split(/\s+/)
    const cleanWords = clean.split(/\s+/)
    let score = 0
    for (const cw of catWords) {
      if (cleanWords.some(w => w.startsWith(cw) || cw.startsWith(w))) score += cw.length
    }
    if (score > bestScore) { bestScore = score; bestCat = cat }
  }

  if (!bestCat || bestScore === 0) return null

  // Remaining words after removing category tokens = optional tag
  const catTokens = bestCat.name.toLowerCase().split(/\s+/)
  const tagWords = clean.split(/\s+/).filter(w => w && !catTokens.some(ct => w.startsWith(ct) || ct.startsWith(w)))
  const tag = tagWords.join(' ') || undefined

  return { categoryId: bestCat.id, date, startHour: 9, durationMs, tag }
}

// ─── callClaudeForParsing ─────────────────────────────────────────────────────

export type ParsedTimeEntry = {
  categoryId: string
  date: string          // YYYY-MM-DD
  startHour: number     // 0-23
  durationMs: number
  tag?: string
}

export async function callClaudeForParsing(
  text: string,
  categories: { id: string; name: string }[],
  apiKey: string | null,
  todayDate: string
): Promise<ParsedTimeEntry | null> {
  if (!apiKey) return parseTimeEntryLocally(text, categories, todayDate)
  // Serialize category data as JSON to prevent prompt injection via category names.
  const catJson = JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))
  const prompt = `You parse natural language time entries into JSON. Today is ${todayDate}.
Available categories (JSON array): ${catJson}

Parse this entry and respond ONLY with valid JSON:
{"categoryId":"<id>","date":"YYYY-MM-DD","startHour":9,"durationMs":7200000,"tag":"deep work"}

Rules:
- Pick the best matching categoryId from the categories array above
- "this morning" = 9h, "this afternoon" = 14h, "tonight" = 20h, "yesterday" = yesterday's date
- durationMs in milliseconds
- tag is optional: deep work, meeting, admin, learning, review
- If the input cannot be parsed, respond with the single word: null

Input to parse: ${JSON.stringify(text)}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API key. Check your settings.')
    if (response.status === 429) throw new Error('Rate limited. Please wait before trying again.')
    throw new Error('Unable to parse entry. Please try again.')
  }
  const data = await response.json() as { content: { text: string }[] }
  const raw = data.content[0]?.text?.trim() ?? 'null'
  try {
    return JSON.parse(raw) as ParsedTimeEntry | null
  } catch {
    return null
  }
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
    if (response.status === 401) throw new Error('Invalid API key. Check your settings.')
    if (response.status === 429) throw new Error('Rate limited. Please wait before trying again.')
    throw new Error('Unable to generate digest. Please try again.')
  }

  const data = await response.json() as { content: { text: string }[] }
  return data.content[0]?.text ?? ''
}
