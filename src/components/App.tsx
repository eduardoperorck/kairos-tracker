import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTimerState } from '../store/useTimerStoreHook'
import { useTimerStore } from '../store/useTimerStore'
import { CategoryItem } from './CategoryItem'
import { StatsView } from './StatsView'
import { HistoryView } from './HistoryView'
import { FocusGuard } from './FocusGuard'
import { FocusLock } from './FocusLock'
import { IntentionsView } from './IntentionsView'
import { SettingsView } from './SettingsView'
import { useInitStore } from '../hooks/useInitStore'
import { useTrayStatus } from '../hooks/useTrayStatus'
import { registerGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import { useIdleDetection } from '../hooks/useIdleDetection'
import { useWebhooks } from '../hooks/useWebhooks'
import { useNotifications } from '../hooks/useNotifications'
import { computeStats } from '../domain/stats'
import { toDateString, getWeekDates, computeWeekMs, computeStreak } from '../domain/timer'
import { getLastSessionDate, suggestWeeklyGoal } from '../domain/history'
import { shouldTriggerBreak, FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { createIntention, createEveningReview } from '../domain/intentions'
import { formatElapsed } from '../domain/format'
import type { Intention, EveningReview } from '../domain/intentions'
import type { Storage } from '../persistence/storage'

const POSTPONE_MS = 5 * 60_000 // 5 minutes

type Props = { storage: Storage }

export function App({ storage }: Props) {
  const { categories, sessions, historySessions, addCategory, startTimer, stopTimer, deleteCategory, renameCategory, setWeeklyGoal, setCategoryColor, setPendingTag } = useTimerState()

  // ── UI state ────────────────────────────────────────────────────────────────
  const [input, setInput] = useState('')
  const [view, setView] = useState<'tracker' | 'stats' | 'history' | 'today' | 'settings'>('tracker')
  const [focusLockActive, setFocusLockActive] = useState(false)
  const [intentions, setIntentions] = useState<Intention[]>([])
  const [eveningReview, setEveningReview] = useState<EveningReview | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)

  // ── FocusGuard state ────────────────────────────────────────────────────────
  const [focusPreset, setFocusPreset] = useState<FocusPreset>(FOCUS_PRESETS[0])
  const [focusStrictMode, setFocusStrictMode] = useState(false)
  const [breakActive, setBreakActive] = useState(false)
  const [postponedUntil, setPostponedUntil] = useState<number | null>(null)
  const [postponeUsed, setPostponeUsed] = useState(false)

  // ── Hooks ───────────────────────────────────────────────────────────────────
  useInitStore(storage)
  const webhooks = useWebhooks(webhookUrl)
  const notifications = useNotifications()

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      storage.getSetting('webhook_url'),
      storage.getSetting('focus_preset'),
      storage.getSetting('focus_strict_mode'),
    ]).then(([url, preset, strict]) => {
      setWebhookUrl(url)
      if (preset) {
        const found = FOCUS_PRESETS.find(p => p.name === preset)
        if (found) setFocusPreset(found)
      }
      if (strict === 'true') setFocusStrictMode(true)
    })
  }, [])

  const today = useMemo(() => toDateString(Date.now()), [])

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

  // ── Active category ─────────────────────────────────────────────────────────
  const activeCategory = categories.find(c => c.activeEntry !== null)
  const activeStartedAt = activeCategory?.activeEntry?.startedAt ?? null

  // ── Reset break state when active category changes ──────────────────────────
  useEffect(() => {
    setBreakActive(false)
    setPostponedUntil(null)
    setPostponeUsed(false)
  }, [activeCategory?.id])

  // ── Long-session notification (every 2h without a break) ────────────────────
  useEffect(() => {
    if (!activeStartedAt || !activeCategory) return
    const id = setInterval(() => {
      const elapsedH = (Date.now() - activeStartedAt) / 3_600_000
      if (elapsedH >= 2) notifications.notifyLongSession(activeCategory.name, Math.round(elapsedH))
    }, 30 * 60_000) // check every 30 min
    return () => clearInterval(id)
  }, [activeStartedAt, activeCategory?.name])

  // ── Daily reminder if no sessions tracked by 20h ────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const hour = new Date().getHours()
      if (hour === 20 && categories.every(c => c.accumulatedMs === 0)) {
        notifications.notifyDailyReminder(20)
      }
    }, 60_000) // check every minute
    return () => clearInterval(id)
  }, [categories])

  // ── Tray + global shortcut + idle detection ─────────────────────────────────
  const elapsedStr = activeStartedAt ? formatElapsed(Date.now() - activeStartedAt) : 'No active timer'
  useTrayStatus(activeCategory?.name ?? null, elapsedStr)

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

  const handleIdle = useCallback(() => {
    const state = useTimerStore.getState()
    const active = state.categories.find(c => c.activeEntry !== null)
    if (active) handleStop(active.id)
  }, [])

  useIdleDetection(3, handleIdle, useCallback(() => {}, []))

  // ── FocusGuard trigger ──────────────────────────────────────────────────────
  const now = Date.now()
  const postponeBlocked = postponedUntil !== null && now < postponedUntil
  const shouldShowBreak = !breakActive
    && !postponeBlocked
    && activeStartedAt !== null
    && shouldTriggerBreak(activeStartedAt, now, focusPreset.workMs)

  // ── Handlers ────────────────────────────────────────────────────────────────
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
    const cat = categories.find(c => c.id === id)
    if (cat) webhooks.onTimerStarted(cat.name, Date.now())
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
    const cat = categories.find(c => c.id === id)
    const entry = cat?.activeEntry
    const weeklyBefore = computeWeekMs(sessions, id, weekDates)
    stopTimer(id, tag)
    const { sessions: s } = useTimerStore.getState()
    const saved = s[s.length - 1]
    await storage.saveSession(saved)

    if (cat && entry) {
      webhooks.onTimerStopped(cat.name, entry.startedAt, saved.endedAt, tag)

      // Notify if goal just reached
      const goalMs = cat.weeklyGoalMs ?? 0
      if (goalMs > 0) {
        const weeklyAfter = weeklyBefore + (saved.endedAt - entry.startedAt)
        if (weeklyBefore < goalMs && weeklyAfter >= goalMs) {
          notifications.notifyGoalReached(cat.name, Math.round(goalMs / 3_600_000))
          webhooks.onGoalReached(cat.name, goalMs, weeklyAfter)
        }
      }

      // Streak milestone webhook
      const streak = streaks[id] ?? 0
      webhooks.onStreakMilestone(cat.name, streak)
    }
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
    // Daily review webhook
    const totalMs = categories.reduce((sum, c) => sum + c.accumulatedMs, 0)
    const topCat = categories.slice().sort((a, b) => b.accumulatedMs - a.accumulatedMs)[0]
    webhooks.onDailyReview(mood, totalMs, topCat?.name ?? '')
  }

  function handlePostpone() {
    setPostponedUntil(Date.now() + POSTPONE_MS)
    setPostponeUsed(true)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {focusLockActive && activeCategory && activeStartedAt && (
        <FocusLock
          categoryName={activeCategory.name}
          startedAt={activeStartedAt}
          onExit={() => setFocusLockActive(false)}
        />
      )}

      {shouldShowBreak && (
        <FocusGuard
          activeCategory={activeCategory?.name ?? null}
          startedAt={activeStartedAt}
          preset={focusPreset}
          allowPostpone={!postponeUsed}
          strictMode={focusStrictMode}
          onBreakComplete={() => setBreakActive(true)}
          onPostpone={handlePostpone}
          onBreakSkipped={() => activeCategory && activeStartedAt
            ? webhooks.onBreakSkipped(activeCategory.name, Date.now() - activeStartedAt)
            : undefined}
        />
      )}

      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-xl px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-100">Time Tracker</span>
          <nav className="flex">
            {(['tracker', 'stats', 'history', 'today', 'settings'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative px-4 h-14 text-sm transition-colors ${
                  view === v ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'tracker' ? 'Timer' : v === 'stats' ? 'Stats' : v === 'history' ? 'History' : v === 'today' ? 'Today' : '⚙'}
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

            {activeCategory && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setFocusLockActive(true)}
                  className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
                >
                  Enter Focus Lock
                </button>
              </div>
            )}

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
            storage={storage}
            onBack={() => setView('tracker')}
          />
        ) : view === 'history' ? (
          <HistoryView
            sessions={historySessions}
            categories={categories}
            onImportSessions={async (imported) => {
              await storage.importSessions(imported)
              const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 60 * 86_400_000))
              useTimerStore.setState({ historySessions: allSessions })
            }}
          />
        ) : view === 'today' ? (
          <IntentionsView
            intentions={intentions}
            review={eveningReview}
            onAddIntention={handleAddIntention}
            onSaveReview={handleSaveReview}
          />
        ) : (
          <SettingsView
            categories={categories}
            sessions={historySessions}
            storage={storage}
            webhookUrl={webhookUrl ?? ''}
            onWebhookUrlChange={url => setWebhookUrl(url || null)}
            focusPreset={focusPreset}
            onFocusPresetChange={setFocusPreset}
            focusStrictMode={focusStrictMode}
            onFocusStrictModeChange={setFocusStrictMode}
          />
        )}

      </main>
    </div>
  )
}
