import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EnergyScoreBanner } from './EnergyScoreBanner'
import { I18nProvider } from '../i18n'
import type { Session } from '../domain/timer'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeSession(hour: number, durationMs = 3_600_000): Session {
  const date = new Date(2026, 2, 10) // March 10
  date.setHours(hour, 0, 0, 0)
  const startedAt = date.getTime()
  return {
    id: `s-${hour}-${Math.random()}`,
    categoryId: 'cat-1',
    date: '2026-03-10',
    startedAt,
    endedAt: startedAt + durationMs,
  }
}

// Build sessions with clear peak at peakHour and valley at 14
// Need 4+ distinct hours for computeEnergyPattern to populate valleyHours
function makePeakSessions(peakHour: number): Session[] {
  const sessions: Session[] = []
  for (let i = 0; i < 10; i++) sessions.push(makeSession(peakHour, 3_600_000))  // peak
  for (let i = 0; i < 2; i++) sessions.push(makeSession(9, 2_400_000))           // secondary
  for (let i = 0; i < 2; i++) sessions.push(makeSession(11, 2_000_000))          // secondary
  for (let i = 0; i < 2; i++) sessions.push(makeSession(16, 1_800_000))          // secondary
  for (let i = 0; i < 3; i++) sessions.push(makeSession(14, 300_000))            // valley
  return sessions
}

describe('EnergyScoreBanner', () => {
  it('renders nothing when there are no sessions', () => {
    const { container } = renderWithI18n(
      <EnergyScoreBanner sessions={[]} currentHour={10} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when there are too few sessions', () => {
    const { container } = renderWithI18n(
      <EnergyScoreBanner sessions={[makeSession(10)]} currentHour={10} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows peak banner at peak hour', () => {
    const sessions = makePeakSessions(10)
    renderWithI18n(<EnergyScoreBanner sessions={sessions} currentHour={10} />)
    expect(screen.getByText(/peak hour/i)).toBeInTheDocument()
  })

  it('shows valley banner at valley hour', () => {
    const sessions = makePeakSessions(10)
    renderWithI18n(<EnergyScoreBanner sessions={sessions} currentHour={14} />)
    expect(screen.getByText(/valley hour/i)).toBeInTheDocument()
  })

  it('renders nothing at a neutral hour', () => {
    const sessions = makePeakSessions(10)
    const { container } = renderWithI18n(
      <EnergyScoreBanner sessions={sessions} currentHour={8} />
    )
    expect(container.firstChild).toBeNull()
  })
})
