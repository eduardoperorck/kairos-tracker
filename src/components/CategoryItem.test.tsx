import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CategoryItem } from './CategoryItem'
import { I18nProvider } from '../i18n'
import type { Category } from '../domain/timer'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

type StoredCategory = Category & { accumulatedMs: number; pendingTag?: string }

function makeCategory(overrides: Partial<StoredCategory> = {}): StoredCategory {
  return {
    id: 'cat-1',
    name: 'Work',
    accumulatedMs: 0,
    activeEntry: null,
    ...overrides,
  }
}

const defaultProps = {
  weeklyMs: 0,
  lastTracked: null,
  onStart: vi.fn(),
  onStop: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  onSetGoal: vi.fn(),
}

describe('CategoryItem', () => {
  it('renders category name', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} />)
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('shows Start button when timer is not running', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('shows Stop button when timer is running', () => {
    const category = makeCategory({ activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(<CategoryItem category={category} {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('calls onStart when Start is clicked', () => {
    const onStart = vi.fn()
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('calls onStop when Stop is clicked', () => {
    const onStop = vi.fn()
    const category = makeCategory({ activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(<CategoryItem category={category} {...defaultProps} onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('shows delete confirm flow', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onDelete after confirming delete', () => {
    const onDelete = vi.fn()
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByText('Confirm'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('cancels delete when Cancel is clicked', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('shows tag picker when running and + tag is clicked', () => {
    const category = makeCategory({ activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(<CategoryItem category={category} {...defaultProps} />)
    fireEvent.click(screen.getByText('+ tag'))
    expect(screen.getByText('deep work')).toBeInTheDocument()
    expect(screen.getByText('meeting')).toBeInTheDocument()
  })

  it('passes selected tag to onStop', () => {
    const onStop = vi.fn()
    const category = makeCategory({ activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(<CategoryItem category={category} {...defaultProps} onStop={onStop} />)
    fireEvent.click(screen.getByText('+ tag'))
    fireEvent.click(screen.getByText('deep work'))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledWith('deep work')
  })

  it('shows accumulated time', () => {
    const category = makeCategory({ accumulatedMs: 3_661_000 }) // 61 min 1 sec → 61:01
    renderWithI18n(<CategoryItem category={category} {...defaultProps} />)
    expect(screen.getByText('61:01')).toBeInTheDocument()
  })

  it('shows last tracked text when lastTracked is provided and timer is stopped', () => {
    const twoHoursAgo = Date.now() - 2 * 3_600_000
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} lastTracked={twoHoursAgo} />)
    expect(screen.getByText(/last tracked 2h ago/i)).toBeInTheDocument()
  })

  it('hides last tracked text when timer is running', () => {
    const twoHoursAgo = Date.now() - 2 * 3_600_000
    const category = makeCategory({ activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(<CategoryItem category={category} {...defaultProps} lastTracked={twoHoursAgo} />)
    expect(screen.queryByText(/last tracked/i)).not.toBeInTheDocument()
  })

  it('hides last tracked text when lastTracked is null', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} lastTracked={null} />)
    expect(screen.queryByText(/last tracked/i)).not.toBeInTheDocument()
  })

  it('shows streak when insights provided', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} insights={{ streak: 5, flowCount: 0, peakHour: null }} />)
    expect(screen.getByText(/5d streak/)).toBeInTheDocument()
  })

  it('shows flow count when greater than zero', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} insights={{ streak: 0, flowCount: 3, peakHour: null }} />)
    expect(screen.getByText(/3 flow/)).toBeInTheDocument()
  })

  it('shows peak hour when provided', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} insights={{ streak: 0, flowCount: 0, peakHour: 10 }} />)
    expect(screen.getByText(/peak: 10h/)).toBeInTheDocument()
  })

  it('hides insights row when not provided', () => {
    renderWithI18n(<CategoryItem category={makeCategory()} {...defaultProps} />)
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument()
  })
})
