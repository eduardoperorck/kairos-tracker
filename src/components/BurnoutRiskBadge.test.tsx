import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BurnoutRiskBadge } from './BurnoutRiskBadge'

const today = '2026-03-17'

describe('BurnoutRiskBadge', () => {
  it('renders with low risk for empty sessions', () => {
    render(<BurnoutRiskBadge sessions={[]} today={today} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/low/i)).toBeInTheDocument()
  })

  it('shows score', () => {
    render(<BurnoutRiskBadge sessions={[]} today={today} />)
    expect(screen.getByText(/0\/100/)).toBeInTheDocument()
  })

  it('shows higher risk with critical debt', () => {
    render(<BurnoutRiskBadge sessions={[]} today={today} focusDebtLevel="critical" />)
    expect(screen.getByText(/critical|high/i)).toBeInTheDocument()
  })

  it('shows signals when present', () => {
    render(<BurnoutRiskBadge sessions={[]} today={today} focusDebtLevel="critical" />)
    expect(screen.getByText(/focus debt/i)).toBeInTheDocument()
  })
})
