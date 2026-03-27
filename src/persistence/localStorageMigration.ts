import type { Storage, CorrectionRecord } from './storage'
import type { WindowRule } from '../domain/passiveCapture'
import type { DomainRule } from '../domain/classifier'

const WINDOW_RULES_KEY = 'user_window_rules'
const DOMAIN_RULES_KEY = 'user_domain_rules'
const CORRECTION_KEY = 'correction_records'

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

/**
 * M65: One-time migration from localStorage to SQLite.
 * Reads user_window_rules, user_domain_rules, and correction_records from
 * localStorage, imports them into `storage`, then removes the localStorage keys.
 * Safe to call repeatedly — if the keys are already gone it is a no-op.
 */
export async function migrateLocalStorageRules(storage: Storage): Promise<void> {
  const windowRules = readJson<WindowRule>(WINDOW_RULES_KEY)
  const domainRules = readJson<DomainRule>(DOMAIN_RULES_KEY)
  const corrections = readJson<CorrectionRecord>(CORRECTION_KEY)

  for (const rule of windowRules) {
    await storage.saveWindowRule(rule)
  }
  if (windowRules.length > 0) localStorage.removeItem(WINDOW_RULES_KEY)

  for (const rule of domainRules) {
    await storage.saveDomainRule(rule)
  }
  if (domainRules.length > 0) localStorage.removeItem(DOMAIN_RULES_KEY)

  for (const record of corrections) {
    await storage.saveCorrection(record)
  }
  if (corrections.length > 0) localStorage.removeItem(CORRECTION_KEY)
}
