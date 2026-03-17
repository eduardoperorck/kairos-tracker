import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MVDWidget } from './MVDWidget'
import type { MVDItem } from '../domain/minimumViableDay'

describe('MVDWidget', () => {
  it('renders add input when empty', () => {
    render(<MVDWidget items={[]} onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/Must-do 1 of 3/)).toBeInTheDocument()
  })

  it('calls onChange with new item on add', () => {
    const onChange = vi.fn()
    render(<MVDWidget items={[]} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Write tests' } })
    fireEvent.click(screen.getByText('Add'))
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ text: 'Write tests' })])
    )
  })

  it('renders existing items', () => {
    const items: MVDItem[] = [{ id: '1', text: 'Ship feature', done: false, createdAt: 0 }]
    render(<MVDWidget items={items} onChange={() => {}} />)
    expect(screen.getByText('Ship feature')).toBeInTheDocument()
  })

  it('toggles item done on checkbox click', () => {
    const items: MVDItem[] = [{ id: '1', text: 'Task A', done: false, createdAt: 0 }]
    const onChange = vi.fn()
    render(<MVDWidget items={items} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /mark done/i }))
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ done: true })])
    )
  })

  it('shows achieved badge when all items done', () => {
    const items: MVDItem[] = [{ id: '1', text: 'Done', done: true, createdAt: 0 }]
    render(<MVDWidget items={items} onChange={() => {}} />)
    expect(screen.getByText(/Achieved/)).toBeInTheDocument()
  })

  it('hides add input at max items', () => {
    const items: MVDItem[] = [
      { id: '1', text: 'A', done: false, createdAt: 0 },
      { id: '2', text: 'B', done: false, createdAt: 0 },
      { id: '3', text: 'C', done: false, createdAt: 0 },
    ]
    render(<MVDWidget items={items} onChange={() => {}} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText(/Max 3/)).toBeInTheDocument()
  })
})
