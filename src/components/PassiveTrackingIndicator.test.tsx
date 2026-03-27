import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PassiveTrackingIndicator } from './PassiveTrackingIndicator'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('PassiveTrackingIndicator', () => {
  it('renders nothing when currentWindow is null', () => {
    const { container } = renderWithI18n(
      <PassiveTrackingIndicator currentWindow={null} idleMs={0} isTimerActive={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the process name when no workspace or domain', () => {
    renderWithI18n(
      <PassiveTrackingIndicator
        currentWindow={{ process: 'cursor.exe', workspace: null, domain: null }}
        idleMs={0}
        isTimerActive={false}
      />
    )
    expect(screen.getByText(/cursor\.exe/i)).toBeInTheDocument()
  })

  it('shows "VS Code › workspace" when workspace is present', () => {
    renderWithI18n(
      <PassiveTrackingIndicator
        currentWindow={{ process: 'Code.exe', workspace: 'productivity-challenge', domain: null }}
        idleMs={0}
        isTimerActive={true}
      />
    )
    expect(screen.getByText(/VS Code/i)).toBeInTheDocument()
    expect(screen.getByText(/productivity-challenge/i)).toBeInTheDocument()
  })

  it('shows domain for browser windows', () => {
    renderWithI18n(
      <PassiveTrackingIndicator
        currentWindow={{ process: 'chrome.exe', workspace: null, domain: 'github.com' }}
        idleMs={0}
        isTimerActive={true}
      />
    )
    expect(screen.getByText(/github\.com/i)).toBeInTheDocument()
  })

  it('applies amber styling when idle for more than 5 minutes', () => {
    renderWithI18n(
      <PassiveTrackingIndicator
        currentWindow={{ process: 'Code.exe', workspace: null, domain: null }}
        idleMs={6 * 60_000}
        isTimerActive={true}
      />
    )
    const dot = screen.getByTestId('tracking-dot')
    expect(dot.className).toMatch(/amber/)
  })

  it('applies emerald styling when timer is active and not idle', () => {
    renderWithI18n(
      <PassiveTrackingIndicator
        currentWindow={{ process: 'Code.exe', workspace: null, domain: null }}
        idleMs={0}
        isTimerActive={true}
      />
    )
    const dot = screen.getByTestId('tracking-dot')
    expect(dot.className).toMatch(/emerald/)
  })
})
