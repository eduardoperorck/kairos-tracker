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

export const PRESETS: Record<FocusGuardMode, { focusMinutes: number; breakMinutes: number; label: string; description: string }> = {
  'pomodoro':  { focusMinutes: 25,  breakMinutes: 5,  label: 'Pomodoro',  description: '25 min focus · 5 min break' },
  '52-17':     { focusMinutes: 52,  breakMinutes: 17, label: '52/17',     description: '52 min focus · 17 min break' },
  'ultradian': { focusMinutes: 90,  breakMinutes: 20, label: 'Ultradian', description: '90 min focus · 20 min break' },
  'custom':    { focusMinutes: 60,  breakMinutes: 10, label: 'Custom',    description: 'Your own interval' },
}

export type FocusPreset = { name: string; workMs: number; breakMs: number }

export const FOCUS_PRESETS: FocusPreset[] = [
  { name: 'Pomodoro', workMs: 25 * 60_000, breakMs: 5 * 60_000 },
  { name: '52/17',    workMs: 52 * 60_000, breakMs: 17 * 60_000 },
  { name: 'Ultradian', workMs: 90 * 60_000, breakMs: 20 * 60_000 },
  { name: 'Custom',   workMs: 60 * 60_000, breakMs: 10 * 60_000 },
]

// ─── getBreakSuggestions ──────────────────────────────────────────────────────

export function getBreakSuggestions(): string[] {
  return [
    'Take a short walk',
    'Stretch your neck and shoulders',
    'Drink some water',
    'Look at something 20 feet away for 20 seconds',
    'Do a few deep breaths',
  ]
}

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
