import type { Session } from './timer'

// Daily Focus Score — composite of tracking volume + session quality
// Range: 0–100

const DEEP_FOCUS_THRESHOLD_MS = 25 * 60_000  // 25 min — considered a focused session
const TARGET_DAY_MS = 6 * 3_600_000          // 6 hours — 100% volume score

export function computeDailyFocusScore(sessions: Session[]): number {
  if (sessions.length === 0) return 0

  const totalMs = sessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
  const focusedSessions = sessions.filter(s => (s.endedAt - s.startedAt) >= DEEP_FOCUS_THRESHOLD_MS)

  // Component 1 (0–50): total tracked time relative to 6h target
  const volumeScore = Math.min(50, Math.round((totalMs / TARGET_DAY_MS) * 50))

  // Component 2 (0–30): average session duration quality
  const avgMs = totalMs / sessions.length
  const avgScore = Math.min(30, Math.round((avgMs / DEEP_FOCUS_THRESHOLD_MS) * 15))

  // Component 3 (0–20): fraction of sessions that crossed the focus threshold
  const qualityScore = Math.round((focusedSessions.length / sessions.length) * 20)

  return Math.min(100, volumeScore + avgScore + qualityScore)
}

export function getDailyFocusLabel(score: number): string {
  if (score === 0) return 'No sessions'
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Strong'
  if (score >= 40) return 'Moderate'
  if (score >= 20) return 'Light'
  return 'Getting started'
}

export function getDailyFocusColor(score: number): string {
  if (score >= 80) return '#34d399' // emerald-400
  if (score >= 60) return '#60a5fa' // blue-400
  if (score >= 40) return '#facc15' // yellow-400
  if (score >= 20) return '#fb923c' // orange-400
  return '#f87171'                   // red-400
}
