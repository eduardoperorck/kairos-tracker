import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionNameSuggestion } from './SessionNameSuggestion'
import { I18nProvider } from '../i18n'
import type { ReactNode } from 'react'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('SessionNameSuggestion', () => {
  it('renders the dialog', () => {
    renderWithI18n(<SessionNameSuggestion titles={[]} onAccept={() => {}} onDismiss={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('prefills input with suggestion from titles', () => {
    renderWithI18n(
      <SessionNameSuggestion
        titles={['Visual Studio Code - index.ts']}
        onAccept={() => {}}
        onDismiss={() => {}}
      />
    )
    expect(screen.getByRole('textbox')).toHaveValue('Coding')
  })

  it('calls onAccept with current value on Save click', () => {
    const onAccept = vi.fn()
    renderWithI18n(<SessionNameSuggestion titles={[]} onAccept={onAccept} onDismiss={() => {}} />)
    fireEvent.click(screen.getByText('Save'))
    expect(onAccept).toHaveBeenCalledWith('Session')
  })

  it('calls onDismiss on Skip click', () => {
    const onDismiss = vi.fn()
    renderWithI18n(<SessionNameSuggestion titles={[]} onAccept={() => {}} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Skip'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onAccept on Enter key press', () => {
    const onAccept = vi.fn()
    renderWithI18n(<SessionNameSuggestion titles={[]} onAccept={onAccept} onDismiss={() => {}} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onAccept).toHaveBeenCalled()
  })
})
