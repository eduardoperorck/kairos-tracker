import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionManagement } from './useSessionManagement'

// ── Store mock ────────────────────────────────────────────────────────────────
const mockAddCategory = vi.fn()
const mockStartTimer = vi.fn()
const mockStopTimer = vi.fn()
const mockSetState = vi.fn()

let mockCategories: any[] = []
let mockSessions: any[] = []

vi.mock('../store/useTimerStoreHook', () => ({
  useTimerState: () => ({
    categories: mockCategories,
    sessions: mockSessions,
    addCategory: mockAddCategory,
    startTimer: mockStartTimer,
    stopTimer: mockStopTimer,
    setWeeklyGoal: vi.fn(),
    setCategoryColor: vi.fn(),
    setPendingTag: vi.fn(),
    archiveCategory: vi.fn(),
    renameCategory: vi.fn(),
  }),
}))

let mockGetState: () => any
vi.mock('../store/useTimerStore', () => ({
  useTimerStore: {
    getState: () => mockGetState(),
    setState: (v: any) => mockSetState(v),
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeStorage() {
  return {
    saveCategory: vi.fn().mockResolvedValue(undefined),
    saveSession: vi.fn().mockResolvedValue(undefined),
    setActiveEntry: vi.fn().mockResolvedValue(undefined),
    clearActiveEntry: vi.fn().mockResolvedValue(undefined),
  } as any
}

function makeNotifications() {
  return {
    notifyGoalMilestone: vi.fn().mockResolvedValue(undefined),
    notifyGoalReached: vi.fn().mockResolvedValue(undefined),
  } as any
}

const NOW = 1_700_000_000_000

describe('useSessionManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(NOW)
    mockCategories = []
    mockSessions = []
    mockGetState = () => ({ categories: mockCategories, sessions: mockSessions })
  })

  // ── handleAdd ───────────────────────────────────────────────────────────────
  describe('handleAdd', () => {
    it('does nothing when input is empty', async () => {
      const storage = makeStorage()
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      await act(async () => { await result.current.handleAdd() })
      expect(mockAddCategory).not.toHaveBeenCalled()
      expect(storage.saveCategory).not.toHaveBeenCalled()
    })

    it('adds category and saves to storage when input has text', async () => {
      const storage = makeStorage()
      const newCat = { id: 'cat-1', name: 'Work' }
      mockGetState = () => ({ categories: [newCat], sessions: [] })
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      act(() => { result.current.setInput('Work') })
      await act(async () => { await result.current.handleAdd() })
      expect(mockAddCategory).toHaveBeenCalledWith('Work')
      expect(storage.saveCategory).toHaveBeenCalledWith('cat-1', 'Work')
      expect(result.current.input).toBe('')
    })
  })

  // ── handleStart ─────────────────────────────────────────────────────────────
  describe('handleStart', () => {
    it('starts timer and persists active entry', async () => {
      const storage = makeStorage()
      const entry = { startedAt: NOW - 60_000, endedAt: null }
      mockCategories = [{ id: 'cat-1', name: 'Work', activeEntry: null }]
      mockGetState = () => ({
        categories: [{ id: 'cat-1', activeEntry: entry }],
        sessions: [],
      })
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      await act(async () => { await result.current.handleStart('cat-1') })
      expect(mockStartTimer).toHaveBeenCalledWith('cat-1')
      expect(storage.setActiveEntry).toHaveBeenCalledWith('cat-1', entry.startedAt)
    })

    it('saves previous session when switching after MIN_SESSION_MS', async () => {
      const storage = makeStorage()
      const prevEntry = { startedAt: NOW - 60_000, endedAt: null }
      const prevSession = { id: 's1', categoryId: 'cat-1', startedAt: NOW - 60_000, endedAt: NOW, date: '2023-11-14' }
      mockCategories = [
        { id: 'cat-1', name: 'Work', activeEntry: prevEntry },
        { id: 'cat-2', name: 'Study', activeEntry: null },
      ]
      mockGetState = () => ({
        categories: [{ id: 'cat-2', activeEntry: { startedAt: NOW, endedAt: null } }],
        sessions: [prevSession],
      })
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      await act(async () => { await result.current.handleStart('cat-2') })
      expect(storage.saveSession).toHaveBeenCalledWith(prevSession)
    })

    it('drops micro-session when switching before MIN_SESSION_MS', async () => {
      const storage = makeStorage()
      const prevEntry = { startedAt: NOW - 5_000, endedAt: null } // only 5s elapsed
      const prevSession = { id: 's1', categoryId: 'cat-1', startedAt: NOW - 5_000, endedAt: NOW, date: '2023-11-14' }
      mockCategories = [
        { id: 'cat-1', name: 'Work', activeEntry: prevEntry },
        { id: 'cat-2', name: 'Study', activeEntry: null },
      ]
      mockGetState = () => ({
        categories: [{ id: 'cat-2', activeEntry: { startedAt: NOW, endedAt: null } }],
        sessions: [prevSession],
      })
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      await act(async () => { await result.current.handleStart('cat-2') })
      expect(storage.saveSession).not.toHaveBeenCalled()
      expect(mockSetState).toHaveBeenCalledWith({ sessions: [] }) // sliced away
    })
  })

  // ── handleStop ──────────────────────────────────────────────────────────────
  describe('handleStop', () => {
    it('drops micro-session and clears active entry without saving', async () => {
      const storage = makeStorage()
      const entry = { startedAt: NOW - 5_000, endedAt: null }
      const shortSession = { id: 's1', categoryId: 'cat-1', startedAt: NOW - 5_000, endedAt: NOW, date: '2023-11-14' }
      mockCategories = [{ id: 'cat-1', name: 'Work', activeEntry: entry, weeklyGoalMs: null }]
      mockSessions = []
      mockGetState = () => ({ categories: mockCategories, sessions: [shortSession] })
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      await act(async () => { await result.current.handleStop('cat-1') })
      expect(storage.saveSession).not.toHaveBeenCalled()
      expect(storage.clearActiveEntry).toHaveBeenCalled()
      expect(mockSetState).toHaveBeenCalledWith({ sessions: [] })
    })

    it('saves long session and clears active entry', async () => {
      const storage = makeStorage()
      const entry = { startedAt: NOW - 60_000, endedAt: null }
      const longSession = { id: 's1', categoryId: 'cat-1', startedAt: NOW - 60_000, endedAt: NOW, date: '2023-11-14' }
      mockCategories = [{ id: 'cat-1', name: 'Work', activeEntry: entry, weeklyGoalMs: null }]
      mockSessions = [longSession]
      mockGetState = () => ({ categories: mockCategories, sessions: [longSession] })
      const { result } = renderHook(() =>
        useSessionManagement({ storage, recentTitles: [], captureBlocksRef: { current: [] }, flushCaptureStats: vi.fn(), notifications: makeNotifications(), setLastSwitch: vi.fn(), weekDates: [] })
      )
      await act(async () => { await result.current.handleStop('cat-1') })
      expect(storage.saveSession).toHaveBeenCalledWith(longSession)
      expect(storage.clearActiveEntry).toHaveBeenCalled()
    })
  })
})
