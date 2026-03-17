import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OnboardingWizard } from './OnboardingWizard'
import { I18nProvider } from '../i18n'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('OnboardingWizard', () => {
  it('shows step 1 welcome screen initially', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText(/Track your time/i)).toBeInTheDocument()
  })

  it('advances to step 2 on Get started click', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    expect(screen.getByText(/Create your categories/i)).toBeInTheDocument()
  })

  it('lets user add a custom category in step 2', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.change(screen.getByPlaceholderText(/Category name/i), { target: { value: 'Meditation' } })
    fireEvent.click(screen.getByText('Add'))
    expect(screen.getByText('Meditation')).toBeInTheDocument()
  })

  it('advances to step 3 from step 2', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    expect(screen.getByText(/Choose your focus style/i)).toBeInTheDocument()
  })

  it('calls onComplete with categories and preset on finish', () => {
    const onComplete = vi.fn()
    renderWithI18n(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Start tracking/i))
    expect(onComplete).toHaveBeenCalledOnce()
    const [{ categories, preset }] = onComplete.mock.calls[0]
    expect(Array.isArray(categories)).toBe(true)
    expect(typeof preset).toBe('string')
  })
})
