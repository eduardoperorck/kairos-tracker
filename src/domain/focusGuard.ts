import type { TimerEntry, Session } from './timer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FocusGuardMode = 'pomodoro' | '52-17' | 'ultradian' | 'custom'

export type FocusGuardConfig = {
  enabled: boolean
  mode: FocusGuardMode
  focusMinutes: number
  breakMinutes: number
  strictMode: boolean
  postponeAllowed: boolean
}

export type FocusStats = {
  compliance: number
  longestSessionMs: number
  avgSessionMs: number
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const PRESETS: Record<FocusGuardMode, { focusMinutes: number; breakMinutes: number }> = {
  'pomodoro':  { focusMinutes: 25,  breakMinutes: 5  },
  '52-17':     { focusMinutes: 52,  breakMinutes: 17 },
  'ultradian': { focusMinutes: 90,  breakMinutes: 20 },
  'custom':    { focusMinutes: 60,  breakMinutes: 10 },
}

/** key: stable i18n identifier used for display; name: stored value (English) used for persistence. */
export type FocusPreset = { key?: string; name: string; workMs: number; breakMs: number }

export const FOCUS_PRESETS: FocusPreset[] = [
  { key: 'pomodoro',  name: 'Pomodoro',  workMs: 25 * 60_000, breakMs: 5 * 60_000 },
  { key: '52-17',     name: '52/17',     workMs: 52 * 60_000, breakMs: 17 * 60_000 },
  { key: 'ultradian', name: 'Ultradian', workMs: 90 * 60_000, breakMs: 20 * 60_000 },
  { key: 'custom',    name: 'Custom',    workMs: 60 * 60_000, breakMs: 10 * 60_000 },
]

// ─── getSessionMs ─────────────────────────────────────────────────────────────

export function getSessionMs(entry: TimerEntry | null, now: number): number {
  if (!entry) return 0
  const end = entry.endedAt ?? now
  return end - entry.startedAt
}

// ─── shouldBreakNow ───────────────────────────────────────────────────────────

export function shouldBreakNow(entry: TimerEntry | null, config: FocusGuardConfig, now: number): boolean {
  if (!entry || !config.enabled) return false
  const sessionMs = getSessionMs(entry, now)
  return sessionMs >= config.focusMinutes * 60_000
}

// ─── shouldTriggerBreak (simple API for FocusGuard component) ─────────────────

export function shouldTriggerBreak(startedAt: number, now: number, workMs: number): boolean {
  return now - startedAt >= workMs
}

/** Returns remaining break time in ms (0 if done). */
export function remainingBreakMs(breakStartedAt: number, now: number, breakMs: number): number {
  return Math.max(0, breakMs - (now - breakStartedAt))
}

// ─── computeFocusStats ────────────────────────────────────────────────────────

export function computeFocusStats(sessions: Session[], config: FocusGuardConfig): FocusStats {
  if (sessions.length === 0) {
    return { compliance: 0, longestSessionMs: 0, avgSessionMs: 0 }
  }

  const targetMs = config.focusMinutes * 60_000
  let compliant = 0
  let longestMs = 0
  let totalMs = 0

  for (const s of sessions) {
    const dur = s.endedAt - s.startedAt
    if (dur > longestMs) longestMs = dur
    totalMs += dur
    // A session is "compliant" if it stayed within 1.5x the target (didn't massively overshoot)
    if (dur <= targetMs * 1.5) compliant++
  }

  return {
    compliance: Math.round((compliant / sessions.length) * 100),
    longestSessionMs: longestMs,
    avgSessionMs: Math.round(totalMs / sessions.length),
  }
}
