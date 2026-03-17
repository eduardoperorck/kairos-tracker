import type { Session } from './timer'
import { computeEnergyPattern } from './history'
import type { CaptureBlock } from './passiveCapture'
import { computeContextSwitches } from './contextSwitching'

export type Recommendation = {
  id: string
  text: string
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
      const peakStr = peakHours.map(h => `${h}:00`).join(' and ')
      recommendations.push({
        id: 'peak-hours',
        text: `Your peak focus hours are ${peakStr}. Consider blocking these for deep work and avoiding meetings.`,
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
        text: `You're switching apps ${Math.round(metrics.switchesPerHour)}/hour — consider closing secondary apps during focus sessions.`,
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
        text: `Meetings consumed ${meetingHours.toFixed(1)}h this week — above the 10h threshold. Consider batching meetings to protect focus blocks.`,
        priority: 'medium',
        category: 'schedule',
      })
    }
  }

  // Build time
  if (buildMinutesThisWeek > 30) {
    recommendations.push({
      id: 'build-time',
      text: `You spent ${(buildMinutesThisWeek / 60).toFixed(1)}h waiting for builds this week. Running builds in the background could reclaim this time.`,
      priority: 'low',
      category: 'habits',
    })
  }

  // Tracking consistency
  if (daysTracked > 0 && daysTracked < 5) {
    recommendations.push({
      id: 'tracking-consistency',
      text: `You tracked ${daysTracked} days this week. Consistent tracking gives more accurate insights — try enabling the timer at the start of each work session.`,
      priority: 'medium',
      category: 'habits',
    })
  }

  // Not enough data yet
  if (sessions.length < 5) {
    recommendations.push({
      id: 'more-data',
      text: "Keep tracking! After a few more sessions, you'll start seeing personalized patterns and recommendations.",
      priority: 'low',
      category: 'habits',
    })
  }

  return recommendations
}
