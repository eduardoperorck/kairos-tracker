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
  breakSkipCount: number = 0
): FocusDebtEvent[] {
  const events: FocusDebtEvent[] = []
  const now = Date.now()

  for (let i = 0; i < breakSkipCount; i++) {
    events.push({ type: 'breakSkipped', timestamp: now })
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
    // Late night penalty (after 22h)
    const hour = new Date(s.startedAt).getHours()
    if (hour >= 22) {
      events.push({ type: 'lateNightSession', timestamp: s.startedAt })
    }
  }

  return events
}
