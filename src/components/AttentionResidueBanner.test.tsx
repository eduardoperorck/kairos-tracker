import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttentionResidueBanner } from './AttentionResidueBanner'

describe('AttentionResidueBanner', () => {
  it('renders nothing when switchedAt is null', () => {
    const { container } = render(<AttentionResidueBanner switchedAt={null} fromCategory="Work" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders banner when actively settling', () => {
    const switchedAt = Date.now() - 30_000 // 30 seconds ago
    render(<AttentionResidueBanner switchedAt={switchedAt} fromCategory="Deep Work" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Deep Work')).toBeInTheDocument()
  })

  it('renders nothing when settling period has passed', () => {
    const switchedAt = Date.now() - 6 * 60_000 // 6 minutes ago
    const { container } = render(<AttentionResidueBanner switchedAt={switchedAt} fromCategory="Work" />)
    expect(container.firstChild).toBeNull()
  })

  it('displays countdown in MM:SS format', () => {
    const switchedAt = Date.now() - 60_000 // 1 minute ago
    render(<AttentionResidueBanner switchedAt={switchedAt} fromCategory="Work" />)
    // remaining = ~4:00
    expect(screen.getByText(/\d:\d{2}/)).toBeInTheDocument()
  })
})
