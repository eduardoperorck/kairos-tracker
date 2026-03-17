import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FocusGuard } from './FocusGuard'
import type { FocusPreset } from '../domain/focusGuard'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const preset: FocusPreset = { name: 'Pomodoro', workMs: 25 * 60_000, breakMs: 5 * 60_000 }

const defaultProps = {
  activeCategory: 'Work',
  startedAt: Date.now() - 26 * 60_000,
  preset,
  allowPostpone: true,
  onBreakComplete: vi.fn(),
  onPostpone: vi.fn(),
  onBreakSkipped: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FocusGuard', () => {
  it('renders break overlay with category name', () => {
    renderWithI18n(<FocusGuard {...defaultProps} />)
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText(/Pomodoro · Break time/i)).toBeInTheDocument()
  })

  it('shows countdown timer', () => {
    renderWithI18n(<FocusGuard {...defaultProps} />)
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument()
  })

  it('shows focused time earned message', () => {
    renderWithI18n(<FocusGuard {...defaultProps} />)
    expect(screen.getByText(/you earned this/i)).toBeInTheDocument()
  })

  it('shows Skip / Postpone button when allowPostpone is true', () => {
    renderWithI18n(<FocusGuard {...defaultProps} />)
    expect(screen.getByText('Skip / Postpone')).toBeInTheDocument()
  })

  it('shows Postpone 5 min option after clicking Skip / Postpone', () => {
    renderWithI18n(<FocusGuard {...defaultProps} />)
    fireEvent.click(screen.getByText('Skip / Postpone'))
    expect(screen.getByText('Postpone 5 min')).toBeInTheDocument()
    expect(screen.getByText('Skip anyway')).toBeInTheDocument()
  })

  it('calls onPostpone when Postpone 5 min is clicked', () => {
    const onPostpone = vi.fn()
    renderWithI18n(<FocusGuard {...defaultProps} onPostpone={onPostpone} />)
    fireEvent.click(screen.getByText('Skip / Postpone'))
    fireEvent.click(screen.getByText('Postpone 5 min'))
    expect(onPostpone).toHaveBeenCalledOnce()
  })

  it('shows SKIP typing confirmation when allowPostpone is false', () => {
    renderWithI18n(<FocusGuard {...defaultProps} allowPostpone={false} />)
    fireEvent.click(screen.getByText('Skip break'))
    expect(screen.getByPlaceholderText('SKIP')).toBeInTheDocument()
  })

  it('calls onBreakSkipped and onBreakComplete when SKIP is typed and confirmed', () => {
    const onBreakSkipped = vi.fn()
    const onBreakComplete = vi.fn()
    renderWithI18n(<FocusGuard {...defaultProps} allowPostpone={false} onBreakSkipped={onBreakSkipped} onBreakComplete={onBreakComplete} />)
    fireEvent.click(screen.getByText('Skip break'))
    fireEvent.change(screen.getByPlaceholderText('SKIP'), { target: { value: 'SKIP' } })
    fireEvent.click(screen.getByText('Confirm skip'))
    expect(onBreakSkipped).toHaveBeenCalledOnce()
    expect(onBreakComplete).toHaveBeenCalledOnce()
  })

  it('confirm skip button is disabled until SKIP is typed', () => {
    renderWithI18n(<FocusGuard {...defaultProps} allowPostpone={false} />)
    fireEvent.click(screen.getByText('Skip break'))
    const btn = screen.getByText('Confirm skip')
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('SKIP'), { target: { value: 'SKIP' } })
    expect(btn).not.toBeDisabled()
  })

  it('shows strict mode message and no skip button in strict mode', () => {
    renderWithI18n(<FocusGuard {...defaultProps} strictMode />)
    expect(screen.getByText(/strict mode/i)).toBeInTheDocument()
    expect(screen.queryByText('Skip / Postpone')).not.toBeInTheDocument()
  })

  it('calls onBreakComplete when break timer reaches zero', async () => {
    const onBreakComplete = vi.fn()
    const shortPreset: FocusPreset = { name: 'Test', workMs: 1000, breakMs: 100 }
    vi.useFakeTimers()
    renderWithI18n(<FocusGuard {...defaultProps} preset={shortPreset} onBreakComplete={onBreakComplete} />)
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(onBreakComplete).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
