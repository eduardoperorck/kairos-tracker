import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '../i18n'
import { useTimerState } from '../store/useTimerStoreHook'
import { useTimerStore } from '../store/useTimerStore'
import { TrackerView } from './TrackerView'
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
import { useNotifications } from '../hooks/useNotifications'
import { computeStats } from '../domain/stats'
import { exportDayAsMarkdown } from '../domain/history'
import { toDateString, getWeekDates, computeWeekMs, computeStreak } from '../domain/timer'
import { computeEnergyPattern, isFlowSession } from '../domain/history'
import { ActiveTimerBar } from './ActiveTimerBar'
import { Toast } from './Toast'
import { UndoToast } from './UndoToast'
import { PassiveTrackingIndicator } from './PassiveTrackingIndicator'
import { SessionFixWidget } from './SessionFixWidget'
import { splitSession, editSessionTime } from '../domain/sessionFix'
import { useToast } from '../hooks/useToast'
import { CommandPalette } from './CommandPalette'
import { OnboardingWizard } from './OnboardingWizard'
import { ProductivityWrapped } from './ProductivityWrapped'
import type { CategoryInsights } from './CategoryItem'
import { FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { formatElapsed } from '../domain/format'
import { useInputActivity } from '../hooks/useInputActivity'
import { usePassiveCapture } from '../hooks/usePassiveCapture'
import { useSessionManagement } from '../hooks/useSessionManagement'
import { useFocusGuardState } from '../hooks/useFocusGuardState'
import { useDailyState } from '../hooks/useDailyState'
import { useSettingsLoader } from '../hooks/useSettingsLoader'
import { useAutoBackup } from '../hooks/useAutoBackup'
import { useLocalGitCommits } from '../hooks/useLocalGitCommits'
import { useWindowBounds } from '../hooks/useWindowBounds'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import { useObsidianExport } from '../hooks/useObsidianExport'
import type { Intention, EveningReview } from '../domain/intentions'
import type { Storage, DailyCaptureStatRow } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import type { MVDItem } from '../domain/minimumViableDay'
import { filterToday } from '../domain/minimumViableDay'
import type { UnclassifiedApp } from '../domain/passiveCapture'
import { ClassifyOverlay } from './ClassifyOverlay'
import { AppHeader } from './AppHeader'
import { useUndoStack } from '../hooks/useUndoStack'
import type { Category } from '../domain/timer'


type Props = { storage: Storage }

export function App({ storage }: Props) {
  const { t } = useI18n()
  const { toast, showToast } = useToast()
  const { categories, sessions, historySessions, addCategory, renameCategory, setWeeklyGoal, setCategoryColor, setPendingTag, archiveCategory } = useTimerState()

  // ── UI state ────────────────────────────────────────────────────────────────
  const [view, setView] = useState<'tracker' | 'stats' | 'history' | 'today' | 'settings'>('tracker')
  const [focusLockActive, setFocusLockActive] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('onboarding_complete') === 'true'
  )
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const openNLPRef = useRef<(() => void) | null>(null)
  const [mvdItems, setMvdItems] = useState<MVDItem[]>(() => {
    try {
      const all: MVDItem[] = JSON.parse(localStorage.getItem('mvd_items') ?? '[]')
      return filterToday(all, toDateString(Date.now()))
    } catch { return [] }
  })
  // Shortcut tooltip — shown once after onboarding completes
  const [showShortcutTip, setShowShortcutTip] = useState(() =>
    localStorage.getItem('shortcut_tip_shown') !== 'true'
  )

  // N1: track last category switch
  const [lastSwitch, setLastSwitch] = useState<{ at: number; fromName: string } | null>(null)
  // N5: idle tracking
  const [idleMs, setIdleMs] = useState(0)
  const lastActivityRef = useRef(Date.now())

  // ── Hooks ───────────────────────────────────────────────────────────────────
  useInitStore(storage)
  const notifications = useNotifications()
  const { push: pushUndo, undo, canUndo, lastOperation: undoOperation } = useUndoStack()
  const inputActivity = useInputActivity()
  const [pendingFixSession, setPendingFixSession] = useState<import('../domain/timer').Session | null>(null)
  const SESSION_FIX_THRESHOLD_MS = 45 * 60_000
  const [meetingMode, setMeetingMode] = useState<{ active: boolean; startedAt: number | null; previousCategoryId: string | null; previousCategoryName: string | null }>({ active: false, startedAt: null, previousCategoryId: null, previousCategoryName: null })
  const [meetingResume, setMeetingResume] = useState<{ categoryId: string; categoryName: string; durationMs: number } | null>(null)

  // Settings loaded early so workspaceRoot is available before useLocalGitCommits
  const setFocusPresetRef = useRef<((p: any) => void) | undefined>(undefined)
  const setFocusStrictModeRef = useRef<((s: boolean) => void) | undefined>(undefined)
  const { claudeApiKey, setClaudeApiKey, githubUsername, setGithubUsername, workspaceRoot, setWorkspaceRoot, screenshotsEnabled, setScreenshotsEnabled } = useSettingsLoader({
    storage,
    setFocusPreset: (p) => setFocusPresetRef.current?.(p),
    setFocusStrictMode: (s) => setFocusStrictModeRef.current?.(s),
  })

  // P1: passive window capture (M89: pass inputActivity for idle detection)
  const activeCatId = categories.find(c => c.activeEntry !== null)?.id ?? null
  const { blocks: captureBlocks, unclassifiedProcess, unclassifiedWorkspace, suggestedCategoryId, recentTitles, elevationSuggestion, idlePauseMs, classificationReason, currentWindow, assignProcess, dismissProcess, elevateProcess, dismissElevation, assignWorkspace, dismissWorkspace, resetAutoStart, dismissIdlePause } = usePassiveCapture(activeCatId, inputActivity, undefined, storage, historySessions)
  useAutoBackup(storage, historySessions, categories)
  const localGitCommits = useLocalGitCommits(recentTitles, workspaceRoot)
  useWindowBounds()
  const availableUpdate = useUpdateCheck()

  // ── Flush passive capture stats to storage ──────────────────────────────────
  const captureBlocksRef = useRef(captureBlocks)
  captureBlocksRef.current = captureBlocks

  const lastFlushedBlocksRef = useRef<Set<string>>(new Set())

  const flushCaptureStats = useCallback(async (blocks: typeof captureBlocks) => {
    const newBlocks = blocks.filter(b => {
      const key = `${b.startedAt}-${b.process}`
      return !lastFlushedBlocksRef.current.has(key)
    })
    if (newBlocks.length === 0) return
    const byKey = new Map<string, DailyCaptureStatRow>()
    for (const block of newBlocks) {
      if (block.endedAt <= block.startedAt) continue
      const date = toDateString(block.startedAt)
      const key = `${date}|${block.process}`
      const existing = byKey.get(key) ?? { date, process: block.process, total_ms: 0, block_count: 0, category_id: block.categoryId }
      byKey.set(key, {
        ...existing,
        total_ms: existing.total_ms + (block.endedAt - block.startedAt),
        block_count: existing.block_count + 1,
      })
    }
    for (const row of byKey.values()) {
      await storage.saveDailyCaptureStat(row).catch(() => {})
    }
    // Mark these blocks as flushed so subsequent calls don't double-count
    for (const b of newBlocks) {
      lastFlushedBlocksRef.current.add(`${b.startedAt}-${b.process}`)
    }
  }, [storage])

  // Flush on beforeunload (best-effort)
  useEffect(() => {
    function onUnload() {
      void flushCaptureStats(captureBlocksRef.current)
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [flushCaptureStats])

  const today = useMemo(() => toDateString(Date.now()), [])

  const {
    intentions, setIntentions,
    eveningReview, setEveningReview,
    dailyRecap, setDailyRecap,
    handleAddIntention,
    handleSaveReview,
  } = useDailyState({ storage, today, historySessions, t })

  useObsidianExport(storage, today, sessions, categories, intentions, eveningReview)

  const weekDates = useMemo(() => getWeekDates(today), [today])

  const { input, setInput, handleAdd, handleStart, handleStop } = useSessionManagement({
    storage,
    recentTitles,
    captureBlocksRef,
    flushCaptureStats,
    notifications,
    setLastSwitch,
    weekDates,
  })
  const streaks = useMemo(() => Object.fromEntries(
    categories.map(c => [
      c.id,
      computeStreak(historySessions.filter(s => s.categoryId === c.id).map(s => s.date), today),
    ])
  ), [categories, historySessions, today])

  const categoryInsights = useMemo((): Record<string, CategoryInsights> =>
    Object.fromEntries(categories.map(c => {
      const catSessions = historySessions.filter(s => s.categoryId === c.id)
      const { peakHours } = computeEnergyPattern(catSessions, 30)
      const flowCount = sessions.filter(s => s.categoryId === c.id && isFlowSession(s)).length
      return [c.id, { streak: streaks[c.id] ?? 0, flowCount, peakHour: peakHours[0] ?? null }]
    })),
  [categories, historySessions, sessions, streaks])

  // ── Active category ─────────────────────────────────────────────────────────
  const activeCategory = categories.find(c => c.activeEntry !== null)
  const activeStartedAt = activeCategory?.activeEntry?.startedAt ?? null

  const {
    focusPreset, setFocusPreset,
    focusStrictMode, setFocusStrictMode,
    breakActive, setBreakActive,
    postponeUsed,
    breakSkipCount, setBreakSkipCount,
    breakCompletedCount, setBreakCompletedCount,
    shouldShowBreak,
    handlePostpone,
  } = useFocusGuardState({ activeStartedAt, activeCategoryId: activeCategory?.id ?? null })

  // Bind focus setters to refs so they are available when settings load async
  setFocusPresetRef.current = setFocusPreset
  setFocusStrictModeRef.current = setFocusStrictMode

  // ── Long-session notification — first at 90 min, then every 30 min ──────────
  const lastLongSessionNotifRef = useRef<number>(0)
  useEffect(() => {
    lastLongSessionNotifRef.current = 0 // reset when session starts
    if (!activeStartedAt || !activeCategory) return
    const id = setInterval(() => {
      const elapsedMin = (Date.now() - activeStartedAt) / 60_000
      // Fire at 90 min, then every 30 min thereafter
      if (elapsedMin >= 90) {
        const threshold = Math.floor((elapsedMin - 90) / 30) * 30 + 90
        if (threshold > lastLongSessionNotifRef.current) {
          lastLongSessionNotifRef.current = threshold
          notifications.notifyLongSession(activeCategory.name, Math.round(elapsedMin / 60 * 10) / 10)
        }
      }
    }, 5 * 60_000) // check every 5 min
    return () => clearInterval(id)
  }, [activeStartedAt, activeCategory?.id])

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

  // ── Idle tracking (N5 Dead Time) ────────────────────────────────────────────
  useEffect(() => {
    const onActivity = () => { lastActivityRef.current = Date.now(); setIdleMs(0) }
    window.addEventListener('keydown', onActivity, true)
    window.addEventListener('mousemove', onActivity, true)
    const id = setInterval(() => setIdleMs(Date.now() - lastActivityRef.current), 5_000)
    return () => {
      window.removeEventListener('keydown', onActivity, true)
      window.removeEventListener('mousemove', onActivity, true)
      clearInterval(id)
    }
  }, [])

  // ── Persist MVD items ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('mvd_items', JSON.stringify(mvdItems))
  }, [mvdItems])

  // ── Command palette keyboard shortcut ───────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setPaletteOpen(p => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    if (active) {
      handleStop(active.id)
      resetAutoStart()
    }
  }, [resetAutoStart])

  useIdleDetection(10, handleIdle, useCallback(() => {}, []))

  // P1: auto-start timer when a classified app gains focus
  useEffect(() => {
    if (!suggestedCategoryId) return
    const state = useTimerStore.getState()
    const active = state.categories.find(c => c.activeEntry !== null)
    if (active?.id !== suggestedCategoryId) {
      handleStart(suggestedCategoryId)
      const catName = state.categories.find(c => c.id === suggestedCategoryId)?.name
      if (catName) setDailyRecap(`▶ ${catName} — auto-started`)
      setTimeout(() => setDailyRecap(null), 4_000)
    }
  }, [suggestedCategoryId])

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleOnboardingComplete({ categories: names, preset: presetName }: { categories: string[]; preset: string }) {
    for (const name of names) {
      addCategory(name)
      const { categories: next } = useTimerStore.getState()
      const created = next[next.length - 1]
      await storage.saveCategory(created.id, created.name)
    }
    const found = FOCUS_PRESETS.find(p => p.name === presetName)
    if (found) { setFocusPreset(found); await storage.setSetting(SettingKey.FocusPreset, presetName) }
    localStorage.setItem('onboarding_complete', 'true')
    setOnboardingDone(true)
  }


  async function handleRename(id: string, newName: string) {
    renameCategory(id, newName)
    await storage.renameCategory(id, newName)
  }


  async function handleArchive(id: string, archived: boolean) {
    archiveCategory(id, archived)
    await storage.archiveCategory(id, archived)
    showToast(archived ? t('toast.archived') : t('toast.unarchived'))
    if (archived) {
      pushUndo({
        label: t('undo.archived'),
        undo: async () => {
          archiveCategory(id, false)
          await storage.archiveCategory(id, false)
        },
      })
    }
  }


  async function handleSetGoal(id: string, ms: number) {
    setWeeklyGoal(id, ms)
    await storage.setWeeklyGoal(id, ms)
    showToast(t('toast.goalSaved'))
  }

  async function handleSetColor(id: string, color: string) {
    setCategoryColor(id, color)
    await storage.setColor(id, color)
  }

  function handleSetTag(id: string, tag: string) {
    setPendingTag(id, tag)
  }

  async function handleStopWithFix(id: string, tag?: string) {
    const session = await handleStop(id, tag)
    if (session && (session.endedAt - session.startedAt) >= SESSION_FIX_THRESHOLD_MS) {
      setPendingFixSession(session)
    }
  }

  async function handleSessionEditTime(startedAt: number, endedAt: number) {
    if (!pendingFixSession) return
    const updated = editSessionTime(pendingFixSession, startedAt, endedAt)
    await storage.updateSessionTime(updated.id, updated.startedAt, updated.endedAt)
    const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 90 * 86_400_000))
    useTimerStore.setState({ historySessions: allSessions })
    setPendingFixSession(null)
    showToast(t('toast.sessionLogged'))
  }

  async function handleSessionSplit(splitDurationMs: number, newCategoryId: string) {
    if (!pendingFixSession) return
    const [first, second] = splitSession(pendingFixSession, splitDurationMs, newCategoryId)
    await storage.updateSessionTime(first.id, first.startedAt, first.endedAt)
    await storage.saveSession(second)
    const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 90 * 86_400_000))
    useTimerStore.setState({ historySessions: allSessions })
    setPendingFixSession(null)
    showToast(t('toast.sessionLogged'))
  }

  async function startMeeting() {
    const prev = categories.find(c => c.activeEntry !== null)
    if (prev) {
      await handleStop(prev.id)
    }
    let meetingCat = categories.find(c => c.name.toLowerCase() === 'meeting' && !c.archived)
    if (!meetingCat) {
      addCategory('Meeting')
      const { categories: next } = useTimerStore.getState()
      meetingCat = next[next.length - 1]
      await storage.saveCategory(meetingCat.id, meetingCat.name)
    }
    await handleStart(meetingCat.id)
    setMeetingMode({ active: true, startedAt: Date.now(), previousCategoryId: prev?.id ?? null, previousCategoryName: prev?.name ?? null })
  }

  async function endMeeting() {
    const meetingCat = categories.find(c => c.name.toLowerCase() === 'meeting' && c.activeEntry !== null)
    if (meetingCat) {
      await handleStop(meetingCat.id, 'meeting')
    }
    const { previousCategoryId, previousCategoryName, startedAt } = meetingMode
    const durationMs = startedAt ? Date.now() - startedAt : 0
    setMeetingMode({ active: false, startedAt: null, previousCategoryId: null, previousCategoryName: null })
    if (previousCategoryId && previousCategoryName) {
      setMeetingResume({ categoryId: previousCategoryId, categoryName: previousCategoryName, durationMs })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {!onboardingDone && categories.length === 0 && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

      {wrappedOpen && (
        <ProductivityWrapped sessions={historySessions} categories={categories} onClose={() => setWrappedOpen(false)} />
      )}

      {paletteOpen && (
        <CommandPalette
          categories={categories.filter(c => !c.archived)}
          activeId={activeCategory?.id ?? null}
          onStart={id => { handleStart(id); setPaletteOpen(false) }}
          onStop={() => { activeCategory && handleStop(activeCategory.id); setPaletteOpen(false) }}
          onNavigate={v => { setView(v); setPaletteOpen(false) }}
          onClose={() => setPaletteOpen(false)}
          onOpenNLP={() => {
            setView('tracker')
            setPaletteOpen(false)
            openNLPRef.current?.()
          }}
          onCyclePreset={() => {
            const idx = FOCUS_PRESETS.findIndex(p => p.name === focusPreset.name)
            const next = FOCUS_PRESETS[(idx + 1) % FOCUS_PRESETS.length]
            setFocusPreset(next)
            void storage.setSetting(SettingKey.FocusPreset, next.name)
            setPaletteOpen(false)
          }}
        />
      )}

      {focusLockActive && activeCategory && activeStartedAt && (
        <FocusLock
          categoryName={activeCategory.name}
          startedAt={activeStartedAt}
          cycleMs={focusPreset.workMs}
          onExit={() => setFocusLockActive(false)}
        />
      )}

      {shouldShowBreak && !meetingMode.active && (
        <FocusGuard
          activeCategory={activeCategory?.name ?? null}
          startedAt={activeStartedAt}
          preset={focusPreset}
          allowPostpone={!postponeUsed}
          strictMode={focusStrictMode}
          onBreakComplete={() => { setBreakActive(true); setBreakCompletedCount(c => c + 1) }}
          onPostpone={handlePostpone}
          onBreakSkipped={() => {
            setBreakSkipCount(c => c + 1)
          }}
        />
      )}

      {/* Task 8: idle pause banner — shown when 5+ min of inactivity detected */}
      {idlePauseMs !== null && activeCategory && (
        <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-zinc-900/95 px-4 py-2.5 shadow-xl text-xs text-zinc-300 backdrop-blur">
          <span>{t('idle.youWereAway').replace('{min}', String(Math.round(idlePauseMs / 60_000)))}</span>
          <button
            onClick={() => dismissIdlePause()}
            className="rounded border border-zinc-700 px-2.5 py-1 text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            {t('idle.keepTime')}
          </button>
          <button
            onClick={() => {
              handleStop(activeCategory.id)
              dismissIdlePause()
            }}
            className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-400 hover:text-amber-200 transition-colors"
          >
            {t('idle.discardTime')}
          </button>
        </div>
      )}

      {/* M-UX6: Meeting resume banner */}
      {meetingResume && (
        <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-sky-500/20 bg-zinc-900/95 px-4 py-2.5 shadow-xl text-xs text-zinc-300 backdrop-blur">
          <span>
            {t('meeting.resumePrompt')
              .replace('{min}', String(Math.round(meetingResume.durationMs / 60_000)))
              .replace('{name}', meetingResume.categoryName)}
          </span>
          <button
            onClick={() => { handleStart(meetingResume.categoryId); setMeetingResume(null) }}
            className="rounded border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-400 hover:text-sky-200 transition-colors"
          >
            {t('meeting.resume')}
          </button>
          <button
            onClick={() => setMeetingResume(null)}
            className="rounded border border-zinc-700 px-2.5 py-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {t('meeting.skip')}
          </button>
        </div>
      )}

      {pendingFixSession && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-full max-w-sm px-4">
          <SessionFixWidget
            session={pendingFixSession}
            categories={categories}
            onConfirm={() => setPendingFixSession(null)}
            onEditTime={handleSessionEditTime}
            onSplit={handleSessionSplit}
            onDismiss={() => setPendingFixSession(null)}
          />
        </div>
      )}

      <AppHeader view={view} setView={setView} dailyRecap={dailyRecap} activeCategory={activeCategory} />

      {activeCategory && activeStartedAt && (
        <ActiveTimerBar
          categoryName={activeCategory.name}
          color={activeCategory.color}
          startedAt={activeStartedAt}
          onStop={() => handleStopWithFix(activeCategory.id)}
          onMeeting={meetingMode.active ? endMeeting : startMeeting}
          isMeeting={meetingMode.active}
          presetName={focusPreset.name}
          classificationReason={classificationReason}
          todaySessions={historySessions.filter(s => s.date === toDateString(Date.now()))}
          categories={categories}
        />
      )}

      <PassiveTrackingIndicator
        currentWindow={currentWindow}
        idleMs={idleMs}
        isTimerActive={!!activeCategory}
      />

      <main className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 py-8">

        {availableUpdate && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs text-emerald-300">
            <span>New version {availableUpdate} available — check GitHub releases for download.</span>
          </div>
        )}

        {/* Shortcut tip banner */}
        {(() => {
          if (!(showShortcutTip && onboardingDone && categories.length > 0 && view === 'tracker')) return null
          return (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-2 text-xs text-zinc-500">
              <span>Tip: press <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-zinc-400">1</kbd>–<kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-zinc-400">9</kbd> to start a timer · <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-zinc-400">⌘K</kbd> for everything else</span>
              <button
                onClick={() => { localStorage.setItem('shortcut_tip_shown', 'true'); setShowShortcutTip(false) }}
                className="ml-4 text-zinc-700 hover:text-zinc-400 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>
          )
        })()}

        {view === 'tracker' ? (
          <TrackerView
            timer={{
              input,
              setInput,
              categories,
              sessions,
              historySessions,
              weekDates,
              categoryInsights,
              activeCategory,
              claudeApiKey,
              breakSkipCount,
              breakCompletedCount,
              onAdd: handleAdd,
              onStart: handleStart,
              onStop: handleStopWithFix,
              onArchive: handleArchive,
              onRename: handleRename,
              onSetGoal: handleSetGoal,
              onSetColor: handleSetColor,
              onSetTag: handleSetTag,
              onNLPConfirm: async (entry) => {
                const hh = String(entry.startHour).padStart(2, '0')
                const mm = String(entry.startMinute ?? 0).padStart(2, '0')
                const startedAt = new Date(entry.date + 'T' + hh + ':' + mm + ':00').getTime()
                const session = {
                  id: `nlp-${Date.now()}`,
                  categoryId: entry.categoryId,
                  date: entry.date,
                  startedAt,
                  endedAt: startedAt + entry.durationMs,
                  tag: entry.tag,
                }
                await storage.saveSession(session)
                const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 90 * 86_400_000))
                useTimerStore.setState({ historySessions: allSessions })
                showToast(t('toast.sessionLogged'))
              },
            }}
            capture={{
              idleMs,
              inputActivity,
              currentWindow,
              unclassifiedProcess,
              onAssignProcess: (process, catId) => {
                assignProcess(process, catId)
                const catName = categories.find(c => c.id === catId)?.name ?? catId
                showToast(t('toast.ruleLearnedProcess').replace('{process}', process).replace('{category}', catName))
              },
              onDismissProcess: dismissProcess,
              unclassifiedWorkspace,
              onAssignWorkspace: (ws, catId) => {
                assignWorkspace(ws, catId)
                const catName = categories.find(c => c.id === catId)?.name ?? catId
                showToast(t('toast.ruleLearnedProcess').replace('{process}', ws).replace('{category}', catName))
              },
              onDismissWorkspace: dismissWorkspace,
              elevationSuggestion,
              onElevateProcess: (process, catId) => {
                elevateProcess(process, catId)
                const catName = categories.find(c => c.id === catId)?.name ?? catId
                showToast(t('toast.ruleLearnedProcess').replace('{process}', process).replace('{category}', catName))
              },
              onDismissElevation: dismissElevation,
            }}
            mvd={{ items: mvdItems, onChange: setMvdItems }}
            storage={storage}
            onFocusLock={() => setFocusLockActive(true)}
            onShortcutUsed={() => { localStorage.setItem('shortcut_tip_shown', 'true'); setShowShortcutTip(false) }}
            onOpenNLP={fn => { openNLPRef.current = fn }}
            switchedAt={lastSwitch?.at ?? null}
            switchedFromCategory={lastSwitch?.fromName ?? ''}
          />
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
            onWrapped={() => setWrappedOpen(true)}
            githubUsername={githubUsername}
            captureBlocks={captureBlocks}
            screenshotsEnabled={screenshotsEnabled}
            gitCommits={localGitCommits}
          />
        ) : view === 'history' ? (
          <HistoryView
            sessions={historySessions}
            categories={categories}
            captureBlocks={captureBlocks}
            onImportSessions={async (imported) => {
              await storage.importSessions(imported)
              const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 60 * 86_400_000))
              useTimerStore.setState({ historySessions: allSessions })
            }}
            onBulkTag={async (ids, tag) => {
              for (const id of ids) await storage.updateSessionTag(id, tag)
              const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 60 * 86_400_000))
              useTimerStore.setState({ historySessions: allSessions })
            }}
            onTagSession={async (id, tag) => {
              await storage.updateSessionTag(id, tag)
              const allSessions = await storage.loadSessionsSince(toDateString(Date.now() - 60 * 86_400_000))
              useTimerStore.setState({ historySessions: allSessions })
            }}
            storage={storage}
          />
        ) : view === 'today' ? (
          <IntentionsView
            intentions={intentions}
            review={eveningReview}
            today={today}
            onAddIntention={handleAddIntention}
            onSaveReview={handleSaveReview}
            mvdItems={mvdItems}
            onMVDChange={setMvdItems}
            draftNotes={(() => {
              if (eveningReview?.notes) return undefined
              const todaySessions = sessions.filter(s => s.date === today)
              if (todaySessions.length === 0) return undefined
              const totalMs = todaySessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
              const totalH = Math.floor(totalMs / 3_600_000)
              const totalM = Math.floor((totalMs % 3_600_000) / 60_000)
              const timeStr = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`
              // Top category
              const byCategory = new Map<string, number>()
              for (const s of todaySessions) byCategory.set(s.categoryId, (byCategory.get(s.categoryId) ?? 0) + (s.endedAt - s.startedAt))
              const topCatId = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
              const topCatName = categories.find(c => c.id === topCatId)?.name ?? ''
              const goalNote = topCatId ? (() => {
                const goalMs = categories.find(c => c.id === topCatId)?.weeklyGoalMs ?? 0
                const weeklyMs = computeWeekMs(sessions, topCatId, weekDates)
                if (goalMs > 0) {
                  const pct = Math.round((weeklyMs / goalMs) * 100)
                  return pct >= 100 ? ' (weekly goal reached!)' : ` (${pct}% of weekly goal)`
                }
                return ''
              })() : ''
              return `Spent ${timeStr} tracked. Top: ${topCatName}${goalNote}.`
            })()}
            onExportMarkdown={(doneSet) => {
              const daySessions = historySessions.filter(s => s.date === today)
              const md = exportDayAsMarkdown(
                today,
                daySessions,
                categories,
                intentions.map((i, idx) => ({ text: i.text, done: doneSet.has(idx) })),
                eveningReview
              )
              navigator.clipboard.writeText(md).catch(() => {
                const a = document.createElement('a')
                a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
                a.download = `${today}.md`
                a.click()
              })
            }}
          />
        ) : (
          <SettingsView
            categories={categories}
            sessions={historySessions}
            storage={storage}
            focusPreset={focusPreset}
            onFocusPresetChange={setFocusPreset}
            focusStrictMode={focusStrictMode}
            onFocusStrictModeChange={setFocusStrictMode}
            onScreenshotsEnabledChange={setScreenshotsEnabled}
            captureBlocks={captureBlocks}
            onToast={showToast}
          />
        )}

      </main>

      {/* Global classify overlay — visible in any view */}
      {unclassifiedProcess && (
        <ClassifyOverlay
          process={unclassifiedProcess}
          categories={categories.filter(c => !c.archived)}
          onAssign={(process, catId) => {
            assignProcess(process, catId)
            const catName = categories.find(c => c.id === catId)?.name ?? catId
            showToast(t('toast.ruleLearnedProcess').replace('{process}', process).replace('{category}', catName))
          }}
          onDismiss={dismissProcess}
        />
      )}

      <Toast message={toast} />
      <UndoToast operation={undoOperation} onUndo={undo} canUndo={canUndo} />
    </div>
  )
}

