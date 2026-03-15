import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTimerState } from '../store/useTimerStoreHook'
import { useTimerStore } from '../store/useTimerStore'
import { CategoryItem } from './CategoryItem'
import { StatsView } from './StatsView'
import { HistoryView } from './HistoryView'
import { FocusGuard } from './FocusGuard'
import { IntentionsView } from './IntentionsView'
import { useInitStore } from '../hooks/useInitStore'
import { useTrayStatus } from '../hooks/useTrayStatus'
import { registerGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import { useIdleDetection } from '../hooks/useIdleDetection'
import { computeStats } from '../domain/stats'
import { toDateString, getWeekDates, computeWeekMs, computeStreak } from '../domain/timer'
import { getLastSessionDate, suggestWeeklyGoal } from '../domain/history'
import { shouldTriggerBreak, FOCUS_PRESETS } from '../domain/focusGuard'
import { createIntention, createEveningReview } from '../domain/intentions'
import { formatElapsed } from '../domain/format'
import type { Intention, EveningReview } from '../domain/intentions'
import type { Storage } from '../persistence/storage'

type Props = { storage: Storage }

export function App({ storage }: Props) {
  const { categories, sessions, historySessions, addCategory, startTimer, stopTimer, deleteCategory, renameCategory, setWeeklyGoal, setCategoryColor, setPendingTag } = useTimerState()
  const [input, setInput] = useState('')
  const [view, setView] = useState<'tracker' | 'stats' | 'history' | 'today'>('tracker')
  const [breakActive, setBreakActive] = useState(false)
  const focusPreset = FOCUS_PRESETS[0] // Pomodoro default
  const [intentions, setIntentions] = useState<Intention[]>([])
  const [eveningReview, setEveningReview] = useState<EveningReview | null>(null)

  useInitStore(storage)

  const today = useMemo(() => toDateString(Date.now()), [])

  // Load intentions & evening review for today
  useEffect(() => {
    Promise.all([
      storage.loadIntentionsByDate(today),
      storage.loadEveningReviewByDate(today),
    ]).then(([ints, rev]) => {
      setIntentions(ints)
      setEveningReview(rev)
    })
  }, [today])
  const weekDates = useMemo(() => getWeekDates(today), [today])
  const streaks = useMemo(() => Object.fromEntries(
    categories.map(c => [
      c.id,
      computeStreak(historySessions.filter(s => s.categoryId === c.id).map(s => s.date), today),
    ])
  ), [categories, historySessions, today])

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
    startTimer(id)
    if (prev && prev.id !== id) {
      const { sessions: s } = useTimerStore.getState()
      await storage.saveSession(s[s.length - 1])
    }
  }

  async function handleRename(id: string, newName: string) {
    renameCategory(id, newName)
    await storage.renameCategory(id, newName)
  }

  async function handleDelete(id: string) {
    deleteCategory(id)
    await storage.deleteCategory(id)
  }

  async function handleStop(id: string, tag?: string) {
    stopTimer(id, tag)
    const { sessions: s } = useTimerStore.getState()
    await storage.saveSession(s[s.length - 1])
  }

  async function handleSetGoal(id: string, ms: number) {
    setWeeklyGoal(id, ms)
    await storage.setWeeklyGoal(id, ms)
  }

  async function handleSetColor(id: string, color: string) {
    setCategoryColor(id, color)
    await storage.setColor(id, color)
  }

  function handleSetTag(id: string, tag: string) {
    setPendingTag(id, tag)
  }

  async function handleAddIntention(text: string) {
    const intention = createIntention(text, today)
    await storage.saveIntention(intention)
    setIntentions(prev => [...prev, intention])
  }

  async function handleSaveReview(mood: 1 | 2 | 3 | 4 | 5, notes: string) {
    const review = createEveningReview(today, mood, notes)
    await storage.saveEveningReview(review)
    setEveningReview(review)
  }

  // Compute active category (used by multiple hooks)
  const activeCategory = categories.find(c => c.activeEntry !== null)
  const activeStartedAt = activeCategory?.activeEntry?.startedAt ?? null

  // M26: Update system tray with current timer status
  const elapsedStr = activeStartedAt ? formatElapsed(Date.now() - activeStartedAt) : 'No active timer'
  useTrayStatus(activeCategory?.name ?? null, elapsedStr)

  // M28: Global shortcut — Ctrl+Shift+T toggles the active timer
  useEffect(() => {
    const toggle = () => {
      const state = useTimerStore.getState()
      const active = state.categories.find(c => c.activeEntry !== null)
      if (active) handleStop(active.id)
      else if (state.categories.length > 0) handleStart(state.categories[0].id)
    }
    let cleanup: (() => void) | undefined
    registerGlobalShortcuts({}, toggle).then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  // M30: Auto-pause timer after 3 min of inactivity
  const handleIdle = useCallback(() => {
    const state = useTimerStore.getState()
    const active = state.categories.find(c => c.activeEntry !== null)
    if (active) handleStop(active.id)
  }, [])

  useIdleDetection(3, handleIdle, useCallback(() => {}, []))

  // Compute whether focus guard should trigger
  const shouldShowBreak = !breakActive && activeStartedAt !== null
    && shouldTriggerBreak(activeStartedAt, Date.now(), focusPreset.workMs)

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {shouldShowBreak && (
        <FocusGuard
          activeCategory={activeCategory?.name ?? null}
          startedAt={activeStartedAt}
          preset={focusPreset}
          onBreakComplete={() => setBreakActive(true)}
        />
      )}

      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-xl px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-100">Time Tracker</span>
          <nav className="flex">
            {(['tracker', 'stats', 'history', 'today'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative px-4 h-14 text-sm transition-colors ${
                  view === v ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'tracker' ? 'Timer' : v === 'stats' ? 'Stats' : v === 'history' ? 'History' : 'Today'}
                {view === v && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-8">

        {view === 'tracker' ? (
          <>
            {/* Add category */}
            <div className="mb-6 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-all"
                placeholder="Category name"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button
                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
                onClick={handleAdd}
              >
                Add
              </button>
            </div>

            {/* Category list */}
            <ul className="space-y-2">
              {categories.map(category => (
                <CategoryItem
                  key={category.id}
                  category={category}
                  weeklyMs={computeWeekMs(sessions, category.id, weekDates)}
                  lastTracked={getLastSessionDate(historySessions, category.id)}
                  suggestedMs={suggestWeeklyGoal(historySessions, category.id)}
                  onStart={() => handleStart(category.id)}
                  onStop={(tag) => handleStop(category.id, tag)}
                  onDelete={() => handleDelete(category.id)}
                  onRename={newName => handleRename(category.id, newName)}
                  onSetGoal={ms => handleSetGoal(category.id, ms)}
                  onSetColor={color => handleSetColor(category.id, color)}
                  onSetTag={tag => handleSetTag(category.id, tag)}
                  activeTag={category.pendingTag}
                />
              ))}
            </ul>

            {categories.length === 0 && (
              <p className="mt-16 text-center text-sm text-zinc-700">
                Add a category to start tracking time.
              </p>
            )}
          </>
        ) : view === 'stats' ? (
          <StatsView
            stats={computeStats(categories)}
            weeklyData={categories.map(c => ({
              id: c.id,
              weeklyMs: computeWeekMs(sessions, c.id, weekDates),
              weeklyGoalMs: c.weeklyGoalMs,
            }))}
            streaks={streaks}
            historySessions={historySessions}
            categories={categories}
            onBack={() => setView('tracker')}
          />
        ) : view === 'history' ? (
          <HistoryView
            sessions={historySessions}
            categories={categories}
          />
        ) : (
          <IntentionsView
            intentions={intentions}
            review={eveningReview}
            onAddIntention={handleAddIntention}
            onSaveReview={handleSaveReview}
          />
        )}

      </main>
    </div>
  )
}
