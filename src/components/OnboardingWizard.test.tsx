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

  it('advances to step 2 (categories) on Get started click', () => {
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

  it('advances to step 3 (how tracking works) from step 2', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    expect(screen.getByText(/How tracking works/i)).toBeInTheDocument()
  })

  it('advances to step 4 (shortcuts) from step 3', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Next/i))
    expect(screen.getByText(/Keyboard shortcuts/i)).toBeInTheDocument()
  })

  it('advances to step 5 (focus style) from step 4', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Next/i))
    fireEvent.click(screen.getByText(/Next/i))
    expect(screen.getByText(/Choose your focus style/i)).toBeInTheDocument()
  })

  it('calls onComplete with categories and preset on finish', () => {
    const onComplete = vi.fn()
    renderWithI18n(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Next/i))
    fireEvent.click(screen.getByText(/Next/i))
    fireEvent.click(screen.getByText(/Start tracking/i))
    expect(onComplete).toHaveBeenCalledOnce()
    const [{ categories, preset }] = onComplete.mock.calls[0]
    expect(Array.isArray(categories)).toBe(true)
    expect(typeof preset).toBe('string')
  })

  it('shows a Skip button in step 2', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('calls onComplete immediately when Skip is clicked', () => {
    const onComplete = vi.fn()
    renderWithI18n(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText(/Get started/i))
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('shows step indicator progress', () => {
    renderWithI18n(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/Get started/i))
    // should show something like "1 / 4" or "Step 1 of 4"
    expect(screen.getByText(/1\s*\/\s*4/)).toBeInTheDocument()
  })
})
