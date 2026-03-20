import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BurnoutRiskBadge } from './BurnoutRiskBadge'
import { I18nProvider } from '../i18n'
import type { ReactNode } from 'react'

const today = '2026-03-17'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('BurnoutRiskBadge', () => {
  it('renders with low risk for empty sessions', () => {
    renderWithI18n(<BurnoutRiskBadge sessions={[]} today={today} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/low/i)).toBeInTheDocument()
  })

  it('shows score', () => {
    renderWithI18n(<BurnoutRiskBadge sessions={[]} today={today} />)
    expect(screen.getByText(/0\/100/)).toBeInTheDocument()
  })

  it('shows higher risk with critical debt', () => {
    renderWithI18n(<BurnoutRiskBadge sessions={[]} today={today} focusDebtLevel="critical" />)
    expect(screen.getByText(/critical|high/i)).toBeInTheDocument()
  })

  it('shows signals when present', () => {
    renderWithI18n(<BurnoutRiskBadge sessions={[]} today={today} focusDebtLevel="critical" />)
    expect(screen.getByText(/focus debt/i)).toBeInTheDocument()
  })
})
