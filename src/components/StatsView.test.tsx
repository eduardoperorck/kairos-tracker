import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsView } from './StatsView'

const stats = [
  { id: '1', name: 'Work', totalMs: 3_600_000, percentage: 75 },
  { id: '2', name: 'Study', totalMs: 1_200_000, percentage: 25 },
]

const weeklyData = [
  { id: '1', weeklyMs: 10_800_000, weeklyGoalMs: 18_000_000 },
  { id: '2', weeklyMs: 3_600_000 },
]

function renderStats() {
  return render(<StatsView stats={stats} weeklyData={weeklyData} streaks={{}} onBack={() => {}} />)
}

describe('StatsView', () => {
  it('renders a heading', () => {
    renderStats()
    expect(screen.getByText('Statistics')).toBeInTheDocument()
  })

  it('renders each category name', () => {
    renderStats()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Study')).toBeInTheDocument()
  })

  it('renders formatted times', () => {
    renderStats()
    expect(screen.getByText('60:00')).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
  })

  it('renders percentage labels', () => {
    renderStats()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', async () => {
    let called = false
    render(<StatsView stats={stats} weeklyData={weeklyData} streaks={{}} onBack={() => { called = true }} />)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(called).toBe(true)
  })

  it('shows empty state when no stats', () => {
    render(<StatsView stats={[]} weeklyData={[]} streaks={{}} onBack={() => {}} />)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })

  it('shows Today and This week tab buttons', () => {
    renderStats()
    expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /this week/i })).toBeInTheDocument()
  })

  it('defaults to Today view showing today totals', () => {
    renderStats()
    // 3_600_000ms = 60:00
    expect(screen.getByText('60:00')).toBeInTheDocument()
  })

  it('switching to This week shows weekly totals', async () => {
    renderStats()
    await userEvent.click(screen.getByRole('button', { name: /this week/i }))
    // 10_800_000ms = 180:00
    expect(screen.getByText('180:00')).toBeInTheDocument()
  })

  it('weekly view shows goal progress bar when goal is set', async () => {
    renderStats()
    await userEvent.click(screen.getByRole('button', { name: /this week/i }))
    // 10_800_000 / 18_000_000 = 60%
    expect(screen.getByText('60%')).toBeInTheDocument()
  })
})
