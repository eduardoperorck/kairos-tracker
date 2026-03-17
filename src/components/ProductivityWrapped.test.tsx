import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ProductivityWrapped } from './ProductivityWrapped'
import type { ReactNode } from 'react'
import type { Session, Category } from '../domain/timer'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const mockOnClose = vi.fn()

function makeSession(id: string, categoryId: string, durationMs: number, date = '2026-03-17'): Session {
  const startedAt = new Date(date + 'T09:00:00Z').getTime()
  return {
    id,
    categoryId,
    startedAt,
    endedAt: startedAt + durationMs,
    date,
  }
}

function makeCategory(id: string, name: string): Category {
  return {
    id,
    name,
    activeEntry: null,
    weeklyGoalMs: undefined,
    color: undefined,
  }
}

describe('ProductivityWrapped', () => {
  it('renders "not enough data" with empty sessions', () => {
    renderWithI18n(
      <ProductivityWrapped sessions={[]} categories={[]} onClose={mockOnClose} />
    )
    expect(screen.getByText(/not enough data/i)).toBeTruthy()
  })

  it('shows close button when no data', () => {
    renderWithI18n(
      <ProductivityWrapped sessions={[]} categories={[]} onClose={mockOnClose} />
    )
    // The close button should be visible
    expect(screen.getByText('✕')).toBeTruthy()
  })

  it('shows first slide correctly with data', () => {
    const sessions = [
      makeSession('s1', 'cat-1', 60 * 60_000, '2026-03-17'),
      makeSession('s2', 'cat-1', 45 * 60_000, '2026-03-16'),
      makeSession('s3', 'cat-2', 30 * 60_000, '2026-03-15'),
    ]
    const categories = [
      makeCategory('cat-1', 'Work'),
      makeCategory('cat-2', 'Study'),
    ]

    renderWithI18n(
      <ProductivityWrapped sessions={sessions} categories={categories} onClose={mockOnClose} />
    )

    // First slide should show total time tracked
    expect(screen.getByText(/this month you tracked/i)).toBeTruthy()
  })

  it('Next button advances to slide 2', () => {
    const sessions = [
      makeSession('s1', 'cat-1', 60 * 60_000, '2026-03-17'),
      makeSession('s2', 'cat-1', 45 * 60_000, '2026-03-16'),
      makeSession('s3', 'cat-2', 30 * 60_000, '2026-03-15'),
    ]
    const categories = [
      makeCategory('cat-1', 'Work'),
      makeCategory('cat-2', 'Study'),
    ]

    renderWithI18n(
      <ProductivityWrapped sessions={sessions} categories={categories} onClose={mockOnClose} />
    )

    const nextBtn = screen.getByText('Next →')
    fireEvent.click(nextBtn)

    // After clicking next, we should no longer be on slide 1's label
    // Slide 2 shows dominant category
    expect(screen.getByText(/your dominant category was/i)).toBeTruthy()
  })

  it('last slide shows Done button', () => {
    // Create sessions that produce exactly 1 slide (no dominant category, no flow, etc.)
    // We need to navigate to the last slide
    const sessions = [
      makeSession('s1', 'cat-1', 60 * 60_000, '2026-03-17'),
      makeSession('s2', 'cat-1', 45 * 60_000, '2026-03-16'),
      makeSession('s3', 'cat-2', 30 * 60_000, '2026-03-15'),
    ]
    const categories = [
      makeCategory('cat-1', 'Work'),
      makeCategory('cat-2', 'Study'),
    ]

    renderWithI18n(
      <ProductivityWrapped sessions={sessions} categories={categories} onClose={mockOnClose} />
    )

    // Click Next until we reach the last slide
    let nextBtn = screen.queryByText('Next →')
    while (nextBtn) {
      fireEvent.click(nextBtn)
      nextBtn = screen.queryByText('Next →')
    }

    // Last slide should have Done button
    expect(screen.getByText('Done')).toBeTruthy()
  })
})
