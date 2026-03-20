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
import { useWebhooks } from '../hooks/useWebhooks'
import { useNotifications } from '../hooks/useNotifications'
import { computeStats } from '../domain/stats'
import { exportDayAsMarkdown } from '../domain/history'
import { toDateString, getWeekDates, computeWeekMs, computeStreak } from '../domain/timer'
import { computeEnergyPattern, isFlowSession } from '../domain/history'
import { ActiveTimerBar } from './ActiveTimerBar'
import { CommandPalette } from './CommandPalette'
import { OnboardingWizard } from './OnboardingWizard'
import { ProductivityWrapped } from './ProductivityWrapped'
import type { CategoryInsights } from './CategoryItem'
import { shouldTriggerBreak, FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { createIntention, createEveningReview } from '../domain/intentions'
import { formatElapsed } from '../domain/format'
import { useInputActivity } from '../hooks/useInputActivity'
import { usePassiveCapture } from '../hooks/usePassiveCapture'
import { useAutoBackup } from '../hooks/useAutoBackup'
import { useLocalGitCommits } from '../hooks/useLocalGitCommits'
import { useWindowBounds } from '../hooks/useWindowBounds'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import { useObsidianExport } from '../hooks/useObsidianExport'
import { setSlackFocusStatus, clearSlackStatus } from '../services/slack'
import { suggestSessionTag } from '../domain/sessionNaming'
import type { Intention, EveningReview } from '../domain/intentions'
import type { Storage, DailyCaptureStatRow } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import { loadCredential } from '../services/credentials'
import type { MVDItem } from '../domain/minimumViableDay'
import { filterToday } from '../domain/minimumViableDay'
import { DEFAULT_CATEGORY_SUGGESTIONS } from '../domain/passiveCapture'
import type { CategorySlot } from '../domain/passiveCapture'

const POSTPONE_MS = 5 * 60_000 // 5 minutes
const MIN_SESSION_MS = 30_000 // 30 seconds — micro-session gate
const PRIMARY_VIEWS = ['tracker', 'today', 'stats'] as const
const SECONDARY_VIEWS = ['history', 'settings'] as const

type Props = { storage: Storage }

export function App({ storage }: Props) {
  const { t } = useI18n()
  const { categories, sessions, historySessions, addCategory, startTimer, stopTimer, deleteCategory, renameCategory, setWeeklyGoal, setCategoryColor, setPendingTag, archiveCategory } = useTimerState()

  // ── UI state ────────────────────────────────────────────────────────────────
  const [input, setInput] = useState('')
  const [view, setView] = useState<'tracker' | 'stats' | 'history' | 'today' | 'settings'>('tracker')
  const [focusLockActive, setFocusLockActive] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('onboarding_complete') === 'true'
  )
  const [intentions, setIntentions] = useState<Intention[]>([])
  const [eveningReview, setEveningReview] = useState<EveningReview | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [claudeApiKey, setClaudeApiKey] = useState<string | null>(null)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [slackToken, setSlackToken] = useState<string | null>(null)
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false)
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const [navMoreOpen, setNavMoreOpen] = useState(false)
  const navMoreRef = useRef<HTMLDivElement>(null)
  const openNLPRef = useRef<(() => void) | null>(null)
  const [mvdItems, setMvdItems] = useState<MVDItem[]>(() => {
    try {
      const all: MVDItem[] = JSON.parse(localStorage.getItem('mvd_items') ?? '[]')
      return filterToday(all, toDateString(Date.now()))
    } catch { return [] }
  })
  // Daily recap banner — shown once per day on first open
  const [dailyRecap, setDailyRecap] = useState<string | null>(null)
  // Morning intentions prompt — shown on first launch of the day when no intentions set
  const [showMorningPrompt, setShowMorningPrompt] = useState(() => {
    const todayKey = toDateString(Date.now())
    return localStorage.getItem(`morning_prompt_dismissed_${todayKey}`) !== 'true'
  })
  // Shortcut tooltip — shown once after onboarding completes
  const [showShortcutTip, setShowShortcutTip] = useState(() =>
    localStorage.getItem('shortcut_tip_shown') !== 'true'
  )

  // Periodic tick to keep shouldShowBreak up to date (re-evaluates Date.now() every 30s)
  const [, setTick] = useState(0)

  // N1: track last category switch
  const [lastSwitch, setLastSwitch] = useState<{ at: number; fromName: string } | null>(null)
  // N5: idle tracking
  const [idleMs, setIdleMs] = useState(0)
  const lastActivityRef = useRef(Date.now())

  // ── FocusGuard state ────────────────────────────────────────────────────────
  const [focusPreset, setFocusPreset] = useState<FocusPreset>(FOCUS_PRESETS[0])
  const [focusStrictMode, setFocusStrictMode] = useState(false)
  const [breakActive, setBreakActive] = useState(false)
  const [postponedUntil, setPostponedUntil] = useState<number | null>(null)
  const [postponeUsed, setPostponeUsed] = useState(false)
  const [breakSkipCount, setBreakSkipCount] = useState(0)
  const [breakCompletedCount, setBreakCompletedCount] = useState(0)

  // ── Hooks ───────────────────────────────────────────────────────────────────
  useInitStore(storage)
  const webhooks = useWebhooks(webhookUrl)
  const notifications = useNotifications()
  const inputActivity = useInputActivity()

  // P1: passive window capture (M89: pass inputActivity for idle detection)
  const activeCatId = categories.find(c => c.activeEntry !== null)?.id ?? null
  const { blocks: captureBlocks, unclassifiedProcess, suggestedCategoryId, recentTitles, elevationSuggestion, assignProcess, dismissProcess, elevateProcess, dismissElevation, resetAutoStart } = usePassiveCapture(activeCatId, inputActivity)
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

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      storage.getSetting(SettingKey.WebhookUrl),
      storage.getSetting(SettingKey.FocusPreset),
      storage.getSetting(SettingKey.FocusStrictMode),
      loadCredential(SettingKey.AnthropicApiKey),
      storage.getSetting(SettingKey.GithubUsername),
      storage.getSetting(SettingKey.ScreenshotsEnabled),
      storage.getSetting(SettingKey.WorkspaceRoot),
      storage.getSetting(SettingKey.SlackToken),
    ]).then(([url, preset, strict, apiKey, ghUser, screenshots, wsRoot, slackTok]) => {
      setWebhookUrl(url)
      setClaudeApiKey(apiKey)
      setGithubUsername(ghUser)
      setScreenshotsEnabled(screenshots === 'true')
      setWorkspaceRoot(wsRoot)
      setSlackToken(slackTok)
      if (preset) {
        const found = FOCUS_PRESETS.find(p => p.name === preset)
        if (found) setFocusPreset(found)
      }
      if (strict === 'true') setFocusStrictMode(true)
    }).catch(err => {
      console.error('[App] Failed to load settings:', err)
    })
  }, [])

  const today = useMemo(() => toDateString(Date.now()), [])

  useObsidianExport(storage, today, sessions, categories, intentions, eveningReview)

  useEffect(() => {
    Promise.all([
      storage.loadIntentionsByDate(today),
      storage.loadEveningReviewByDate(today),
    ]).then(([ints, rev]) => {
      setIntentions(ints)
      setEveningReview(rev)
    }).catch(err => {
      console.error('[App] Failed to load daily data:', err)
    })
  }, [today])

  const weekDates = useMemo(() => getWeekDates(today), [today])
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

  // ── Reset break state when active category changes ──────────────────────────
  useEffect(() => {
    setBreakActive(false)
    setPostponedUntil(null)
    setPostponeUsed(false)
  }, [activeCategory?.id])

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

  // ── 30-second tick — ensures shouldShowBreak is re-evaluated promptly ────────
  useEffect(() => {
    if (!activeStartedAt) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [activeStartedAt])

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

  // ── Nav overflow click-outside ───────────────────────────────────────────────
  useEffect(() => {
    if (!navMoreOpen) return
    function onDown(e: MouseEvent) {
      if (navMoreRef.current && !navMoreRef.current.contains(e.target as Node)) setNavMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [navMoreOpen])

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
    if (active?.id !== suggestedCategoryId) handleStart(suggestedCategoryId)
  }, [suggestedCategoryId])

  // ── Daily recap: show yesterday's summary on first open of the day ──────────
  useEffect(() => {
    if (historySessions.length === 0) return
    const todayStr = toDateString(Date.now())
    const lastOpen = localStorage.getItem('last_open_date')
    localStorage.setItem('last_open_date', todayStr)
    if (!lastOpen || lastOpen === todayStr) return

    const yesterday = toDateString(Date.now() - 86_400_000)
    const yesterdaySessions = historySessions.filter(s => s.date === yesterday)
    if (yesterdaySessions.length === 0) return

    const totalMs = yesterdaySessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
    const catCount = new Set(yesterdaySessions.map(s => s.categoryId)).size
    const totalH = Math.floor(totalMs / 3_600_000)
    const totalM = Math.floor((totalMs % 3_600_000) / 60_000)
    const timeStr = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`
    setDailyRecap(`${t('app.yesterdayPrefix')} ${timeStr} tracked across ${catCount} categor${catCount === 1 ? 'y' : 'ies'}.`)
  }, [historySessions])

  // ── FocusGuard trigger ──────────────────────────────────────────────────────
  const now = Date.now()
  const postponeBlocked = postponedUntil !== null && now < postponedUntil
  const shouldShowBreak = !breakActive
    && !postponeBlocked
    && activeStartedAt !== null
    && shouldTriggerBreak(activeStartedAt, now, focusPreset.workMs)

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
    const prevStartedAt = prev?.activeEntry?.startedAt ?? null  // capture before startTimer changes state
    if (prev && prev.id !== id) {
      setLastSwitch({ at: Date.now(), fromName: prev.name })
      void flushCaptureStats(captureBlocksRef.current)
    }
    startTimer(id)
    const cat = categories.find(c => c.id === id)
    if (cat) {
      webhooks.onTimerStarted(cat.name, Date.now())
      if (slackToken) void setSlackFocusStatus(slackToken, cat.name).catch(() => {})
    }
    if (prev && prev.id !== id) {
      const elapsed = prevStartedAt !== null ? Date.now() - prevStartedAt : 0
      const { sessions: s } = useTimerStore.getState()
      if (elapsed >= MIN_SESSION_MS) {
        await storage.saveSession(s[s.length - 1])
      } else {
        // Remove the micro-session from memory so storage and Zustand stay in sync
        useTimerStore.setState({ sessions: s.slice(0, -1) })
      }
    }
    // Persist active timer so it survives crashes and is visible to CLI
    const entry = useTimerStore.getState().categories.find(c => c.id === id)?.activeEntry
    if (entry) {
      await storage.setActiveEntry(id, entry.startedAt)
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

  async function handleArchive(id: string, archived: boolean) {
    archiveCategory(id, archived)
    await storage.archiveCategory(id, archived)
  }

  async function handleStop(id: string, tag?: string) {
    const cat = categories.find(c => c.id === id)
    const entry = cat?.activeEntry
    const weeklyBefore = computeWeekMs(sessions, id, weekDates)
    const resolvedTag = tag ?? suggestSessionTag(recentTitles) ?? undefined
    stopTimer(id, resolvedTag)
    const { sessions: s } = useTimerStore.getState()
    const saved = s[s.length - 1]
    const elapsed = entry ? saved.endedAt - entry.startedAt : 0
    if (elapsed < MIN_SESSION_MS) {
      // Remove the micro-session from store and clear active entry without persisting
      useTimerStore.setState({ sessions: s.slice(0, -1) })
      await storage.clearActiveEntry()
      return
    }
    await storage.saveSession(saved)
    await storage.clearActiveEntry()
    if (slackToken) void clearSlackStatus(slackToken).catch(() => {})

    if (cat && entry) {
      const todaySessions = useTimerStore.getState().sessions.filter(s => s.date === today)
      const weeklyAfterStop = weeklyBefore + (saved.endedAt - entry.startedAt)
      webhooks.onTimerStopped(cat.name, entry.startedAt, saved.endedAt, resolvedTag, todaySessions.length, weeklyAfterStop)

      // Notify on goal milestones (25 / 50 / 75 / 100 %)
      const goalMs = cat.weeklyGoalMs ?? 0
      if (goalMs > 0) {
        const weeklyAfter = weeklyAfterStop
        const pctBefore = (weeklyBefore / goalMs) * 100
        const pctAfter  = (weeklyAfter  / goalMs) * 100
        for (const milestone of [25, 50, 75] as const) {
          if (pctBefore < milestone && pctAfter >= milestone) {
            void notifications.notifyGoalMilestone(cat.name, milestone)
          }
        }
        if (pctBefore < 100 && pctAfter >= 100) {
          notifications.notifyGoalReached(cat.name, Math.round(goalMs / 3_600_000))
          const catWeeklyCount = useTimerStore.getState().sessions.filter(s => weekDates.includes(s.date) && s.categoryId === id).length
          webhooks.onGoalReached(cat.name, goalMs, weeklyAfter, catWeeklyCount, streaks[id] ?? 0)
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
    // Daily review webhook with category breakdown
    const totalMs = categories.reduce((sum, c) => sum + c.accumulatedMs, 0)
    const sorted = categories.slice().sort((a, b) => b.accumulatedMs - a.accumulatedMs)
    const topCat = sorted[0]
    const breakdown = sorted.filter(c => c.accumulatedMs > 0).map(c => ({ category: c.name, durationMs: c.accumulatedMs }))
    webhooks.onDailyReview(mood, totalMs, topCat?.name ?? '', breakdown)
  }

  function handlePostpone() {
    setPostponedUntil(Date.now() + POSTPONE_MS)
    setPostponeUsed(true)
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

      {shouldShowBreak && (
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
            if (activeCategory && activeStartedAt) {
              webhooks.onBreakSkipped(activeCategory.name, Date.now() - activeStartedAt)
            }
          }}
        />
      )}

      {/* Header — tinted with active category color when timer is running */}
      <header className="border-b border-white/6 transition-colors" style={
        activeCategory?.color && view === 'tracker'
          ? { borderColor: activeCategory.color + '30', backgroundColor: activeCategory.color + '08' }
          : {}
      }>
        <div className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{t('app.title')}</span>
            {dailyRecap && (
              <span className="text-xs text-zinc-600 hidden sm:inline">· {dailyRecap}</span>
            )}
          </div>
          <nav className="flex items-center">
            {/* Primary tabs — Tracker + Stats */}
            {PRIMARY_VIEWS.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative px-4 h-14 text-sm transition-colors ${
                  view === v ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'tracker' ? t('nav.timer') : v === 'today' ? t('nav.today') : t('nav.stats')}
                {view === v && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
                )}
              </button>
            ))}

            {/* Secondary nav — ··· overflow */}
            <div className="relative" ref={navMoreRef}>
              <button
                onClick={() => setNavMoreOpen(p => !p)}
                className={`relative px-3 h-14 text-sm transition-colors ${
                  SECONDARY_VIEWS.includes(view as typeof SECONDARY_VIEWS[number])
                    ? 'text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="More"
              >
                ···
                {SECONDARY_VIEWS.includes(view as typeof SECONDARY_VIEWS[number]) && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
                )}
              </button>
              {navMoreOpen && (
                <div className="absolute right-0 top-14 z-30 w-36 rounded-lg border border-white/[0.1] bg-zinc-900 py-1 shadow-xl text-sm">
                  {SECONDARY_VIEWS.map(v => (
                    <button
                      key={v}
                      onClick={() => { setView(v); setNavMoreOpen(false) }}
                      className={`flex w-full px-4 py-2 transition-colors ${
                        view === v ? 'text-zinc-100 bg-white/[0.04]' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
                      }`}
                    >
                      {v === 'today' ? t('nav.today') : v === 'history' ? t('nav.history') : t('nav.settings')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setPaletteOpen(true)}
              className="ml-1 rounded border border-white/[0.07] px-2 py-1 text-[10px] text-zinc-600 hover:text-zinc-400 hover:border-white/15 transition-all"
              title="Open command palette (⌘K)"
            >
              ⌘K
            </button>
          </nav>
        </div>
      </header>

      {activeCategory && activeStartedAt && (
        <ActiveTimerBar
          categoryName={activeCategory.name}
          color={activeCategory.color}
          startedAt={activeStartedAt}
          onStop={() => handleStop(activeCategory.id)}
          presetName={focusPreset.name}
        />
      )}

      <main className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 py-8">

        {availableUpdate && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs text-emerald-300">
            <span>New version {availableUpdate} available — check GitHub releases for download.</span>
          </div>
        )}

        {/* Single-slot top-level banner — strict priority: morningPrompt > shortcutTip */}
        {(() => {
          const activeBanner: 'morning' | 'shortcut' | null =
            showMorningPrompt && intentions.length === 0 && mvdItems.length === 0 ? 'morning' :
            showShortcutTip && onboardingDone && categories.length > 0 ? 'shortcut' :
            null

          // M68: compute yesterday brief for morning card
          const morningBrief = (() => {
            if (activeBanner !== 'morning' || historySessions.length === 0) return null
            const yesterday = toDateString(Date.now() - 86_400_000)
            const yesterdaySessions = historySessions.filter(s => s.date === yesterday)
            if (yesterdaySessions.length === 0) return null
            const totalMs = yesterdaySessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
            const byCategory = new Map<string, number>()
            for (const s of yesterdaySessions) byCategory.set(s.categoryId, (byCategory.get(s.categoryId) ?? 0) + (s.endedAt - s.startedAt))
            const topCatId = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
            const topCatName = categories.find(c => c.id === topCatId)?.name ?? ''
            return { totalMs, topCatName }
          })()

          if (activeBanner === 'morning' && view === 'tracker') return (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-amber-200 font-medium mb-1">{t('app.goodMorning')}</p>
                  {morningBrief && (
                    <p className="text-amber-400/80 mb-1">
                      {t('app.yesterdayPrefix')} {formatElapsed(morningBrief.totalMs)}{morningBrief.topCatName ? ` ${t('app.topPrefix')} ${morningBrief.topCatName}` : ''}
                    </p>
                  )}
                  {/* M71: inline intention input */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const input = (e.target as HTMLFormElement).elements.namedItem('intention') as HTMLInputElement
                      if (input.value.trim()) {
                        await handleAddIntention(input.value.trim())
                        input.value = ''
                      }
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      name="intention"
                      placeholder={t('app.addIntention')}
                      className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-xs text-amber-200 placeholder-amber-700 outline-none focus:border-amber-500/40"
                    />
                    <button type="submit" className="text-xs text-amber-400 hover:text-amber-200 transition-colors px-2">
                      +
                    </button>
                  </form>
                  <button
                    onClick={() => setView('today')}
                    className="mt-1 text-xs text-amber-600 hover:text-amber-300 transition-colors"
                  >
                    {t('app.setIntentions')}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const todayKey = toDateString(Date.now())
                    localStorage.setItem(`morning_prompt_dismissed_${todayKey}`, 'true')
                    setShowMorningPrompt(false)
                  }}
                  className="ml-4 text-amber-600 hover:text-amber-300 transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          )

          if (activeBanner === 'shortcut' && view === 'tracker') return (
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

          return null
        })()}

        {view === 'tracker' ? (
          <TrackerView
            input={input}
            setInput={setInput}
            categories={categories}
            sessions={sessions}
            historySessions={historySessions}
            weekDates={weekDates}
            categoryInsights={categoryInsights}
            activeCategory={activeCategory}
            claudeApiKey={claudeApiKey}
            breakSkipCount={breakSkipCount}
            breakCompletedCount={breakCompletedCount}
            onAdd={handleAdd}
            onStart={handleStart}
            onStop={handleStop}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onRename={handleRename}
            onSetGoal={handleSetGoal}
            onSetColor={handleSetColor}
            onSetTag={handleSetTag}
            onFocusLock={() => setFocusLockActive(true)}
            onShortcutUsed={() => { localStorage.setItem('shortcut_tip_shown', 'true'); setShowShortcutTip(false) }}
            onOpenNLP={fn => { openNLPRef.current = fn }}
            switchedAt={lastSwitch?.at ?? null}
            switchedFromCategory={lastSwitch?.fromName ?? ''}
            idleMs={idleMs}
            inputActivity={inputActivity}
            onNLPConfirm={async (entry) => {
              const startedAt = new Date(entry.date + 'T' + String(entry.startHour).padStart(2, '0') + ':00:00').getTime()
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
            }}
            storage={storage}
            unclassifiedProcess={unclassifiedProcess}
            onAssignProcess={assignProcess}
            onDismissProcess={dismissProcess}
            elevationSuggestion={elevationSuggestion}
            onElevateProcess={elevateProcess}
            onDismissElevation={dismissElevation}
            mvdItems={mvdItems}
            onMVDChange={setMvdItems}
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
            webhookUrl={webhookUrl ?? ''}
            onWebhookUrlChange={url => setWebhookUrl(url || null)}
            focusPreset={focusPreset}
            onFocusPresetChange={setFocusPreset}
            focusStrictMode={focusStrictMode}
            onFocusStrictModeChange={setFocusStrictMode}
            onScreenshotsEnabledChange={setScreenshotsEnabled}
            captureBlocks={captureBlocks}
          />
        )}

      </main>

      {/* Global classify overlay — visible in any view */}
      {unclassifiedProcess && (
        <ClassifyOverlay
          process={unclassifiedProcess}
          categories={categories.filter(c => !c.archived)}
          onAssign={assignProcess}
          onDismiss={dismissProcess}
        />
      )}
    </div>
  )
}

// ── ClassifyOverlay ───────────────────────────────────────────────────────────

const SLOT_KEYWORDS: Record<CategorySlot, string[]> = {
  work:     ['work', 'trabalho', 'job', 'professional', 'dev', 'code', 'coding'],
  study:    ['study', 'estudo', 'learn', 'aprender', 'course', 'curso'],
  personal: ['personal', 'pessoal', 'life', 'leisure', 'lazer', 'hobby'],
}

function slotMatchesCategory(slot: CategorySlot, name: string): boolean {
  const n = name.toLowerCase()
  return SLOT_KEYWORDS[slot].some(kw => n.includes(kw))
}

function ClassifyOverlay({
  process: app,
  categories,
  onAssign,
  onDismiss,
}: {
  process: import('../domain/passiveCapture').UnclassifiedApp
  categories: import('../store/useTimerStore').Category[]
  onAssign: (process: string, categoryId: string) => void
  onDismiss: (process: string) => void
}) {
  const { t } = useI18n()

  // Find which slot DEFAULT_CATEGORY_SUGGESTIONS maps this app's rule id to
  // Try matching by process name against rule patterns in DEFAULT_DEV_RULES
  const suggestedSlot: CategorySlot | null = (() => {
    const procLower = app.process.toLowerCase()
    for (const [ruleId, slot] of Object.entries(DEFAULT_CATEGORY_SUGGESTIONS)) {
      // ruleId maps to a pattern — we compare against known process names heuristically
      if (procLower.includes(ruleId.replace(/-title$/, '').replace(/-ins$/, ''))) return slot as CategorySlot
    }
    return null
  })()

  const suggestedCategory = suggestedSlot
    ? categories.find(c => slotMatchesCategory(suggestedSlot, c.name)) ?? null
    : null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-sky-500/30 bg-zinc-900/95 shadow-2xl backdrop-blur-sm p-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-2 mb-3">
        {app.iconBase64 && (
          <img src={app.iconBase64} alt="" className="h-6 w-6 rounded" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sky-300 truncate">{app.displayName}</p>
          <p className="text-[10px] text-zinc-500 truncate">{app.process}</p>
        </div>
        <button
          onClick={() => onDismiss(app.process)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <p className="text-xs text-zinc-400 mb-2">{t('tracker.whichCategory')}</p>

      {suggestedCategory && (
        <button
          onClick={() => onAssign(app.process, suggestedCategory.id)}
          className="w-full mb-2 rounded-lg px-3 py-2 text-sm font-medium border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 transition-all"
        >
          {suggestedCategory.name}
          <span className="ml-2 text-[10px] text-sky-500 font-normal">sugerido</span>
        </button>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categories
          .filter(c => c.id !== suggestedCategory?.id)
          .map(c => (
            <button
              key={c.id}
              onClick={() => onAssign(app.process, c.id)}
              className="rounded border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:border-white/20 transition-all"
            >
              {c.name}
            </button>
          ))}
      </div>
    </div>
  )
}
