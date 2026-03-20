import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const defaultProps = {
  categories: [{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'Study' }],
  activeId: null,
  onStart: vi.fn(),
  onStop: vi.fn(),
  onNavigate: vi.fn(),
  onClose: vi.fn(),
}

describe('CommandPalette', () => {
  it('renders search input', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    expect(screen.getByPlaceholderText(/command/i)).toBeInTheDocument()
  })

  it('lists start commands for each category', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    expect(screen.getByText(/Start Work/)).toBeInTheDocument()
    expect(screen.getByText(/Start Study/)).toBeInTheDocument()
  })

  it('filters commands by query', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Work' } })
    expect(screen.getByText(/Start Work/)).toBeInTheDocument()
    expect(screen.queryByText(/Start Study/)).not.toBeInTheDocument()
  })

  it('shows stop command when a timer is active', () => {
    renderWithI18n(<CommandPalette {...defaultProps} activeId="c1" />)
    expect(screen.getByText(/Stop Work/)).toBeInTheDocument()
  })

  it('calls onStart when a start command is clicked', () => {
    const onStart = vi.fn()
    renderWithI18n(<CommandPalette {...defaultProps} onStart={onStart} />)
    fireEvent.click(screen.getByText(/Start Work/))
    expect(onStart).toHaveBeenCalledWith('c1')
  })

  it('calls onStop when stop command is clicked', () => {
    const onStop = vi.fn()
    renderWithI18n(<CommandPalette {...defaultProps} activeId="c1" onStop={onStop} />)
    fireEvent.click(screen.getByText(/Stop Work/))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('calls onNavigate when a nav command is clicked', () => {
    const onNavigate = vi.fn()
    renderWithI18n(<CommandPalette {...defaultProps} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText(/Stats/))
    expect(onNavigate).toHaveBeenCalledWith('stats')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    renderWithI18n(<CommandPalette {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('CommandPalette — M73: additional commands', () => {
  it('"Log time manually" command appears when onOpenNLP is provided', () => {
    renderWithI18n(
      <CommandPalette {...defaultProps} onOpenNLP={vi.fn()} />
    )
    expect(screen.getByText('Log time manually')).toBeTruthy()
  })

  it('"Log time manually" command is absent when onOpenNLP is not provided', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    expect(screen.queryByText('Log time manually')).toBeNull()
  })

  it('clicking "Log time manually" calls onOpenNLP and then onClose', () => {
    const onOpenNLP = vi.fn()
    const onClose = vi.fn()
    renderWithI18n(
      <CommandPalette {...defaultProps} onOpenNLP={onOpenNLP} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Log time manually'))
    expect(onOpenNLP).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('"View weekly digest" command is always present', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('View weekly digest')).toBeTruthy()
  })

  it('clicking "View weekly digest" calls onNavigate with "stats"', () => {
    const onNavigate = vi.fn()
    renderWithI18n(<CommandPalette {...defaultProps} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('View weekly digest'))
    expect(onNavigate).toHaveBeenCalledWith('stats')
  })

  it('"Set today\'s goals" command is always present', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    expect(screen.getByText("Set today's goals")).toBeTruthy()
  })

  it('clicking "Set today\'s goals" calls onNavigate with "today"', () => {
    const onNavigate = vi.fn()
    renderWithI18n(<CommandPalette {...defaultProps} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText("Set today's goals"))
    expect(onNavigate).toHaveBeenCalledWith('today')
  })

  it('"View weekly digest" is found when filtering by "digest"', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'digest' } })
    expect(screen.getByText('View weekly digest')).toBeTruthy()
  })

  it('"Set today\'s goals" is found when filtering by "goals"', () => {
    renderWithI18n(<CommandPalette {...defaultProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'goals' } })
    expect(screen.getByText("Set today's goals")).toBeTruthy()
  })
})
