import { useState, useMemo, useEffect } from 'react'
import { FocusReplay } from './FocusReplay'
import { InterruptCostWidget } from './InterruptCostWidget'
import { RecommendationsView } from './RecommendationsView'
import { formatElapsed, formatShortDate } from '../domain/format'
import { useI18n, DAY_LABELS } from '../i18n'
import { DigestView } from './DigestView'
import { ShareWeekButton } from './WeeklyStatCard'
import { BurnoutRiskBadge } from './BurnoutRiskBadge'
import { MakerManagerBadge } from './MakerManagerBadge'
import { DistractionBudgetWidget } from './DistractionBudgetWidget'
import { DistractionPatternWidget } from './DistractionPatternWidget'
import { CodeQualityView } from './CodeQualityView'
import { ScreenshotTimeline } from './ScreenshotTimeline'
import { useGitHubActivity } from '../hooks/useGitHubActivity'
import { computeHourDistribution, computeDayTotals, computeEnergyPattern, isFlowSession } from '../domain/history'
import { computeTrackingAccuracy } from '../domain/passiveCapture'
import { TrackingAccuracyWidget } from './TrackingAccuracyWidget'
import { computeWeekMs, getWeekDates, toDateString } from '../domain/timer'
import type { StatEntry } from '../domain/stats'
import type { Session, Category } from '../domain/timer'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { GitCommit } from '../domain/codeQuality'

type WeeklyEntry = {
  id: string
  weeklyMs: number
  weeklyGoalMs?: number
}

import type { Storage } from '../persistence/storage'
import { SettingKey } from '../persistence/storage'
import { DailyInsightCard } from './DailyInsightCard'
import { computeDailyInsights } from '../domain/dailyInsights'

type Props = {
  stats: StatEntry[]
  weeklyData: WeeklyEntry[]
  streaks: Record<string, number>
  onBack: () => void
  historySessions?: Session[]
  categories?: Category[]
  storage?: Storage
  onWrapped?: () => void
  githubUsername?: string | null
  // N2, N3, N6 — passive capture data
  captureBlocks?: CaptureBlock[]
  // I3 — git commits for code quality view
  gitCommits?: GitCommit[]
  // I6 — screenshots
  screenshotsEnabled?: boolean
}

