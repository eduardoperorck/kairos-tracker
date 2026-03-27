import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { IntentionsView } from './IntentionsView'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const defaultProps = {
  review: null,
  today: '2026-03-15',
  onSaveReview: vi.fn(),
}

describe('IntentionsView', () => {
  it('calls onSaveReview with undefined mood and notes', () => {
    // Mock time to be after 5pm so the evening review section is visible
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T18:00:00'))
    const onSaveReview = vi.fn()
    renderWithI18n(<IntentionsView {...defaultProps} onSaveReview={onSaveReview} />)
    fireEvent.change(screen.getByPlaceholderText(/notes about/i), { target: { value: 'Great day' } })
    fireEvent.click(screen.getByText('Save Review'))
    expect(onSaveReview).toHaveBeenCalledWith(undefined, 'Great day')
    vi.useRealTimers()
  })

  it('shows saved review summary', () => {
    const review = { id: 'r-1', date: '2026-03-15', mood: 5 as const, notes: '', createdAt: Date.now() }
    renderWithI18n(<IntentionsView {...defaultProps} review={review} />)
    expect(screen.getByText(/last saved/i)).toBeInTheDocument()
  })

  it('renders MVD widget when onMVDChange is provided', () => {
    const mvdItems = [{ id: 'm1', text: 'Write tests', done: false, createdAt: Date.now() }]
    renderWithI18n(
      <IntentionsView {...defaultProps} mvdItems={mvdItems} onMVDChange={vi.fn()} />
    )
    expect(screen.getByText('Write tests')).toBeInTheDocument()
  })

  it('does not render MVD widget when onMVDChange is not provided', () => {
    renderWithI18n(<IntentionsView {...defaultProps} />)
    // No MVD-specific content should appear
    expect(screen.queryByText(/today's focus/i)).not.toBeInTheDocument()
  })
})
