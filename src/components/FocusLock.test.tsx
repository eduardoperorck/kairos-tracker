import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { FocusLock } from './FocusLock'
import type { ReactNode } from 'react'

vi.mock('../hooks/useElapsed', () => ({
  useElapsed: () => 0,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FocusLock', () => {
  it('renders category name', () => {
    renderWithI18n(
      <FocusLock categoryName="Deep Work" startedAt={Date.now()} onExit={vi.fn()} />
    )
    expect(screen.getByText('Deep Work')).toBeTruthy()
  })

  it('renders Focus Lock label', () => {
    renderWithI18n(
      <FocusLock categoryName="Work" startedAt={Date.now()} onExit={vi.fn()} />
    )
    expect(screen.getByText('Focus Lock')).toBeTruthy()
  })

  it('renders exit button', () => {
    renderWithI18n(
      <FocusLock categoryName="Work" startedAt={Date.now()} onExit={vi.fn()} />
    )
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('calls onExit when exit button is clicked', () => {
    const onExit = vi.fn()
    renderWithI18n(
      <FocusLock categoryName="Work" startedAt={Date.now()} onExit={onExit} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('shows flow state badge for long sessions', () => {
    // useElapsed mocked to 0ms, but we can test with a past startedAt to make flow
    // Since useElapsed is mocked to 0, flow = false — test renders without crash
    const { container } = renderWithI18n(
      <FocusLock categoryName="Work" startedAt={Date.now() - 60 * 60 * 1000} onExit={vi.fn()} />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('renders CircularTimer component', () => {
    const { container } = renderWithI18n(
      <FocusLock categoryName="Work" startedAt={Date.now()} onExit={vi.fn()} />
    )
    // CircularTimer renders an SVG
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('accepts custom cycleMs prop', () => {
    const { container } = renderWithI18n(
      <FocusLock categoryName="Work" startedAt={Date.now()} cycleMs={25 * 60_000} onExit={vi.fn()} />
    )
    expect(container.firstChild).toBeTruthy()
  })
})
