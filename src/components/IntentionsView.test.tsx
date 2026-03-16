import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { IntentionsView } from './IntentionsView'
import type { Intention } from '../domain/intentions'

function makeIntention(text: string, idx = 0): Intention {
  return { id: `i-${idx}`, text, date: '2026-03-15', createdAt: Date.now() }
}

const defaultProps = {
  intentions: [],
  review: null,
  onAddIntention: vi.fn(),
  onSaveReview: vi.fn(),
}

describe('IntentionsView', () => {
  it('renders empty state', () => {
    render(<IntentionsView {...defaultProps} />)
    expect(screen.getByText('No intentions set yet.')).toBeInTheDocument()
  })

  it('renders existing intentions', () => {
    render(<IntentionsView {...defaultProps} intentions={[makeIntention('Finish report')]} />)
    expect(screen.getByText('Finish report')).toBeInTheDocument()
  })

  it('calls onAddIntention when Add is clicked', () => {
    const onAddIntention = vi.fn()
    render(<IntentionsView {...defaultProps} onAddIntention={onAddIntention} />)
    fireEvent.change(screen.getByPlaceholderText(/intend to accomplish/i), { target: { value: 'Write tests' } })
    fireEvent.click(screen.getByText('Add'))
    expect(onAddIntention).toHaveBeenCalledWith('Write tests')
  })

  it('clears input after adding', () => {
    render(<IntentionsView {...defaultProps} />)
    const input = screen.getByPlaceholderText(/intend to accomplish/i)
    fireEvent.change(input, { target: { value: 'Write tests' } })
    fireEvent.click(screen.getByText('Add'))
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('does not call onAddIntention for empty input', () => {
    const onAddIntention = vi.fn()
    render(<IntentionsView {...defaultProps} onAddIntention={onAddIntention} />)
    fireEvent.click(screen.getByText('Add'))
    expect(onAddIntention).not.toHaveBeenCalled()
  })

  it('toggles intention done state', () => {
    render(<IntentionsView {...defaultProps} intentions={[makeIntention('Do exercise')]} />)
    const btn = screen.getByRole('button', { name: 'Mark done' })
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: 'Mark undone' })).toBeInTheDocument()
  })

  it('calls onSaveReview with selected mood and notes', () => {
    const onSaveReview = vi.fn()
    render(<IntentionsView {...defaultProps} onSaveReview={onSaveReview} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mood 4' }))
    fireEvent.change(screen.getByPlaceholderText(/notes about/i), { target: { value: 'Great day' } })
    fireEvent.click(screen.getByText('Save Review'))
    expect(onSaveReview).toHaveBeenCalledWith(4, 'Great day')
  })

  it('shows saved review summary', () => {
    const review = { id: 'r-1', date: '2026-03-15', mood: 5 as const, notes: '', createdAt: Date.now() }
    render(<IntentionsView {...defaultProps} review={review} />)
    expect(screen.getByText('Last saved: mood 5/5')).toBeInTheDocument()
  })
})
