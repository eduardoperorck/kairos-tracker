import type { Session, Category } from './timer'
import { computeStreak } from './timer'
import { computeFocusDebt, buildDebtEventsFromSessions, getDebtLevel } from './focusDebt'

export type PartnerCard = {
  version: 1
  exportedAt: string       // ISO date
  nickname: string
  streaks: Record<string, number>   // categoryId → streak days
  dwsAvgThisWeek: number           // 0–100
  weeklyGoalPct: number            // 0–100 (% of total weekly goal hit)
  focusDebtLevel: 'minimal' | 'moderate' | 'high' | 'critical'
  topCategory: string | null       // category name with most time this week
}

export function buildPartnerCard(
  nickname: string,
  sessions: Session[],
  categories: Category[],
  weeklyGoalMs: number,
  breakSkipCount = 0,
  dwsAvg = 0
): PartnerCard {
  const streaks: Record<string, number> = {}
  const today = new Date().toISOString().slice(0, 10)
  for (const cat of categories) {
    streaks[cat.id] = computeStreak(
      sessions.filter(s => s.categoryId === cat.id).map(s => s.date),
      today
    )
  }

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  const weekStartMs = weekStart.getTime()

  const weekSessions = sessions.filter(s => s.startedAt >= weekStartMs)
  const weekMs = weekSessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
  const weeklyGoalPct = weeklyGoalMs > 0 ? Math.min(100, Math.round((weekMs / weeklyGoalMs) * 100)) : 0

  const msPerCategory: Record<string, number> = {}
  for (const s of weekSessions) {
    msPerCategory[s.categoryId] = (msPerCategory[s.categoryId] ?? 0) + (s.endedAt - s.startedAt)
  }
  const topCatId = Object.entries(msPerCategory).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
  const topCategory = topCatId ? (categories.find(c => c.id === topCatId)?.name ?? null) : null

  const debtEvents = buildDebtEventsFromSessions(sessions, breakSkipCount)
  const debt = computeFocusDebt(debtEvents)
  const focusDebtLevel = getDebtLevel(debt)

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    nickname,
    streaks,
    dwsAvgThisWeek: Math.round(dwsAvg),
    weeklyGoalPct,
    focusDebtLevel,
    topCategory,
  }
}

export function validatePartnerCard(raw: unknown): PartnerCard | null {
  if (!raw || typeof raw !== 'object') return null
  const card = raw as Record<string, unknown>
  if (card.version !== 1) return null
  if (typeof card.nickname !== 'string' || card.nickname.length === 0) return null
  if (typeof card.exportedAt !== 'string') return null
  if (typeof card.dwsAvgThisWeek !== 'number') return null
  if (typeof card.weeklyGoalPct !== 'number') return null
  if (!['minimal', 'moderate', 'high', 'critical'].includes(card.focusDebtLevel as string)) return null
  return card as unknown as PartnerCard
}
