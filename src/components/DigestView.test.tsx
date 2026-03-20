import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { DigestView } from './DigestView'
import type { ReactNode } from 'react'

vi.mock('../services/credentials', () => ({
  loadCredential: vi.fn().mockResolvedValue(null),
  saveCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
}))

// Mock callDigestAPI so tests do not hit the network.
// Individual tests override this with mockResolvedValueOnce / mockReturnValue / mockRejectedValueOnce.
vi.mock('../domain/digest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/digest')>()
  return {
    ...actual,
    callDigestAPI: vi.fn().mockResolvedValue('Weekly digest text'),
  }
})

import { loadCredential } from '../services/credentials'
import { callDigestAPI } from '../domain/digest'

function mockApiKey(key: string | null) {
  vi.mocked(loadCredential).mockResolvedValue(key)
}

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const defaultProps = {
  categories: [],
  sessions: [],
  historySessions: [],
  today: '2026-03-17',
}

describe('DigestView', () => {
  beforeEach(() => {
    mockApiKey(null)
    // Reset call history so tests don't bleed into each other
    vi.mocked(callDigestAPI).mockClear()
    vi.mocked(callDigestAPI).mockResolvedValue('Weekly digest text')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows Generate button initially', () => {
    renderWithI18n(<DigestView {...defaultProps} />)
    expect(screen.getByText('Generate')).toBeTruthy()
  })

  it('shows API key input when no key configured', async () => {
    renderWithI18n(<DigestView {...defaultProps} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sk-ant/)).toBeTruthy()
    })
  })

  it('shows loading state when generating', async () => {
    mockApiKey('sk-ant-test')
    // Suspend callDigestAPI forever so loading stays true
    vi.mocked(callDigestAPI).mockReturnValue(new Promise(() => {}))

    renderWithI18n(<DigestView {...defaultProps} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByText('Generating…')).toBeTruthy()
    })
  })

  it('respects 10s cooldown', async () => {
    mockApiKey('sk-ant-test')

    renderWithI18n(<DigestView {...defaultProps} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByText('Regenerate')).toBeTruthy()
    })

    // Clicking again within the 10-second cooldown must not call callDigestAPI again
    const callsBefore = vi.mocked(callDigestAPI).mock.calls.length
    fireEvent.click(screen.getByText('Regenerate'))

    await new Promise(r => setTimeout(r, 50))
    expect(vi.mocked(callDigestAPI).mock.calls.length).toBe(callsBefore)
  })

  it('shows generic error message on failure', async () => {
    mockApiKey('sk-ant-test')
    vi.mocked(callDigestAPI).mockRejectedValueOnce(new Error('Unable to generate digest. Please try again.'))

    renderWithI18n(<DigestView {...defaultProps} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      const errorEl = document.querySelector('.text-red-400')
      expect(errorEl).toBeTruthy()
      // Should not expose raw API status text
      expect(errorEl?.textContent).not.toBe('Internal Server Error')
    })
  })

  // ── auto-generate on mount (M69) ────────────────────────────────────────────

  it('auto-calls generate on mount when claudeApiKey is set and sessions exist and no cache', async () => {
    localStorage.removeItem('digest_cache_2026-W12')

    const sessions = [
      { id: 's1', categoryId: 'cat-1', startedAt: 1_000_000, endedAt: 4_600_000, date: '2026-03-17' },
    ]

    renderWithI18n(
      <DigestView
        {...defaultProps}
        sessions={sessions}
        claudeApiKey="sk-ant-auto"
        weekKey="2026-W12"
      />
    )

    // callDigestAPI should be invoked automatically without any user click
    await waitFor(() => {
      expect(vi.mocked(callDigestAPI)).toHaveBeenCalledOnce()
    })
  })

  it('does not auto-generate when sessions is empty even if claudeApiKey is set', async () => {
    localStorage.removeItem('digest_cache_2026-W11')

    renderWithI18n(
      <DigestView
        {...defaultProps}
        sessions={[]}
        claudeApiKey="sk-ant-auto"
        weekKey="2026-W11"
      />
    )

    // Wait long enough that any stray async effect would have fired
    await new Promise(r => setTimeout(r, 50))
    expect(vi.mocked(callDigestAPI)).not.toHaveBeenCalled()
  })

  it('does not auto-generate when a cached digest already exists for the week', async () => {
    const cacheKey = 'digest_cache_2026-W10'
    localStorage.setItem(cacheKey, 'Cached weekly digest')

    const sessions = [
      { id: 's1', categoryId: 'cat-1', startedAt: 1_000_000, endedAt: 4_600_000, date: '2026-03-17' },
    ]

    renderWithI18n(
      <DigestView
        {...defaultProps}
        sessions={sessions}
        claudeApiKey="sk-ant-auto"
        weekKey="2026-W10"
      />
    )

    await new Promise(r => setTimeout(r, 50))
    expect(vi.mocked(callDigestAPI)).not.toHaveBeenCalled()

    // The cached text is displayed directly without a network call
    expect(screen.getByText('Cached weekly digest')).toBeTruthy()

    localStorage.removeItem(cacheKey)
  })

  it('shows loading state during auto-generate on mount', async () => {
    localStorage.removeItem('digest_cache_2026-W09')

    // Suspend callDigestAPI forever so loading stays true
    vi.mocked(callDigestAPI).mockReturnValue(new Promise(() => {}))

    const sessions = [
      { id: 's1', categoryId: 'cat-1', startedAt: 1_000_000, endedAt: 4_600_000, date: '2026-03-17' },
    ]

    renderWithI18n(
      <DigestView
        {...defaultProps}
        sessions={sessions}
        claudeApiKey="sk-ant-auto"
        weekKey="2026-W09"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Generating…')).toBeTruthy()
    })
  })
})
