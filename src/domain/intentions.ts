// ─── Intentions domain ────────────────────────────────────────────────────────

export type Intention = {
  date: string
  text: string
  createdAt: number
}

export type EveningReview = {
  date: string
  mood?: 1 | 2 | 3 | 4 | 5
  notes: string
  createdAt: number
}

export function createIntention(text: string, date: string): Intention {
  return { date, text, createdAt: Date.now() }
}

export function createEveningReview(date: string, mood: (1 | 2 | 3 | 4 | 5) | undefined, notes: string): EveningReview {
  return { date, mood, notes, createdAt: Date.now() }
}

export function getIntentionsForDate(intentions: Intention[], date: string): Intention[] {
  return intentions.filter(i => i.date === date)
}
