import type { Session } from './timer'
import { computeEnergyPattern } from './history'
import type { CaptureBlock } from './passiveCapture'
import { computeContextSwitches } from './contextSwitching'

export type Recommendation = {
  id: string
  textKey: string
  params: Record<string, string>
  priority: 'high' | 'medium' | 'low'
  category: 'schedule' | 'focus' | 'wellbeing' | 'habits'
}

export type RecommendationInput = {
  sessions: Session[]
  blocks: CaptureBlock[]
  meetingMinutesThisWeek?: number
  buildMinutesThisWeek?: number
  daysTracked?: number
}

export function generateRecommendations(input: RecommendationInput): Recommendation[] {
  const recommendations: Recommendation[] = []
  const { sessions, blocks, meetingMinutesThisWeek = 0, buildMinutesThisWeek = 0, daysTracked = 0 } = input

  // Peak hour protection recommendation
  if (sessions.length >= 10) {
    const { peakHours } = computeEnergyPattern(sessions, 30)
    if (peakHours.length > 0) {
      const peakStr = peakHours.map(h => `${h}:00`).join(', ')
      recommendations.push({
        id: 'peak-hours',
        textKey: 'rec.peakHours',
        params: { hours: peakStr },
        priority: 'high',
        category: 'schedule',
      })
    }
  }

  // Context switching recommendation
  if (blocks.length > 0) {
    const metrics = computeContextSwitches(blocks)
    if (metrics.status === 'fragmented') {
      recommendations.push({
        id: 'context-switching',
        textKey: 'rec.contextSwitching',
        params: { count: String(Math.round(metrics.switchesPerHour)) },
        priority: 'high',
        category: 'focus',
      })
    }
  }

  // Meeting overhead
  if (meetingMinutesThisWeek > 0) {
    const meetingHours = meetingMinutesThisWeek / 60
    if (meetingHours > 10) {
      recommendations.push({
        id: 'meeting-overhead',
        textKey: 'rec.meetingOverhead',
        params: { hours: meetingHours.toFixed(1) },
        priority: 'medium',
        category: 'schedule',
      })
    }
  }

  // Build time
  if (buildMinutesThisWeek > 30) {
    recommendations.push({
      id: 'build-time',
      textKey: 'rec.buildTime',
      params: { hours: (buildMinutesThisWeek / 60).toFixed(1) },
      priority: 'low',
      category: 'habits',
    })
  }

  // Tracking consistency
  if (daysTracked > 0 && daysTracked < 5) {
    recommendations.push({
      id: 'tracking-consistency',
      textKey: 'rec.trackingConsistency',
      params: { days: String(daysTracked) },
      priority: 'medium',
      category: 'habits',
    })
  }

  // Best focus day of week (requires ≥14 sessions across ≥3 days)
  if (sessions.length >= 14) {
    const dayTotals = new Map<number, { totalMs: number; count: number }>()
    for (const s of sessions) {
      const day = new Date(s.date).getDay()
      const entry = dayTotals.get(day) ?? { totalMs: 0, count: 0 }
      entry.totalMs += s.endedAt - s.startedAt
      entry.count += 1
      dayTotals.set(day, entry)
    }
    // Only consider weekdays
    const weekdays = [1, 2, 3, 4, 5].filter(d => dayTotals.has(d))
    if (weekdays.length >= 3) {
      const best = weekdays.sort((a, b) => {
        const ea = dayTotals.get(a)!
        const eb = dayTotals.get(b)!
        return (eb.totalMs / eb.count) - (ea.totalMs / ea.count)
      })[0]
      const data = dayTotals.get(best)!
      const avgH = (data.totalMs / data.count / 3_600_000).toFixed(1)
      recommendations.push({
        id: 'best-focus-day',
        textKey: 'rec.bestFocusDay',
        params: { dayIndex: String(best), hours: avgH },
        priority: 'medium',
        category: 'schedule',
      })
    }
  }

  // Declining average session length (last 7 sessions vs. previous 7)
  if (sessions.length >= 14) {
    const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
    const avgMs = (arr: Session[]) => arr.reduce((s, x) => s + (x.endedAt - x.startedAt), 0) / arr.length
    const recentAvg = avgMs(sorted.slice(-7))
    const prevAvg   = avgMs(sorted.slice(-14, -7))
    if (recentAvg < prevAvg * 0.75) {
      recommendations.push({
        id: 'declining-sessions',
        textKey: 'rec.decliningSessions',
        params: { pct: String(Math.round((1 - recentAvg / prevAvg) * 100)) },
        priority: 'high',
        category: 'wellbeing',
      })
    }
  }

  // Not enough data yet
  if (sessions.length < 5) {
    recommendations.push({
      id: 'more-data',
      textKey: 'rec.moreData',
      params: {},
      priority: 'low',
      category: 'habits',
    })
  }

  return recommendations
}
