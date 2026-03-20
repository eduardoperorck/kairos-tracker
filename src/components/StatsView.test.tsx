import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsView } from './StatsView'
import { I18nProvider } from '../i18n'

const stats = [
  { id: '1', name: 'Work', totalMs: 3_600_000, percentage: 75 },
  { id: '2', name: 'Study', totalMs: 1_200_000, percentage: 25 },
]

const weeklyData = [
  { id: '1', weeklyMs: 10_800_000, weeklyGoalMs: 18_000_000 },
  { id: '2', weeklyMs: 3_600_000 },
]

function renderStats() {
  return render(<I18nProvider><StatsView stats={stats} weeklyData={weeklyData} streaks={{}} onBack={() => {}} /></I18nProvider>)
}

describe('StatsView', () => {
  it('renders a heading', () => {
    renderStats()
    expect(screen.getByText('Statistics')).toBeInTheDocument()
  })

  it('renders each category name', () => {
    renderStats()
    // Categories appear in both Today and This Week sections
    expect(screen.getAllByText('Work').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Study').length).toBeGreaterThan(0)
  })

  it('renders formatted times', () => {
    renderStats()
    // 3_600_000ms = 1:00:00 in Today section
    expect(screen.getAllByText('1:00:00').length).toBeGreaterThan(0)
    // 1_200_000ms = 20:00 in Today section
    expect(screen.getAllByText('20:00').length).toBeGreaterThan(0)
  })

  it('renders percentage labels', () => {
    renderStats()
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0)
  })

  it('calls onBack when back button is clicked', async () => {
    let called = false
    render(<I18nProvider><StatsView stats={stats} weeklyData={weeklyData} streaks={{}} onBack={() => { called = true }} /></I18nProvider>)
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(called).toBe(true)
  })

  it('shows empty state when no stats', () => {
    render(<I18nProvider><StatsView stats={[]} weeklyData={[]} streaks={{}} onBack={() => {}} /></I18nProvider>)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })

  it('shows Today and This Week section headings', () => {
    renderStats()
    expect(screen.getByText(/today/i)).toBeInTheDocument()
    expect(screen.getByText(/this week/i)).toBeInTheDocument()
  })

  it('shows today totals in Today section', () => {
    renderStats()
    // 3_600_000ms = 1:00:00 shown in Today section
    expect(screen.getAllByText('1:00:00').length).toBeGreaterThan(0)
  })

  it('shows weekly totals in This Week section', () => {
    renderStats()
    // 10_800_000ms = 3:00:00 shown in This Week section
    expect(screen.getByText('3:00:00')).toBeInTheDocument()
  })

  it('weekly view shows goal progress bar when goal is set', () => {
    renderStats()
    // 10_800_000 / 18_000_000 = 60% shown in This Week section
    expect(screen.getByText('60%')).toBeInTheDocument()
  })
})
