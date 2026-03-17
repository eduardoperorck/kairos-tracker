import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeadTimeRecoveryWidget } from './DeadTimeRecoveryWidget'
import type { MicroTask } from '../domain/deadTimeRecovery'

describe('DeadTimeRecoveryWidget', () => {
  it('renders nothing when not dead time', () => {
    const { container } = render(
      <DeadTimeRecoveryWidget
        idleMs={2 * 60_000}
        onSelectTask={() => {}}
        onDismiss={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows idle time when dead', () => {
    render(
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
    render(
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
    render(
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
