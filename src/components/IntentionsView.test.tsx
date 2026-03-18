import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { IntentionsView } from './IntentionsView'
import type { Intention } from '../domain/intentions'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeIntention(text: string): Intention {
  return { text, date: '2026-03-15', createdAt: Date.now() }
}

const defaultProps = {
  intentions: [],
  review: null,
  today: '2026-03-15',
  onAddIntention: vi.fn(),
  onSaveReview: vi.fn(),
}

describe('IntentionsView', () => {
  it('renders empty state', () => {
    renderWithI18n(<IntentionsView {...defaultProps} />)
    expect(screen.getByText('No intentions set yet.')).toBeInTheDocument()
  })

  it('renders existing intentions', () => {
    renderWithI18n(<IntentionsView {...defaultProps} intentions={[makeIntention('Finish report')]} />)
    expect(screen.getByText('Finish report')).toBeInTheDocument()
  })

  it('calls onAddIntention when Add is clicked', () => {
    const onAddIntention = vi.fn()
    renderWithI18n(<IntentionsView {...defaultProps} onAddIntention={onAddIntention} />)
    fireEvent.change(screen.getByPlaceholderText(/intend to accomplish/i), { target: { value: 'Write tests' } })
    fireEvent.click(screen.getByText('Add'))
    expect(onAddIntention).toHaveBeenCalledWith('Write tests')
  })

  it('clears input after adding', () => {
    renderWithI18n(<IntentionsView {...defaultProps} />)
    const input = screen.getByPlaceholderText(/intend to accomplish/i)
    fireEvent.change(input, { target: { value: 'Write tests' } })
    fireEvent.click(screen.getByText('Add'))
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('does not call onAddIntention for empty input', () => {
    const onAddIntention = vi.fn()
    renderWithI18n(<IntentionsView {...defaultProps} onAddIntention={onAddIntention} />)
    fireEvent.click(screen.getByText('Add'))
    expect(onAddIntention).not.toHaveBeenCalled()
  })

  it('toggles intention done state', () => {
    renderWithI18n(<IntentionsView {...defaultProps} intentions={[makeIntention('Do exercise')]} />)
    const btn = screen.getByRole('button', { name: 'Mark done' })
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: 'Mark undone' })).toBeInTheDocument()
  })

  it('calls onSaveReview with selected mood and notes', () => {
    const onSaveReview = vi.fn()
    renderWithI18n(<IntentionsView {...defaultProps} onSaveReview={onSaveReview} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mood 4' }))
    fireEvent.change(screen.getByPlaceholderText(/notes about/i), { target: { value: 'Great day' } })
    fireEvent.click(screen.getByText('Save Review'))
    expect(onSaveReview).toHaveBeenCalledWith(4, 'Great day')
  })

  it('shows saved review summary', () => {
    const review = { id: 'r-1', date: '2026-03-15', mood: 5 as const, notes: '', createdAt: Date.now() }
    renderWithI18n(<IntentionsView {...defaultProps} review={review} />)
    expect(screen.getByText('Last saved: mood 5/5')).toBeInTheDocument()
  })
})
