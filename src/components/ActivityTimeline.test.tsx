import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ActivityTimeline } from './ActivityTimeline'
import type { CaptureBlock } from '../domain/passiveCapture'
import type { Category } from '../domain/timer'
import type { ReactNode } from 'react'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const categories: Category[] = [
  { id: 'c1', name: 'Work', activeEntry: null, color: '#6366f1' },
  { id: 'c2', name: 'Study', activeEntry: null },
]

function makeBlock(overrides: Partial<CaptureBlock> & { startedAt: number; endedAt: number }): CaptureBlock {
  return {
    process: 'Code.exe',
    title: 'project — VS Code',
    categoryId: 'c1',
    confirmed: true,
    ...overrides,
  }
}

const base = new Date('2026-03-15T09:00:00Z').getTime()

describe('ActivityTimeline — empty state', () => {
  it('shows empty message when no blocks', () => {
    renderWithI18n(<ActivityTimeline blocks={[]} categories={categories} />)
    expect(screen.getByText(/no capture data/i)).toBeTruthy()
  })
})

describe('ActivityTimeline — with blocks', () => {
  it('renders process name', () => {
    const block = makeBlock({ startedAt: base, endedAt: base + 30 * 60_000 })
    renderWithI18n(<ActivityTimeline blocks={[block]} categories={categories} />)
    expect(screen.getByText('Code.exe')).toBeTruthy()
  })

  it('renders category name', () => {
    const block = makeBlock({ startedAt: base, endedAt: base + 30 * 60_000 })
    renderWithI18n(<ActivityTimeline blocks={[block]} categories={categories} />)
    expect(screen.getByText('Work')).toBeTruthy()
  })

  it('shows ⚡ flow badge for blocks ≥ 45 min', () => {
    const block = makeBlock({ startedAt: base, endedAt: base + 50 * 60_000 })
    renderWithI18n(<ActivityTimeline blocks={[block]} categories={categories} />)
    expect(screen.getByText('⚡')).toBeTruthy()
  })

  it('does not show flow badge for blocks < 45 min', () => {
    const block = makeBlock({ startedAt: base, endedAt: base + 30 * 60_000 })
    renderWithI18n(<ActivityTimeline blocks={[block]} categories={categories} />)
    expect(screen.queryByText('⚡')).toBeNull()
  })

  it('shows formatted time labels', () => {
    const block = makeBlock({ startedAt: base, endedAt: base + 2 * 60 * 60_000 })
    const { container } = renderWithI18n(<ActivityTimeline blocks={[block]} categories={categories} />)
    // Time labels should appear in the timeline
    expect(container.textContent).toContain('09:')
  })

  it('renders multiple blocks', () => {
    const b1 = makeBlock({ startedAt: base, endedAt: base + 30 * 60_000, process: 'Code.exe' })
    const b2 = makeBlock({ startedAt: base + 60 * 60_000, endedAt: base + 90 * 60_000, process: 'chrome.exe', categoryId: 'c2' })
    renderWithI18n(<ActivityTimeline blocks={[b1, b2]} categories={categories} />)
    expect(screen.getByText('Code.exe')).toBeTruthy()
    expect(screen.getByText('chrome.exe')).toBeTruthy()
  })

  it('shows untracked gap between blocks', () => {
    const b1 = makeBlock({ startedAt: base, endedAt: base + 30 * 60_000 })
    const b2 = makeBlock({ startedAt: base + 90 * 60_000, endedAt: base + 120 * 60_000 })
    renderWithI18n(<ActivityTimeline blocks={[b1, b2]} categories={categories} />)
    expect(screen.getByText(/untracked/i)).toBeTruthy()
  })

  it('handles block with no matching category', () => {
    const block = makeBlock({ startedAt: base, endedAt: base + 30 * 60_000, categoryId: 'unknown' })
    // Should not crash
    renderWithI18n(<ActivityTimeline blocks={[block]} categories={categories} />)
    expect(screen.getByText('Code.exe')).toBeTruthy()
  })
})
