export type FocusDebtEvent = {
  type: keyof typeof DEBT_RULES
  timestamp: number
  label?: string
}

export const DEBT_RULES = {
  breakSkipped:        +15,
  sessionOver3h:       +20,
  dwsBelowThreshold:   +8,
  dayWithoutFocus:     +10,
  lateNightSession:    +12,
  breakCompleted:      -10,
  flowSession:         -20,
  highDwsDay:          -15,
  restDay:             -25,
} as const

export type DebtLevel = 'minimal' | 'moderate' | 'high' | 'critical'

export function computeFocusDebt(events: FocusDebtEvent[]): number {
  return events.reduce((acc, ev) => acc + DEBT_RULES[ev.type], 0)
}

export function getDebtLevel(debt: number): DebtLevel {
  if (debt <= 20) return 'minimal'
  if (debt <= 60) return 'moderate'
  if (debt <= 100) return 'high'
  return 'critical'
}

export function getDebtColor(level: DebtLevel): string {
  if (level === 'minimal') return 'text-emerald-400'
  if (level === 'moderate') return 'text-yellow-400'
  if (level === 'high') return 'text-orange-400'
  return 'text-red-400'
}

export function getDebtDescription(level: DebtLevel): string {
  if (level === 'minimal') return 'Your cognitive bank is healthy.'
  if (level === 'moderate') return 'Some cognitive debt accumulating — a rest session helps.'
  if (level === 'high') return 'High cognitive debt — your next deep work session may underperform.'
  return 'Critical debt — strongly consider a full rest period before demanding tasks.'
}

export function buildDebtEventsFromSessions(
  sessions: { endedAt: number; startedAt: number; date: string }[],
  breakSkipCount: number = 0,
  breakCompletedCount: number = 0,
  today?: string
): FocusDebtEvent[] {
  const events: FocusDebtEvent[] = []
  const now = Date.now()

  for (let i = 0; i < breakSkipCount; i++) {
    events.push({ type: 'breakSkipped', timestamp: now })
  }

  for (let i = 0; i < breakCompletedCount; i++) {
    events.push({ type: 'breakCompleted', timestamp: now })
  }

  for (const s of sessions) {
    const durationMs = s.endedAt - s.startedAt
    // Flow session bonus
    if (durationMs >= 45 * 60_000) {
      events.push({ type: 'flowSession', timestamp: s.endedAt })
    }
    // Over 3h penalty
    if (durationMs >= 3 * 3_600_000) {
      events.push({ type: 'sessionOver3h', timestamp: s.endedAt })
    }
    // Late night penalty (after 21h) — Walker (2017): cognitive impairment starts at 21:00
    const LATE_NIGHT_HOUR = 21
    const hour = new Date(s.startedAt).getHours()
    if (hour >= LATE_NIGHT_HOUR) {
      events.push({ type: 'lateNightSession', timestamp: s.startedAt })
    }
  }

  // Rest day credits: days in last 7 with zero sessions.
  // Only emit if the user has at least one session in the reference 7-day window
  // to avoid awarding rest-day credits before the user ever started using the app.
  const referenceDate = today ?? (sessions.length > 0
    ? sessions.reduce((max, s) => s.date > max ? s.date : max, sessions[0].date)
    : new Date().toISOString().slice(0, 10))

  const sevenDaysAgo = new Date(referenceDate + 'T12:00:00Z')
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)
  const datesInWindow = new Set(
    sessions.filter(s => s.date >= sevenDaysAgoStr && s.date <= referenceDate).map(s => s.date)
  )

  if (datesInWindow.size >= 2) {
    // emit rest days only for real users with actual history
    const sessionDates = new Set(sessions.map(s => s.date))
    for (let i = 1; i <= 7; i++) {
      const d = new Date(referenceDate + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      if (!sessionDates.has(dateStr)) {
        events.push({ type: 'restDay', timestamp: new Date(dateStr + 'T12:00:00Z').getTime() })
      }
    }
  }

  return events
}
