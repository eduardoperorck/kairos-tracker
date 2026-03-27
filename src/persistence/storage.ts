import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'
import type { WindowRule } from '../domain/passiveCapture'
import type { DomainRule } from '../domain/classifier'

export type PersistedCategory = {
  id: string
  name: string
  accumulatedMs: number
  weeklyGoalMs?: number
  color?: string
  archived?: boolean
}

export const SettingKey = {
  FocusPreset: 'focus_preset',
  FocusStrictMode: 'focus_strict_mode',
  AnthropicApiKey: 'anthropic_api_key',
  GithubUsername: 'github_username',
  ScreenshotsEnabled: 'screenshots_enabled',
  ScreenshotsRetention: 'screenshots_retention',
  SyncPath: 'sync_path',
  WorkspaceRoot: 'workspace_root',
  ObsidianVaultPath: 'obsidian_vault_path',
  Language: 'language',
  HourlyRate: 'hourly_rate',
} as const

export type SettingKeyType = typeof SettingKey[keyof typeof SettingKey]

export interface CategoryStorage {
  loadCategories(): Promise<PersistedCategory[]>
  saveCategory(id: string, name: string): Promise<void>
  renameCategory(id: string, newName: string): Promise<void>
  deleteCategory(id: string): Promise<void>
  setWeeklyGoal(id: string, ms: number): Promise<void>
  setColor(id: string, color: string): Promise<void>
  archiveCategory(id: string, archived: boolean): Promise<void>
}

export type ActiveEntry = { categoryId: string; startedAt: number }

export interface SessionStorage {
  saveSession(session: Session): Promise<void>
  loadSessionsByDate(date: string): Promise<Session[]>
  loadSessionsSince(date: string): Promise<Session[]>
  importSessions(sessions: Session[]): Promise<void>
  updateSessionTag(id: string, tag: string | null): Promise<void>
  deleteSession(id: string): Promise<void>
  updateSessionTime(id: string, startedAt: number, endedAt: number): Promise<void>
  loadActiveEntry(): Promise<ActiveEntry | null>
  setActiveEntry(categoryId: string, startedAt: number): Promise<void>
  clearActiveEntry(): Promise<void>
  purgeSessionsBefore(date: string): Promise<number>
  deleteAllSessions(): Promise<number>
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

export type DailyCaptureStatRow = {
  date: string
  process: string
  total_ms: number
  block_count: number
  category_id: string | null
}

export interface CaptureStorage {
  saveDailyCaptureStat(row: DailyCaptureStatRow): Promise<void>
  loadDailyCaptureStatsSince(date: string): Promise<DailyCaptureStatRow[]>
  /** M89: Update category_id for all daily_capture_stats rows matching date+process */
  updateCaptureStatCategory(date: string, process: string, categoryId: string): Promise<void>
}

export interface WindowRuleStorage {
  loadWindowRules(): Promise<WindowRule[]>
  saveWindowRule(rule: WindowRule): Promise<void>
  deleteWindowRule(id: string): Promise<void>
}

export interface DomainRuleStorage {
  loadDomainRules(): Promise<DomainRule[]>
  saveDomainRule(rule: DomainRule): Promise<void>
  deleteDomainRule(id: string): Promise<void>
}

export type CorrectionRecord = {
  contextKey: string
  categoryId: string
  count: number
}

export interface CorrectionStorage {
  loadCorrections(): Promise<CorrectionRecord[]>
  saveCorrection(record: CorrectionRecord): Promise<void>
}

export type ContextBookmark = {
  id: string
  name: string
  categoryId: string
  workspace: string | null
  domain: string | null
  createdAt: number
}

export interface ContextBookmarkStorage {
  loadContextBookmarks(): Promise<ContextBookmark[]>
  saveContextBookmark(bookmark: ContextBookmark): Promise<void>
  deleteContextBookmark(id: string): Promise<void>
}

// Full storage adapter — composes all sub-interfaces.
export interface Storage extends CategoryStorage, SessionStorage, SettingsStorage, IntentionStorage, CaptureStorage, WindowRuleStorage, DomainRuleStorage, CorrectionStorage, ContextBookmarkStorage {}
