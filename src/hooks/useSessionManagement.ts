import { useState, useRef } from 'react'
import { useTimerState } from '../store/useTimerStoreHook'
import { useTimerStore } from '../store/useTimerStore'
import { computeWeekMs } from '../domain/timer'
import { suggestSessionTag } from '../domain/sessionNaming'
import type { Storage } from '../persistence/storage'
import type { useNotifications } from './useNotifications'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { CalendarEvent } from '../domain/calendarParser'

const MEETING_KEYWORDS = ['meeting', 'call', 'standup', 'stand-up', 'interview', 'sync', 'review', '1:1', 'demo']

function loadCalendarEvents(): CalendarEvent[] {
  try { return JSON.parse(localStorage.getItem('calendar_events') ?? '[]') } catch { return [] }
}

function findMeetingTag(session: { startedAt: number; endedAt: number }, events: CalendarEvent[]): string | null {
  for (const ev of events) {
    const overlaps = ev.start < session.endedAt && ev.end > session.startedAt
    if (!overlaps) continue
    const lower = ev.summary.toLowerCase()
    if (MEETING_KEYWORDS.some(kw => lower.includes(kw))) return 'meeting'
  }
  return null
}

const MIN_SESSION_MS = 30_000 // 30 seconds — micro-session gate

interface Deps {
  storage: Storage
  recentTitles: string[]
  captureBlocksRef: React.RefObject<CaptureBlock[]>
  flushCaptureStats: (blocks: CaptureBlock[]) => Promise<void>
  notifications: ReturnType<typeof useNotifications>
  setLastSwitch: (v: { at: number; fromName: string } | null) => void
  weekDates: string[]
}

export function useSessionManagement(deps: Deps) {
  const { storage, recentTitles, captureBlocksRef, flushCaptureStats, notifications, setLastSwitch, weekDates } = deps
  const { categories, sessions, addCategory, startTimer, stopTimer } = useTimerState()
  const [input, setInput] = useState('')

  // Keep a stable ref to deps used in async callbacks
  const depsRef = useRef(deps)
  depsRef.current = deps

  async function handleAdd() {
    const name = input.trim()
    if (!name) return
    addCategory(name)
    setInput('')
    const { categories: next } = useTimerStore.getState()
    const created = next[next.length - 1]
    await storage.saveCategory(created.id, created.name)
  }

  async function handleStart(id: string) {
    const prev = categories.find(c => c.activeEntry !== null)
    const prevStartedAt = prev?.activeEntry?.startedAt ?? null
    if (prev && prev.id !== id) {
      setLastSwitch({ at: Date.now(), fromName: prev.name })
      void flushCaptureStats(captureBlocksRef.current ?? [])
    }
    startTimer(id)
    if (prev && prev.id !== id) {
      const elapsed = prevStartedAt !== null ? Date.now() - prevStartedAt : 0
      const { sessions: s } = useTimerStore.getState()
      if (elapsed >= MIN_SESSION_MS) {
        await storage.saveSession(s[s.length - 1])
      } else {
        useTimerStore.setState({ sessions: s.slice(0, -1) })
      }
    }
    const entry = useTimerStore.getState().categories.find(c => c.id === id)?.activeEntry
    if (entry) {
      await storage.setActiveEntry(id, entry.startedAt)
    }
  }

  async function handleStop(id: string, tag?: string): Promise<import('../domain/timer').Session | null> {
    const cat = categories.find(c => c.id === id)
    const entry = cat?.activeEntry
    const weeklyBefore = computeWeekMs(sessions, id, weekDates)
    const resolvedTag = tag ?? suggestSessionTag(recentTitles) ?? undefined
    stopTimer(id, resolvedTag)
    const { sessions: s } = useTimerStore.getState()
    const saved = s[s.length - 1]
    const elapsed = entry ? saved.endedAt - entry.startedAt : 0
    if (elapsed < MIN_SESSION_MS) {
      useTimerStore.setState({ sessions: s.slice(0, -1) })
      await storage.clearActiveEntry()
      return null
    }
    // M93: Auto-tag sessions overlapping with calendar meeting events
    const calendarEvents = loadCalendarEvents()
    if (calendarEvents.length > 0 && !resolvedTag) {
      const meetingTag = findMeetingTag(saved, calendarEvents)
      if (meetingTag) {
        await storage.updateSessionTag(saved.id, meetingTag)
      }
    }

    await storage.saveSession(saved)
    await storage.clearActiveEntry()

    const sessionResult = saved

    if (cat && entry) {
      const weeklyAfterStop = weeklyBefore + (saved.endedAt - entry.startedAt)
      const goalMs = cat.weeklyGoalMs ?? 0
      if (goalMs > 0) {
        const pctBefore = (weeklyBefore / goalMs) * 100
        const pctAfter  = (weeklyAfterStop / goalMs) * 100
        for (const milestone of [25, 50, 75] as const) {
          if (pctBefore < milestone && pctAfter >= milestone) {
            void notifications.notifyGoalMilestone(cat.name, milestone)
          }
        }
        if (pctBefore < 100 && pctAfter >= 100) {
          notifications.notifyGoalReached(cat.name, Math.round(goalMs / 3_600_000))
        }
      }
    }
    return sessionResult
  }

  return { input, setInput, handleAdd, handleStart, handleStop }

}