function offsetDate(today: string, offsetWeeks: number): string {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(weekDates: string[], lang: 'en' | 'pt'): string {
  if (weekDates.length === 0) return ''
  const start = weekDates[0]
  const end = weekDates[6]
  return `${formatShortDate(start, lang)} – ${formatShortDate(end, lang)}`
}

const HEATMAP_COLORS = [
  'bg-zinc-800',      // 0
  'bg-zinc-600',      // < 1h
  'bg-zinc-400',      // 1-3h
  'bg-emerald-500/60',// 3-5h
  'bg-emerald-400',   // 5h+
]

function heatColor(totalMs: number): string {
  if (totalMs === 0) return HEATMAP_COLORS[0]
  const h = totalMs / 3_600_000
  if (h < 1) return HEATMAP_COLORS[1]
  if (h < 3) return HEATMAP_COLORS[2]
  if (h < 5) return HEATMAP_COLORS[3]
  return HEATMAP_COLORS[4]
}

export function StatsView({ stats, weeklyData, streaks, onBack, historySessions = [], categories = [], storage, onWrapped, githubUsername, captureBlocks = [], gitCommits = [], screenshotsEnabled = false }: Props) {
  const { t, lang } = useI18n()
  const [mainTab, setMainTab] = useState<'overview' | 'patterns' | 'advanced'>(() =>
    (localStorage.getItem('stats_main_tab') as 'overview' | 'patterns' | 'advanced') ?? 'overview'
  )
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' })
  const githubCommits = useGitHubActivity(githubUsername ?? null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showReplay, setShowReplay] = useState(false)
  const [hourlyRate, setHourlyRate] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!storage) return
    storage.getSetting(SettingKey.HourlyRate).then(v => {
      const n = v ? parseFloat(v) : NaN
      if (!isNaN(n) && n > 0) setHourlyRate(n)
    })
  }, [storage])

  const today = toDateString(Date.now())
  const selectedWeekDates = getWeekDates(offsetDate(today, weekOffset))

  // For week view with offset: compute using historySessions
  const offsetWeeklyData: WeeklyEntry[] = weekOffset === 0
    ? weeklyData
    : (categories ?? []).map(c => ({
        id: c.id,
        weeklyMs: computeWeekMs(historySessions, c.id, selectedWeekDates),
        weeklyGoalMs: c.weeklyGoalMs,
      }))

  const weeklyById = Object.fromEntries(offsetWeeklyData.map(w => [w.id, w]))
  const weeklyTotal = offsetWeeklyData.reduce((sum, w) => sum + w.weeklyMs, 0)

  const weeklyStats = stats.map(entry => {
    const w = weeklyById[entry.id]
    const weeklyMs = w?.weeklyMs ?? 0
    return {
      ...entry,
      weeklyMs,
      weeklyGoalMs: w?.weeklyGoalMs,
      weeklyPercentage: weeklyTotal === 0 ? 0 : Math.round((weeklyMs / weeklyTotal) * 100),
    }
  }).sort((a, b) => b.weeklyMs - a.weeklyMs)

  const isEmpty = stats.length === 0 && historySessions.length === 0

  // M90: Tracking Accuracy Score
  const tas = useMemo(
    () => computeTrackingAccuracy(historySessions, captureBlocks),
    [historySessions, captureBlocks]
  )
  const showTAS = historySessions.length >= 5 && captureBlocks.length > 0

  // Patterns data
  const hourDist = computeHourDistribution(historySessions)
  const maxHourMs = hourDist.length > 0 ? Math.max(...hourDist.map(h => h.totalMs)) : 1
  const energy = computeEnergyPattern(historySessions, 60)

  // Heatmap: 13 weeks × 7 days
  const since91 = toDateString(Date.now() - 91 * 86_400_000)
  const dayTotals = computeDayTotals(historySessions, categories, since91)
  const dayTotalMap = new Map(dayTotals.map(d => [d.date, d.totalMs]))

  // M-UX8: Daily insights
  const dailyInsights = computeDailyInsights(historySessions, today, streaks)

  // Flow sessions per category for weekly view
  const weekFlowMap = new Map<string, number>()
  for (const s of historySessions.filter(s => selectedWeekDates.includes(s.date))) {
    if (isFlowSession(s)) {
      weekFlowMap.set(s.categoryId, (weekFlowMap.get(s.categoryId) ?? 0) + 1)
    }
  }

  return (
    <div className="space-y-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button aria-label="Back" onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
            {t('stats.back')}
          </button>
          <span className="text-zinc-700">·</span>
          <h2 className="text-sm font-semibold text-zinc-200">{t('stats.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* M86: Replay my day */}
          <button
            onClick={() => setShowReplay(r => !r)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-white/[0.07] rounded px-2 py-1"
          >
            {t('stats.replayDay')}
          </button>
          {/* M-UX9: Monthly Recap — available every month */}
          {onWrapped && (
            <button onClick={onWrapped} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              {t('wrapped.monthlyRecap').replace('{month}', currentMonthName)}
            </button>
          )}
        </div>
      </div>

      {/* M86: Replay overlay */}
      {showReplay && (
        <FocusReplay
          blocks={captureBlocks}
          sessions={historySessions}
          categories={categories}
          date={today}
          onClose={() => setShowReplay(false)}
        />
      )}

      {/* ── Main tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {(['overview', 'patterns', 'advanced'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setMainTab(tab); localStorage.setItem('stats_main_tab', tab) }}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              mainTab === tab
                ? 'border-emerald-500 text-zinc-200'
                : 'border-transparent text-zinc-600 hover:text-zinc-400'
            }`}
          >
            {tab === 'overview' ? t('stats.tabOverview')
              : tab === 'patterns' ? t('stats.tabPatterns')
              : t('stats.tabAdvanced')}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <p className="mt-16 text-center text-sm text-zinc-700">{t('stats.empty')}</p>
      ) : (
        <>
          {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
          {mainTab === 'overview' && (
            <div className="space-y-10">
              {/* M-UX8: Daily Insight Card */}
              <DailyInsightCard insights={dailyInsights} categories={categories} />

              {/* TODAY */}
              <section>
                <h3 className="mb-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('stats.today')}</h3>
                <ul className="space-y-4">
                  {stats.map(entry => (
                    <li key={entry.id}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-zinc-200">{entry.name}</span>
                          {(streaks[entry.id] ?? 0) > 0 && (
                            <span className="text-xs text-zinc-600 tabular-nums">{streaks[entry.id]}{t('stats.streak')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm tabular-nums text-zinc-400">{formatElapsed(entry.totalMs)}</span>
                          <span className="text-xs text-zinc-600 w-8 text-right tabular-nums">{entry.percentage}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full bg-zinc-600 transition-all" style={{ width: `${entry.percentage}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* M88: Interrupt Cost Widget */}
              <InterruptCostWidget
                sessions={historySessions}
                date={today}
                hourlyRate={hourlyRate}
              />

              {/* THIS WEEK */}
              <section>
                <div className="mb-4 flex items-center gap-4">
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('stats.thisWeek')}</h3>
                  <div className="flex items-center gap-2 ml-auto">
                    <button className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={() => setWeekOffset(o => o - 1)}>{t('stats.prevWeek')}</button>
                    <span className="text-xs text-zinc-500">{formatWeekLabel(selectedWeekDates, lang)}</span>
                    <button className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-30"
                      onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>{t('stats.nextWeek')}</button>
                  </div>
                </div>
                <ul className="space-y-4">
                  {weeklyStats.map(entry => {
                    const goalMs = entry.weeklyGoalMs ?? 0
                    const goalPct = goalMs > 0 ? Math.min(Math.round((entry.weeklyMs / goalMs) * 100), 100) : 0
                    const hasGoal = goalMs > 0
                    const flowCount = weekFlowMap.get(entry.id) ?? 0
                    return (
                      <li key={entry.id}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-zinc-200">{entry.name}</span>
                            {(streaks[entry.id] ?? 0) > 0 && (
                              <span className="text-xs text-zinc-600 tabular-nums">{streaks[entry.id]}{t('stats.streak')}</span>
                            )}
                            {flowCount > 0 && (
                              <span className="text-xs text-amber-500/70 tabular-nums">{flowCount} {t('stats.flow')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm tabular-nums text-zinc-400">
                              {formatElapsed(entry.weeklyMs)}
                              {hasGoal && <span className="text-zinc-700"> / {formatElapsed(goalMs)}</span>}
                            </span>
                            <span className={`text-xs w-8 text-right tabular-nums ${
                              hasGoal ? (goalPct >= 100 ? 'text-emerald-400' : 'text-zinc-500') : 'text-zinc-600'
                            }`}>
                              {hasGoal ? `${goalPct}%` : `${entry.weeklyPercentage}%`}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            hasGoal ? (goalPct >= 100 ? 'bg-emerald-500' : 'bg-emerald-500/50') : 'bg-zinc-600'
                          }`} style={{ width: `${hasGoal ? goalPct : entry.weeklyPercentage}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-4 flex justify-end">
                  <ShareWeekButton
                    weekLabel={formatWeekLabel(selectedWeekDates, lang)}
                    stats={weeklyStats.map(e => ({ id: e.id, name: e.name, weeklyMs: e.weeklyMs, weeklyGoalMs: e.weeklyGoalMs, color: (categories ?? []).find(c => c.id === e.id)?.color }))}
                    totalMs={weeklyTotal}
                    topStreak={Math.max(...Object.values(streaks), 0)}
                    flowCount={[...weekFlowMap.values()].reduce((a, b) => a + b, 0)}
                  />
                </div>
                <DigestView
                  categories={categories}
                  sessions={historySessions.filter(s => selectedWeekDates.includes(s.date))}
                  historySessions={historySessions}
                  today={offsetDate(today, weekOffset)}
                />
              </section>

              {/* 13-week heatmap */}
              <section>
                <h4 className="mb-3 text-xs text-zinc-600">{t('stats.heatmap')}</h4>
                <div className="flex gap-1">
                  <div className="flex flex-col gap-1 mr-1">
                    {DAY_LABELS[lang].map(d => (
                      <div key={d} className="h-3 text-[10px] text-zinc-700 leading-3">{d}</div>
                    ))}
                  </div>
                  {Array.from({ length: 13 }, (_, weekIdx) => {
                    const weekStart = new Date(Date.now() - (12 - weekIdx) * 7 * 86_400_000)
                    const day = weekStart.getUTCDay()
                    const mondayOff = day === 0 ? -6 : 1 - day
                    const monday = new Date(weekStart)
                    monday.setUTCDate(weekStart.getUTCDate() + mondayOff)
                    return (
                      <div key={weekIdx} className="flex flex-col gap-1">
                        {Array.from({ length: 7 }, (_, dayIdx) => {
                          const d = new Date(monday)
                          d.setUTCDate(monday.getUTCDate() + dayIdx)
                          const dateStr = d.toISOString().slice(0, 10)
                          const total = dayTotalMap.get(dateStr) ?? 0
                          const ghCommits = githubCommits.get(dateStr) ?? 0
                          return (
                            <div key={dayIdx}
                              title={`${dateStr}: ${formatElapsed(total)}${ghCommits > 0 ? ` · ${ghCommits} commits` : ''}`}
                              className={`relative w-3 h-3 rounded-sm ${heatColor(total)}`}>
                              {ghCommits > 0 && (
                                <span className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-amber-400 opacity-90" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ── PATTERNS TAB ──────────────────────────────────────── */}
          {mainTab === 'patterns' && (
            <div className="space-y-8">
              {/* Hour distribution */}
              <section>
                <h4 className="mb-3 text-xs text-zinc-600">{t('stats.hourDist')}</h4>
                <div className="space-y-1.5">
                  {hourDist.sort((a, b) => b.totalMs - a.totalMs).slice(0, 8).map(slot => (
                    <div key={slot.hour} className="flex items-center gap-3">
                      <span className="w-6 text-xs text-zinc-600 tabular-nums text-right">{slot.hour}h</span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500/60 transition-all"
                          style={{ width: `${Math.round((slot.totalMs / maxHourMs) * 100)}%` }} />
                      </div>
                      <span className="w-14 text-right font-mono text-xs text-zinc-600">{formatElapsed(slot.totalMs)}</span>
                    </div>
                  ))}
                </div>
                {energy.peakHours.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-600 italic">
                    {t('energy.peakHoursInsight').replace('{hours}', energy.peakHours.map(h => `${h}h`).join(', '))}
                  </p>
                )}
              </section>

              <BurnoutRiskBadge sessions={historySessions} today={today} />

              <RecommendationsView
                sessions={historySessions}
                blocks={captureBlocks}
                meetingMinutesThisWeek={Math.round(
                  captureBlocks
                    .filter(b => b.tag === 'meeting')
                    .reduce((sum, b) => sum + (b.endedAt - b.startedAt), 0) / 60_000
                )}
                daysTracked={new Set(historySessions.map(s => s.date)).size}
              />
            </div>
          )}

          {/* ── ADVANCED TAB ──────────────────────────────────────── */}
          {mainTab === 'advanced' && (
            <div className="space-y-8">
              {showTAS && <TrackingAccuracyWidget tas={tas} />}
              <MakerManagerBadge blocks={captureBlocks} />
              <DistractionBudgetWidget blocks={captureBlocks} />
              <DistractionPatternWidget blocks={captureBlocks} />
              <CodeQualityView commits={gitCommits} sessions={historySessions} />
              {storage && (
                <div>
                  <h4 className="mb-2 text-xs text-zinc-600">{t('screenshot.title')}</h4>
                  <ScreenshotTimeline date={today} enabled={screenshotsEnabled} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
