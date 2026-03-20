import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DistractionBudgetWidget } from './DistractionBudgetWidget'
import { I18nProvider } from '../i18n'
import type { CaptureBlock } from '../domain/passiveCapture'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeBlock(title: string, durationMinutes: number): CaptureBlock {
  return {
    process: 'chrome.exe',
    title,
    startedAt: 0,
    endedAt: durationMinutes * 60_000,
    categoryId: null,
    confirmed: false,
  }
}

describe('DistractionBudgetWidget', () => {
  it('renders with no distraction time', () => {
    renderWithI18n(<DistractionBudgetWidget blocks={[]} />)
    expect(screen.getByText(/Distraction Budget/)).toBeInTheDocument()
    expect(screen.getByText(/No distraction apps/)).toBeInTheDocument()
  })

  it('shows used and budget time', () => {
    const blocks = [makeBlock('YouTube - video', 15)]
    renderWithI18n(<DistractionBudgetWidget blocks={blocks} budgetMs={30 * 60_000} />)
    expect(screen.getByText(/15m \/ 30m/)).toBeInTheDocument()
  })

  it('shows over budget message', () => {
    const blocks = [makeBlock('reddit.com', 45)]
    renderWithI18n(<DistractionBudgetWidget blocks={blocks} budgetMs={30 * 60_000} />)
    expect(screen.getByText(/Over budget/)).toBeInTheDocument()
  })

  it('renders progress bar', () => {
    renderWithI18n(<DistractionBudgetWidget blocks={[]} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows top distractors', () => {
    const blocks = [makeBlock('youtube.com', 20), makeBlock('reddit.com', 10)]
    renderWithI18n(<DistractionBudgetWidget blocks={blocks} />)
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByText('Reddit')).toBeInTheDocument()
  })
})
