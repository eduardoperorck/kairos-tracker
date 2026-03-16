import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CategoryItem } from './CategoryItem'
import type { Category } from '../domain/timer'

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
    render(<CategoryItem category={makeCategory()} {...defaultProps} />)
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('shows Start button when timer is not running', () => {
    render(<CategoryItem category={makeCategory()} {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('shows Stop button when timer is running', () => {
    const category = makeCategory({ activeEntry: { startedAt: Date.now() } })
    render(<CategoryItem category={category} {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('calls onStart when Start is clicked', () => {
    const onStart = vi.fn()
    render(<CategoryItem category={makeCategory()} {...defaultProps} onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('calls onStop when Stop is clicked', () => {
    const onStop = vi.fn()
    const category = makeCategory({ activeEntry: { startedAt: Date.now() } })
    render(<CategoryItem category={category} {...defaultProps} onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('shows delete confirm flow', () => {
    render(<CategoryItem category={makeCategory()} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onDelete after confirming delete', () => {
    const onDelete = vi.fn()
    render(<CategoryItem category={makeCategory()} {...defaultProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByText('Confirm'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('cancels delete when Cancel is clicked', () => {
    render(<CategoryItem category={makeCategory()} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('shows tag picker when running and + tag is clicked', () => {
    const category = makeCategory({ activeEntry: { startedAt: Date.now() } })
    render(<CategoryItem category={category} {...defaultProps} />)
    fireEvent.click(screen.getByText('+ tag'))
    expect(screen.getByText('deep work')).toBeInTheDocument()
    expect(screen.getByText('meeting')).toBeInTheDocument()
  })

  it('passes selected tag to onStop', () => {
    const onStop = vi.fn()
    const category = makeCategory({ activeEntry: { startedAt: Date.now() } })
    render(<CategoryItem category={category} {...defaultProps} onStop={onStop} />)
    fireEvent.click(screen.getByText('+ tag'))
    fireEvent.click(screen.getByText('deep work'))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalledWith('deep work')
  })

  it('shows accumulated time', () => {
    const category = makeCategory({ accumulatedMs: 3_661_000 }) // 61 min 1 sec → 61:01
    render(<CategoryItem category={category} {...defaultProps} />)
    expect(screen.getByText('61:01')).toBeInTheDocument()
  })
})
