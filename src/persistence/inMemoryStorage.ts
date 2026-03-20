import type { Storage, PersistedCategory, DailyCaptureStatRow } from './storage'
import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'
import type { WindowRule } from '../domain/passiveCapture'

export function createInMemoryStorage(): Storage {
  const rows = new Map<string, PersistedCategory>()
  const sessionRows: Session[] = []
  const settings = new Map<string, string>()
  const intentionRows: Intention[] = []
  const eveningReviewRows: EveningReview[] = []
  let activeEntry: { categoryId: string; startedAt: number } | null = null
  const captureStatRows = new Map<string, DailyCaptureStatRow>()
  const windowRules = new Map<string, WindowRule>()

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

    async loadWindowRules(): Promise<WindowRule[]> {
      return Array.from(windowRules.values())
    },

    async saveWindowRule(rule: WindowRule): Promise<void> {
      windowRules.set(rule.id, rule)
    },

    async deleteWindowRule(id: string): Promise<void> {
      windowRules.delete(id)
    },
  }
}
