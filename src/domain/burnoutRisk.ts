import type { Session } from './timer'

export type BurnoutLevel = 'low' | 'moderate' | 'high' | 'critical'

export type BurnoutRisk = {
  level: BurnoutLevel
  score: number // 0–100
  signals: string[]
}

const LATE_NIGHT_HOUR = 22 // sessions starting at or after 10pm
const WEEKEND_DAYS = [0, 6] // Sun, Sat
const MIN_WORK_SESSION_MS = 20 * 60_000 // 20 minutes

function isLateNight(startedAt: number): boolean {
  return new Date(startedAt).getHours() >= LATE_NIGHT_HOUR
}

function isWeekend(date: string): boolean {
  const day = new Date(date + 'T12:00:00Z').getUTCDay()
  return WEEKEND_DAYS.includes(day)
}

function getDailyWorkMs(sessions: Session[], dates: string[]): number[] {
  return dates.map(date =>
    sessions.filter(s => s.date === date).reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0),
  )
}

export function computeBurnoutRisk(
  sessions: Session[],
  today: string,
  weeklyFocusDebtLevel: 'minimal' | 'moderate' | 'high' | 'critical' = 'minimal',
): BurnoutRisk {
  const signals: string[] = []
  let score = 0

  // Signal 1: sessions in last 7 days
  const todayDate = new Date(today + 'T12:00:00Z')
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate)
    d.setUTCDate(todayDate.getUTCDate() - i)
    return d.toISOString().slice(0, 10)
  })
  const recentSessions = sessions.filter(s => last7.includes(s.date))

  // Late night sessions
  const lateNightCount = recentSessions.filter(s => isLateNight(s.startedAt)).length
  if (lateNightCount >= 3) {
    signals.push('burnout.signal.lateNight')
    score += 25
  } else if (lateNightCount >= 1) {
    score += 10
  }

  // Weekend work
  const weekendSessions = recentSessions.filter(
    s => isWeekend(s.date) && (s.endedAt - s.startedAt) >= MIN_WORK_SESSION_MS,
  )
  const weekendDays = new Set(weekendSessions.map(s => s.date)).size
  if (weekendDays >= 2) {
    signals.push('burnout.signal.weekendBoth')
    score += 20
  } else if (weekendDays === 1) {
    score += 8
  }

  // Daily overwork (> 9h/day)
  const dailyMs = getDailyWorkMs(recentSessions, last7)
  const overworkDays = dailyMs.filter(ms => ms > 9 * 3_600_000).length
  if (overworkDays >= 3) {
    signals.push('burnout.signal.overwork')
    score += 25
  } else if (overworkDays >= 1) {
    score += 10
  }

  // Focus debt contribution
  if (weeklyFocusDebtLevel === 'critical') {
    signals.push('burnout.signal.focusDebt')
    score += 30
  } else if (weeklyFocusDebtLevel === 'high') {
    score += 20
  } else if (weeklyFocusDebtLevel === 'moderate') {
    score += 10
  }

  // No rest days (7 consecutive days with sessions)
  const significantSessions = recentSessions.filter(s => (s.endedAt - s.startedAt) >= MIN_WORK_SESSION_MS)
  const daysWithSessions = new Set(significantSessions.map(s => s.date)).size
  if (daysWithSessions === 7) {
    signals.push('burnout.signal.noRest')
    score += 20
  }

  score = Math.min(100, score)

  let level: BurnoutLevel
  if (score < 20) level = 'low'
  else if (score < 45) level = 'moderate'
  else if (score < 70) level = 'high'
  else level = 'critical'

  return { level, score, signals }
}
