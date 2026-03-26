import { useI18n } from '../i18n'
import { formatElapsed } from '../domain/format'
import type { DailyInsights } from '../domain/dailyInsights'
import type { Category } from '../domain/timer'

type Props = {
  insights: DailyInsights
  categories: Category[]
}

export function DailyInsightCard({ insights, categories }: Props) {
  const { t } = useI18n()
  const { todayMs, averageDailyMs, aboveAverage, topStreak, peakHoursLabel } = insights

  if (todayMs === 0 && !topStreak && !peakHoursLabel) return null

  const streakCategory = topStreak
    ? categories.find(c => c.id === topStreak.categoryId)?.name ?? topStreak.categoryId
    : null

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 space-y-3 mb-6">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-600">{t('insights.title')}</p>

      {todayMs > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">📊</span>
          <p className="text-sm text-zinc-300">
            {t('insights.focusToday').replace('{time}', formatElapsed(todayMs))}
            {averageDailyMs > 0 && (
              <span className={`ml-1 text-xs ${aboveAverage ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {aboveAverage ? t('insights.aboveAverage') : t('insights.belowAverage')}
              </span>
            )}
          </p>
        </div>
      )}

      {topStreak && topStreak.days >= 2 && (
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">🔥</span>
          <p className="text-sm text-zinc-300">
            {t('insights.streak')
              .replace('{days}', String(topStreak.days))
              .replace('{name}', streakCategory ?? '')}
          </p>
        </div>
      )}

      {peakHoursLabel && (
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">⚡</span>
          <p className="text-sm text-zinc-300">
            {t('insights.peakHours').replace('{hours}', peakHoursLabel)}
          </p>
        </div>
      )}
    </div>
  )
}
