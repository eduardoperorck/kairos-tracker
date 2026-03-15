import { useState } from 'react'
import { formatElapsed } from '../domain/format'
import { DigestView } from './DigestView'
import { computeHourDistribution, computeDayTotals, computeEnergyPattern, isFlowSession } from '../domain/history'
import { computeWeekMs, getWeekDates, toDateString } from '../domain/timer'
import type { StatEntry } from '../domain/stats'
import type { Session, Category } from '../domain/timer'

type WeeklyEntry = {
  id: string
  weeklyMs: number
  weeklyGoalMs?: number
}

import type { Storage } from '../persistence/storage'

type Props = {
  stats: StatEntry[]
  weeklyData: WeeklyEntry[]
  streaks: Record<string, number>
  onBack: () => void
  historySessions?: Session[]
  categories?: Category[]
  storage?: Storage
}

function offsetDate(today: string, offsetWeeks: number): string {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(weekDates: string[]): string {
  if (weekDates.length === 0) return ''
  const start = weekDates[0]
  const end = weekDates[6]
  return `${start.slice(5)} – ${end.slice(5)}`
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

export function StatsView({ stats, weeklyData, streaks, onBack, historySessions = [], categories = [], storage }: Props) {
  const [period, setPeriod] = useState<'today' | 'week' | 'patterns'>('today')
  const [weekOffset, setWeekOffset] = useState(0)

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

  const isEmpty = period === 'today'
    ? stats.length === 0
    : period === 'week'
    ? weeklyStats.every(e => e.weeklyMs === 0)
    : historySessions.length === 0

  // Patterns data
  const hourDist = computeHourDistribution(historySessions)
  const maxHourMs = hourDist.length > 0 ? Math.max(...hourDist.map(h => h.totalMs)) : 1
  const energy = computeEnergyPattern(historySessions, 60)

  // Heatmap: 13 weeks × 7 days
  const since91 = toDateString(Date.now() - 91 * 86_400_000)
  const dayTotals = computeDayTotals(historySessions, categories, since91)
  const dayTotalMap = new Map(dayTotals.map(d => [d.date, d.totalMs]))

  // Flow sessions per category for weekly view
  const weekFlowMap = new Map<string, number>()
  for (const s of historySessions.filter(s => selectedWeekDates.includes(s.date))) {
    if (isFlowSession(s)) {
      weekFlowMap.set(s.categoryId, (weekFlowMap.get(s.categoryId) ?? 0) + 1)
    }
  }

  return (
    <div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            aria-label="Back"
            onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ← Back
          </button>
          <span className="text-zinc-700">·</span>
          <h2 className="text-sm font-semibold text-zinc-200">Statistics</h2>
        </div>

        {/* Period toggle */}
        <div className="flex rounded-md border border-white/[0.07] overflow-hidden">
          <button
            aria-label="Today"
            onClick={() => setPeriod('today')}
            className={`px-3 py-1 text-xs transition-colors ${
              period === 'today'
                ? 'bg-white/[0.08] text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Today
          </button>
          <button
            aria-label="This week"
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 text-xs border-l border-white/[0.07] transition-colors ${
              period === 'week'
                ? 'bg-white/[0.08] text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            This week
          </button>
          <button
            aria-label="Patterns"
            onClick={() => setPeriod('patterns')}
            className={`px-3 py-1 text-xs border-l border-white/[0.07] transition-colors ${
              period === 'patterns'
                ? 'bg-white/[0.08] text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Patterns
          </button>
        </div>
      </div>

      {/* Week selector (only for week view) */}
      {period === 'week' && (
        <div className="mb-4 flex items-center justify-center gap-4">
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={() => setWeekOffset(o => o - 1)}
          >
            ← prev
          </button>
          <span className="text-xs text-zinc-400">week of {formatWeekLabel(selectedWeekDates)}</span>
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
            onClick={() => setWeekOffset(o => o + 1)}
            disabled={weekOffset >= 0}
          >
            next →
          </button>
        </div>
      )}

      {isEmpty ? (
        <p className="mt-16 text-center text-sm text-zinc-700">No data yet.</p>
      ) : period === 'today' ? (

        /* Today view */
        <ul className="space-y-6">
          {stats.map(entry => (
            <li key={entry.id}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-200">{entry.name}</span>
                  {(streaks[entry.id] ?? 0) > 0 && (
                    <span className="text-xs text-zinc-600 tabular-nums">
                      {streaks[entry.id]}d streak
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm tabular-nums text-zinc-400">
                    {formatElapsed(entry.totalMs)}
                  </span>
                  <span className="text-xs text-zinc-600 w-8 text-right tabular-nums">
                    {entry.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full bg-zinc-600 transition-all"
                  style={{ width: `${entry.percentage}%` }}
                />
              </div>
            </li>
          ))}
        </ul>

      ) : period === 'week' ? (

        /* This week view */
        <>
        <ul className="space-y-6">
          {weeklyStats.map(entry => {
            const goalMs = entry.weeklyGoalMs ?? 0
            const goalPct = goalMs > 0 ? Math.min(Math.round((entry.weeklyMs / goalMs) * 100), 100) : 0
            const hasGoal = goalMs > 0
            const flowCount = weekFlowMap.get(entry.id) ?? 0

            return (
              <li key={entry.id}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-200">{entry.name}</span>
                    {(streaks[entry.id] ?? 0) > 0 && (
                      <span className="text-xs text-zinc-600 tabular-nums">
                        {streaks[entry.id]}d streak
                      </span>
                    )}
                    {flowCount > 0 && (
                      <span className="text-xs text-amber-500/70 tabular-nums">
                        {flowCount} flow
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm tabular-nums text-zinc-400">
                      {formatElapsed(entry.weeklyMs)}
                      {hasGoal && (
                        <span className="text-zinc-700"> / {formatElapsed(goalMs)}</span>
                      )}
                    </span>
                    <span className={`text-xs w-8 text-right tabular-nums ${
                      hasGoal
                        ? goalPct >= 100 ? 'text-emerald-400' : 'text-zinc-500'
                        : 'text-zinc-600'
                    }`}>
                      {hasGoal ? `${goalPct}%` : `${entry.weeklyPercentage}%`}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      hasGoal
                        ? goalPct >= 100 ? 'bg-emerald-500' : 'bg-emerald-500/50'
                        : 'bg-zinc-600'
                    }`}
                    style={{ width: `${hasGoal ? goalPct : entry.weeklyPercentage}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {storage && (
          <DigestView
            categories={categories}
            sessions={historySessions.filter(s => selectedWeekDates.includes(s.date))}
            historySessions={historySessions}
            today={offsetDate(today, weekOffset)}
            storage={storage}
          />
        )}
        </>

      ) : (

        /* Patterns view */
        <div className="space-y-8">

          {/* Hour distribution chart */}
          <div>
            <h3 className="mb-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Hour Distribution</h3>
            <div className="space-y-2">
              {hourDist.sort((a, b) => b.totalMs - a.totalMs).map(slot => (
                <div key={slot.hour} className="flex items-center gap-3">
                  <span className="w-6 text-xs text-zinc-600 tabular-nums text-right">{slot.hour}h</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/60 transition-all"
                      style={{ width: `${Math.round((slot.totalMs / maxHourMs) * 100)}%` }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-xs text-zinc-600">{formatElapsed(slot.totalMs)}</span>
                </div>
              ))}
            </div>
            {energy.insight && (
              <p className="mt-3 text-xs text-zinc-600 italic">{energy.insight}</p>
            )}
          </div>

          {/* Heatmap */}
          <div>
            <h3 className="mb-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Activity Heatmap (13 weeks)</h3>
            <div className="flex gap-1">
              {/* Day labels */}
              <div className="flex flex-col gap-1 mr-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                  <div key={d} className="h-3 text-[10px] text-zinc-700 leading-3">{d}</div>
                ))}
              </div>
              {/* 13 weeks of columns */}
              {Array.from({ length: 13 }, (_, weekIdx) => {
                const weekStart = new Date(Date.now() - (12 - weekIdx) * 7 * 86_400_000)
                // Align to Monday
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
                      return (
                        <div
                          key={dayIdx}
                          title={`${dateStr}: ${formatElapsed(total)}`}
                          className={`w-3 h-3 rounded-sm ${heatColor(total)}`}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
