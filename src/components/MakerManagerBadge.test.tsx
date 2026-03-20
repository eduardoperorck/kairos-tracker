import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MakerManagerBadge } from './MakerManagerBadge'
import type { CaptureBlock } from '../domain/passiveCapture'
import { I18nProvider } from '../i18n'
import type { ReactNode } from 'react'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeBlock(durationMinutes: number): CaptureBlock {
  const now = Date.now()
  return {
    process: 'App.exe',
    title: 'Window',
    startedAt: now,
    endedAt: now + durationMinutes * 60_000,
    categoryId: null,
    confirmed: false,
  }
}

describe('MakerManagerBadge', () => {
  it('renders unknown mode for empty blocks', () => {
    renderWithI18n(<MakerManagerBadge blocks={[]} />)
    expect(screen.getByText(/Unknown/)).toBeInTheDocument()
  })

  it('renders maker mode for long blocks', () => {
    const blocks = [makeBlock(60), makeBlock(45), makeBlock(90)]
    renderWithI18n(<MakerManagerBadge blocks={blocks} />)
    expect(screen.getByText(/Maker/)).toBeInTheDocument()
  })

  it('renders manager mode for short blocks', () => {
    const blocks = [makeBlock(5), makeBlock(10), makeBlock(15), makeBlock(5), makeBlock(8)]
    renderWithI18n(<MakerManagerBadge blocks={blocks} />)
    expect(screen.getByText(/Manager/)).toBeInTheDocument()
  })

  it('shows deep/short percentages', () => {
    const blocks = [makeBlock(60), makeBlock(10)]
    renderWithI18n(<MakerManagerBadge blocks={blocks} />)
    expect(screen.getByText(/Deep:/)).toBeInTheDocument()
    expect(screen.getByText(/Short:/)).toBeInTheDocument()
  })
})
