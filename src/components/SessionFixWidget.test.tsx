import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { SessionFixWidget } from './SessionFixWidget'
import type { Session } from '../domain/timer'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeSession(overrides: Partial<Session> = {}): Session {
  const startedAt = Date.now() - 90 * 60_000 // 90 min ago
  return {
    id: 's1',
    categoryId: 'cat-work',
    startedAt,
    endedAt: Date.now(),
    date: '2026-03-26',
    ...overrides,
  }
}

const defaultCategories = [
  { id: 'cat-work', name: 'Work' },
  { id: 'cat-meeting', name: 'Meeting' },
]

describe('SessionFixWidget', () => {
  it('renders the session duration and time range', () => {
    const session = makeSession()
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={vi.fn()}
        onEditTime={vi.fn()}
        onSplit={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText(/Edit time/i)).toBeInTheDocument()
    expect(screen.getByText(/Split/i)).toBeInTheDocument()
    expect(screen.getByText(/Confirm/i)).toBeInTheDocument()
  })

  it('calls onConfirm when Confirm button is clicked', () => {
    const onConfirm = vi.fn()
    const session = makeSession()
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={onConfirm}
        onEditTime={vi.fn()}
        onSplit={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Confirm/i))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows edit time form when "Edit time" is clicked', () => {
    const session = makeSession()
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={vi.fn()}
        onEditTime={vi.fn()}
        onSplit={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Edit time/i))
    expect(screen.getByLabelText(/Start/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/End/i)).toBeInTheDocument()
  })

  it('calls onEditTime when edit form is saved', () => {
    const onEditTime = vi.fn()
    const session = makeSession({ startedAt: new Date('2026-03-26T09:00:00').getTime(), endedAt: new Date('2026-03-26T11:00:00').getTime() })
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={vi.fn()}
        onEditTime={onEditTime}
        onSplit={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Edit time/i))
    fireEvent.click(screen.getByText(/Save/i))
    expect(onEditTime).toHaveBeenCalledWith(expect.any(Number), expect.any(Number))
  })

  it('shows split form when "Split" is clicked', () => {
    const session = makeSession()
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={vi.fn()}
        onEditTime={vi.fn()}
        onSplit={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Split/i))
    expect(screen.getByText(/was/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('calls onSplit when split form is confirmed', () => {
    const onSplit = vi.fn()
    const session = makeSession()
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={vi.fn()}
        onEditTime={vi.fn()}
        onSplit={onSplit}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Split/i))
    fireEvent.click(screen.getByText(/Apply split/i))
    expect(onSplit).toHaveBeenCalledWith(expect.any(Number), expect.any(String))
  })

  it('calls onDismiss when dismissed', () => {
    const onDismiss = vi.fn()
    const session = makeSession()
    renderWithI18n(
      <SessionFixWidget
        session={session}
        categories={defaultCategories}
        onConfirm={vi.fn()}
        onEditTime={vi.fn()}
        onSplit={vi.fn()}
        onDismiss={onDismiss}
      />
    )
    fireEvent.click(screen.getByLabelText(/dismiss/i))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
