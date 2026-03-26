import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { DailyInsightCard } from './DailyInsightCard'
import type { DailyInsights } from '../domain/dailyInsights'

function renderCard(insights: DailyInsights, categories = [{ id: 'cat-work', name: 'Work' }]) {
  return render(
    <I18nProvider>
      <DailyInsightCard insights={insights} categories={categories} />
    </I18nProvider>
  )
}

const BASE: DailyInsights = {
  todayMs: 0,
  averageDailyMs: 0,
  aboveAverage: false,
  topStreak: null,
  peakHoursLabel: null,
}

describe('DailyInsightCard', () => {
  it('renders nothing when todayMs is 0 and no streak', () => {
    const { container } = renderCard(BASE)
    expect(container.firstChild).toBeNull()
  })

  it('shows focus today text when todayMs > 0', () => {
    renderCard({ ...BASE, todayMs: 2 * 3_600_000 })
    expect(screen.getByText(/you focused/i)).toBeInTheDocument()
  })

  it('shows above average label when aboveAverage is true', () => {
    renderCard({ ...BASE, todayMs: 3_600_000, averageDailyMs: 1_000_000, aboveAverage: true })
    expect(screen.getByText(/above your average/i)).toBeInTheDocument()
  })

  it('shows below average label when aboveAverage is false and averageDailyMs > 0', () => {
    renderCard({ ...BASE, todayMs: 1_000_000, averageDailyMs: 3_600_000, aboveAverage: false })
    expect(screen.getByText(/below your average/i)).toBeInTheDocument()
  })

  it('shows streak when topStreak days >= 2', () => {
    renderCard({ ...BASE, todayMs: 1_000_000, topStreak: { categoryId: 'cat-work', days: 5 } })
    expect(screen.getByText(/5-day streak in Work/i)).toBeInTheDocument()
  })

  it('does not show streak when topStreak days < 2', () => {
    renderCard({ ...BASE, todayMs: 1_000_000, topStreak: { categoryId: 'cat-work', days: 1 } })
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument()
  })

  it('shows peak hours when peakHoursLabel is provided', () => {
    renderCard({ ...BASE, todayMs: 1_000_000, peakHoursLabel: '9am–11am' })
    expect(screen.getByText(/9am–11am/i)).toBeInTheDocument()
  })

  it('renders nothing when todayMs is 0, no streak and no peak hours', () => {
    const { container } = renderCard({ ...BASE })
    expect(container.firstChild).toBeNull()
  })
})
