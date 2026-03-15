import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'

export type PersistedCategory = {
  id: string
  name: string
  accumulatedMs: number
  weeklyGoalMs?: number
  color?: string
}

export interface Storage {
  loadCategories(): Promise<PersistedCategory[]>
  saveCategory(id: string, name: string): Promise<void>
  renameCategory(id: string, newName: string): Promise<void>
  deleteCategory(id: string): Promise<void>
  setWeeklyGoal(id: string, ms: number): Promise<void>
  setColor(id: string, color: string): Promise<void>
  saveSession(session: Session): Promise<void>
  loadSessionsByDate(date: string): Promise<Session[]>
  loadSessionsSince(date: string): Promise<Session[]>
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  saveIntention(intention: Intention): Promise<void>
  loadIntentionsByDate(date: string): Promise<Intention[]>
  saveEveningReview(review: EveningReview): Promise<void>
  loadEveningReviewByDate(date: string): Promise<EveningReview | null>
  importSessions(sessions: Session[]): Promise<void>
}
