import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'

export type PersistedCategory = {
  id: string
  name: string
  accumulatedMs: number
  weeklyGoalMs?: number
  color?: string
}

export const SettingKey = {
  WebhookUrl: 'webhook_url',
  FocusPreset: 'focus_preset',
  FocusStrictMode: 'focus_strict_mode',
  AnthropicApiKey: 'anthropic_api_key',
  GithubUsername: 'github_username',
  ScreenshotsEnabled: 'screenshots_enabled',
  ScreenshotsRetention: 'screenshots_retention',
  SyncPath: 'sync_path',
} as const

export type SettingKeyType = typeof SettingKey[keyof typeof SettingKey]

export interface CategoryStorage {
  loadCategories(): Promise<PersistedCategory[]>
  saveCategory(id: string, name: string): Promise<void>
  renameCategory(id: string, newName: string): Promise<void>
  deleteCategory(id: string): Promise<void>
  setWeeklyGoal(id: string, ms: number): Promise<void>
  setColor(id: string, color: string): Promise<void>
}

export type ActiveEntry = { categoryId: string; startedAt: number }

export interface SessionStorage {
  saveSession(session: Session): Promise<void>
  loadSessionsByDate(date: string): Promise<Session[]>
  loadSessionsSince(date: string): Promise<Session[]>
  importSessions(sessions: Session[]): Promise<void>
  loadActiveEntry(): Promise<ActiveEntry | null>
  setActiveEntry(categoryId: string, startedAt: number): Promise<void>
  clearActiveEntry(): Promise<void>
}

export interface SettingsStorage {
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
}

export interface IntentionStorage {
  saveIntention(intention: Intention): Promise<void>
  loadIntentionsByDate(date: string): Promise<Intention[]>
  saveEveningReview(review: EveningReview): Promise<void>
  loadEveningReviewByDate(date: string): Promise<EveningReview | null>
}

// Full storage adapter — composes all sub-interfaces.
export interface Storage extends CategoryStorage, SessionStorage, SettingsStorage, IntentionStorage {}
