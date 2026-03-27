import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { ActiveTimerBar } from './ActiveTimerBar'

function renderBar(props: Partial<Parameters<typeof ActiveTimerBar>[0]> = {}) {
  return render(
    <I18nProvider>
      <ActiveTimerBar
        categoryName="Work"
        startedAt={Date.now() - 10_000}
        onStop={vi.fn()}
        {...props}
      />
    </I18nProvider>
  )
}

describe('ActiveTimerBar', () => {
  it('shows category name and stop button', () => {
    renderBar()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText(/stop/i)).toBeInTheDocument()
  })

  it('does not show Meeting button when onMeeting is not provided', () => {
    renderBar()
    expect(screen.queryByText(/meeting/i)).not.toBeInTheDocument()
  })

  it('shows Meeting button when onMeeting is provided', () => {
    renderBar({ onMeeting: vi.fn() })
    expect(screen.getByRole('button', { name: /meeting/i })).toBeInTheDocument()
  })

  it('calls onMeeting when Meeting button is clicked', () => {
    const onMeeting = vi.fn()
    renderBar({ onMeeting })
    fireEvent.click(screen.getByRole('button', { name: /meeting/i }))
    expect(onMeeting).toHaveBeenCalledOnce()
  })

  it('shows End Meeting button when isMeeting is true', () => {
    renderBar({ onMeeting: vi.fn(), isMeeting: true })
    expect(screen.getByRole('button', { name: /end meeting/i })).toBeInTheDocument()
  })

  it('calls onMeeting when End Meeting button is clicked', () => {
    const onMeeting = vi.fn()
    renderBar({ onMeeting, isMeeting: true })
    fireEvent.click(screen.getByRole('button', { name: /end meeting/i }))
    expect(onMeeting).toHaveBeenCalledOnce()
  })
})
