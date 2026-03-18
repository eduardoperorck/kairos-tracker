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
import { CommandPalette } from './CommandPalette'
import { OnboardingWizard } from './OnboardingWizard'
import { ProductivityWrapped } from './ProductivityWrapped'
import type { CategoryInsights } from './CategoryItem'
import { shouldTriggerBreak, FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { createIntention, createEveningReview } from '../domain/intentions'
import { formatElapsed } from '../domain/format'
import { useInputActivity } from '../hooks/useInputActivity'
import { usePassiveCapture } from '../hooks/usePassiveCapture'
import type { Intention, EveningReview } from '../domain/intentions'
import type { Storage } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import { loadCredential } from '../services/credentials'
import type { MVDItem } from '../domain/minimumViableDay'

const POSTPONE_MS = 5 * 60_000 // 5 minutes

type Props = { storage: Storage }

export function App({ storage }: Props) {
  const { t } = useI18n()
  const { categories, sessions, historySessions, addCategory, startTimer, stopTimer, deleteCategory, renameCategory, setWeeklyGoal, setCategoryColor, setPendingTag } = useTimerState()

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
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false)
  const [wrappedOpen, setWrappedOpen] = useState(false)
  const [mvdItems, setMvdItems] = useState<MVDItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('mvd_items') ?? '[]') } catch { return [] }
  })
  // P1: passive window capture
  const { blocks: captureBlocks, unclassifiedProcess, suggestedCategoryId, assignProcess, dismissProcess } = usePassiveCapture()

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

  // ── Hooks ───────────────────────────────────────────────────────────────────
  useInitStore(storage)
  const webhooks = useWebhooks(webhookUrl)
  const notifications = useNotifications()
  const inputActivity = useInputActivity()

  // ── Load settings on mount ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      storage.getSetting(SettingKey.WebhookUrl),
      storage.getSetting(SettingKey.FocusPreset),
      storage.getSetting(SettingKey.FocusStrictMode),
      loadCredential(SettingKey.AnthropicApiKey),
      storage.getSetting(SettingKey.GithubUsername),
      storage.getSetting(SettingKey.ScreenshotsEnabled),
    ]).then(([url, preset, strict, apiKey, ghUser, screenshots]) => {
      setWebhookUrl(url)
      setClaudeApiKey(apiKey)
      setGithubUsername(ghUser)
      setScreenshotsEnabled(screenshots === 'true')
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

  // ── Long-session notification (every 2h without a break) ────────────────────
  useEffect(() => {
    if (!activeStartedAt || !activeCategory) return
    const id = setInterval(() => {
      const elapsedH = (Date.now() - activeStartedAt) / 3_600_000
      if (elapsedH >= 2) notifications.notifyLongSession(activeCategory.name, Math.round(elapsedH))
    }, 30 * 60_000) // check every 30 min
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
    if (active) handleStop(active.id)
  }, [])

  useIdleDetection(10, handleIdle, useCallback(() => {}, []))

  // P1: auto-start timer when a classified app gains focus
  useEffect(() => {
    if (!suggestedCategoryId) return
    const state = useTimerStore.getState()
    const active = state.categories.find(c => c.activeEntry !== null)
    if (active?.id !== suggestedCategoryId) handleStart(suggestedCategoryId)
  }, [suggestedCategoryId])

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
    if (prev && prev.id !== id) {
      setLastSwitch({ at: Date.now(), fromName: prev.name })
    }
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
      {!onboardingDone && categories.length === 0 && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

      {wrappedOpen && (
        <ProductivityWrapped sessions={historySessions} categories={categories} onClose={() => setWrappedOpen(false)} />
      )}

      {paletteOpen && (
        <CommandPalette
          categories={categories}
          activeId={activeCategory?.id ?? null}
          onStart={id => { handleStart(id); setPaletteOpen(false) }}
          onStop={() => { activeCategory && handleStop(activeCategory.id); setPaletteOpen(false) }}
          onNavigate={v => { setView(v); setPaletteOpen(false) }}
          onClose={() => setPaletteOpen(false)}
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
          onBreakComplete={() => setBreakActive(true)}
          onPostpone={handlePostpone}
          onBreakSkipped={() => {
            setBreakSkipCount(c => c + 1)
            if (activeCategory && activeStartedAt) {
              webhooks.onBreakSkipped(activeCategory.name, Date.now() - activeStartedAt)
            }
          }}
        />
      )}

      {/* Header */}
      <header className="border-b border-white/6">
        <div className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-100">{t('app.title')}</span>
          <nav className="flex">
            {(['tracker', 'stats', 'history', 'today', 'settings'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative px-4 h-14 text-sm transition-colors ${
                  view === v ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'tracker' ? t('nav.timer') : v === 'stats' ? t('nav.stats') : v === 'history' ? t('nav.history') : v === 'today' ? t('nav.today') : t('nav.settings')}
                {view === v && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 py-8">

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
            onAdd={handleAdd}
            onStart={handleStart}
            onStop={handleStop}
            onDelete={handleDelete}
            onRename={handleRename}
            onSetGoal={handleSetGoal}
            onSetColor={handleSetColor}
            onSetTag={handleSetTag}
            onFocusLock={() => setFocusLockActive(true)}
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
            nickname={githubUsername ?? 'Anonymous'}
            captureBlocks={captureBlocks}
            screenshotsEnabled={screenshotsEnabled}
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
          />
        )}

      </main>
    </div>
  )
}
