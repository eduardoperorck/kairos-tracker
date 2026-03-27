import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryGoal } from './CategoryGoal'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function renderGoal(props: Partial<Parameters<typeof CategoryGoal>[0]> = {}) {
  const defaults = {
    weeklyMs: 0,
    goalMs: 0,
    onSetGoal: vi.fn(),
  }
  return renderWithI18n(<CategoryGoal {...defaults} {...props} />)
}

describe('CategoryGoal', () => {
  it('shows "Set weekly goal" button when goalMs is 0', () => {
    renderGoal()
    expect(screen.getByText(/set weekly goal/i)).toBeTruthy()
  })

  it('shows suggestion label when suggestedMs is provided', async () => {
    renderGoal({ suggestedMs: 7_200_000 }) // 2h
    await userEvent.click(screen.getByText(/set weekly goal/i))
    expect(screen.getByText(/suggestion/i)).toBeTruthy()
    expect(screen.getByText(/2h/)).toBeTruthy()
  })

  it('uses suggestion value when "Use suggestion" is clicked', async () => {
    const onSetGoal = vi.fn()
    renderGoal({ suggestedMs: 7_200_000, onSetGoal })
    await userEvent.click(screen.getByText(/set weekly goal/i))
    await userEvent.click(screen.getByRole('button', { name: /use suggestion/i }))
    expect(onSetGoal).toHaveBeenCalledWith(7_200_000)
  })

  it('does not show suggestion when suggestedMs is 0', async () => {
    renderGoal({ suggestedMs: 0 })
    await userEvent.click(screen.getByText(/set weekly goal/i))
    expect(screen.queryByText(/suggested/i)).toBeNull()
  })
})
