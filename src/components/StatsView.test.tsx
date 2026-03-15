import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsView } from './StatsView'

const stats = [
  { id: '1', name: 'Work', totalMs: 3_600_000, percentage: 75 },
  { id: '2', name: 'Study', totalMs: 1_200_000, percentage: 25 },
]

describe('StatsView', () => {
  it('renders a heading', () => {
    render(<StatsView stats={stats} onBack={() => {}} />)
    expect(screen.getByText('Statistics')).toBeInTheDocument()
  })

  it('renders each category name', () => {
    render(<StatsView stats={stats} onBack={() => {}} />)
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Study')).toBeInTheDocument()
  })

  it('renders formatted times', () => {
    render(<StatsView stats={stats} onBack={() => {}} />)
    expect(screen.getByText('60:00')).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
  })

  it('renders percentage labels', () => {
    render(<StatsView stats={stats} onBack={() => {}} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', async () => {
    let called = false
    render(<StatsView stats={stats} onBack={() => { called = true }} />)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(called).toBe(true)
  })

  it('shows empty state when no stats', () => {
    render(<StatsView stats={[]} onBack={() => {}} />)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })
})
