import type { Storage, PersistedCategory, DailyCaptureStatRow, CorrectionRecord, ContextBookmark } from './storage'
import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'
import type { WindowRule } from '../domain/passiveCapture'
import type { DomainRule } from '../domain/classifier'

export function createInMemoryStorage(): Storage {
  const rows = new Map<string, PersistedCategory>()
  const sessionRows: Session[] = []
  const settings = new Map<string, string>()
  const intentionRows: Intention[] = []
  const eveningReviewRows: EveningReview[] = []
  let activeEntry: { categoryId: string; startedAt: number } | null = null
  const captureStatRows = new Map<string, DailyCaptureStatRow>()
  const windowRules = new Map<string, WindowRule>()
  const domainRules = new Map<string, DomainRule>()
  const corrections = new Map<string, CorrectionRecord>()
  const contextBookmarks = new Map<string, ContextBookmark>()

  return {
    async loadCategories() {
      return Array.from(rows.values())
    },

    async saveCategory(id, name) {
      if (!rows.has(id)) {
        rows.set(id, { id, name, accumulatedMs: 0 })
      }
    },

    async renameCategory(id, newName) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, name: newName })
    },

    async deleteCategory(id) {
      rows.delete(id)
    },

    async setWeeklyGoal(id, ms) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, weeklyGoalMs: ms })
    },

    async setColor(id, color) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, color })
    },

    async archiveCategory(id, archived) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, archived: archived || undefined })
    },

    async saveSession(session) {
      sessionRows.push(session)
    },

    async loadSessionsByDate(date) {
      return sessionRows.filter(s => s.date === date)
    },

    async loadSessionsSince(date) {
      return sessionRows.filter(s => s.date >= date)
    },

    async getSetting(key) {
      return settings.get(key) ?? null
    },

    async setSetting(key, value) {
      settings.set(key, value)
    },

    async saveIntention(intention) {
      intentionRows.push(intention)
    },

    async loadIntentionsByDate(date) {
      return intentionRows.filter(i => i.date === date)
    },

    async saveEveningReview(review) {
      const idx = eveningReviewRows.findIndex(r => r.date === review.date)
      if (idx >= 0) eveningReviewRows[idx] = review
      else eveningReviewRows.push(review)
    },

    async loadEveningReviewByDate(date) {
      return eveningReviewRows.find(r => r.date === date) ?? null
    },

    async importSessions(incoming) {
      for (const s of incoming) {
        if (!sessionRows.find(r => r.id === s.id)) sessionRows.push(s)
      }
    },

    async updateSessionTag(id, tag) {
      const idx = sessionRows.findIndex(s => s.id === id)
      if (idx >= 0) sessionRows[idx] = { ...sessionRows[idx], tag: tag ?? undefined }
    },

    async deleteSession(id) {
      const idx = sessionRows.findIndex(s => s.id === id)
      if (idx >= 0) sessionRows.splice(idx, 1)
    },

    async updateSessionTime(id, startedAt, endedAt) {
      const idx = sessionRows.findIndex(s => s.id === id)
      if (idx >= 0) sessionRows[idx] = { ...sessionRows[idx], startedAt, endedAt }
    },

    async purgeSessionsBefore(date: string): Promise<number> {
      const before = sessionRows.filter(s => s.date < date)
      const count = before.length
      sessionRows.splice(0, sessionRows.length, ...sessionRows.filter(s => s.date >= date))
      return count
    },

    async deleteAllSessions(): Promise<number> {
      const count = sessionRows.length
      sessionRows.splice(0, sessionRows.length)
      return count
    },

    async setActiveEntry(categoryId, startedAt) {
      activeEntry = { categoryId, startedAt }
    },

    async loadActiveEntry() {
      return activeEntry
    },

    async clearActiveEntry() {
      activeEntry = null
    },

    async saveDailyCaptureStat(row: DailyCaptureStatRow) {
      const key = `${row.date}|${row.process}`
      const existing = captureStatRows.get(key)
      if (existing) {
        captureStatRows.set(key, {
          ...existing,
          total_ms: existing.total_ms + row.total_ms,
          block_count: existing.block_count + row.block_count,
        })
      } else {
        captureStatRows.set(key, { ...row })
      }
    },

    async loadDailyCaptureStatsSince(date: string): Promise<DailyCaptureStatRow[]> {
      return Array.from(captureStatRows.values()).filter(r => r.date >= date)
    },

    async updateCaptureStatCategory(date: string, process: string, categoryId: string): Promise<void> {
      const key = `${date}|${process}`
      const existing = captureStatRows.get(key)
      if (existing) captureStatRows.set(key, { ...existing, category_id: categoryId })
    },

    async loadWindowRules(): Promise<WindowRule[]> {
      return Array.from(windowRules.values())
    },

    async saveWindowRule(rule: WindowRule): Promise<void> {
      windowRules.set(rule.id, rule)
    },

    async deleteWindowRule(id: string): Promise<void> {
      windowRules.delete(id)
    },

    async loadDomainRules(): Promise<DomainRule[]> {
      return Array.from(domainRules.values())
    },

    async saveDomainRule(rule: DomainRule): Promise<void> {
      domainRules.set(rule.id, rule)
    },

    async deleteDomainRule(id: string): Promise<void> {
      domainRules.delete(id)
    },

    async loadCorrections(): Promise<CorrectionRecord[]> {
      return Array.from(corrections.values())
    },

    async saveCorrection(record: CorrectionRecord): Promise<void> {
      corrections.set(`${record.contextKey}::${record.categoryId}`, record)
    },

    async loadContextBookmarks(): Promise<ContextBookmark[]> {
      return Array.from(contextBookmarks.values())
    },

    async saveContextBookmark(bookmark: ContextBookmark): Promise<void> {
      contextBookmarks.set(bookmark.id, bookmark)
    },

    async deleteContextBookmark(id: string): Promise<void> {
      contextBookmarks.delete(id)
    },
  }
}
