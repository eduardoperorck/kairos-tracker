import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeadTimeRecoveryWidget } from './DeadTimeRecoveryWidget'
import { I18nProvider } from '../i18n'
import type { MicroTask } from '../domain/deadTimeRecovery'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('DeadTimeRecoveryWidget', () => {
  it('renders nothing when not dead time', () => {
    const { container } = renderWithI18n(
      <DeadTimeRecoveryWidget
        idleMs={2 * 60_000}
        onSelectTask={() => {}}
        onDismiss={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows idle time when dead', () => {
    renderWithI18n(
      <DeadTimeRecoveryWidget
        idleMs={15 * 60_000}
        onSelectTask={() => {}}
        onDismiss={() => {}}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/15m/)).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    renderWithI18n(
      <DeadTimeRecoveryWidget
        idleMs={15 * 60_000}
        onSelectTask={() => {}}
        onDismiss={onDismiss}
      />
    )
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onSelectTask when task clicked', () => {
    const onSelectTask = vi.fn()
    const customTasks: MicroTask[] = [
      { id: 'test', text: 'Custom task', estimatedMinutes: 5 },
    ]
    renderWithI18n(
      <DeadTimeRecoveryWidget
        idleMs={15 * 60_000}
        customTasks={customTasks}
        onSelectTask={onSelectTask}
        onDismiss={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Custom task'))
    expect(onSelectTask).toHaveBeenCalledWith(customTasks[0])
  })
})
