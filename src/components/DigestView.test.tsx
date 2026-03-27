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

// Mock callLLM and detectLLMBackend so tests do not hit the network.
vi.mock('../services/llm', () => ({
  detectLLMBackend: vi.fn().mockResolvedValue('claude'),
  callLLM: vi.fn().mockResolvedValue('Weekly digest text'),
}))

import { loadCredential } from '../services/credentials'
import { detectLLMBackend, callLLM } from '../services/llm'

function mockApiKey(key: string | null) {
  vi.mocked(loadCredential).mockResolvedValue(key)
  if (key) {
    vi.mocked(detectLLMBackend).mockResolvedValue('claude')
  } else {
    vi.mocked(detectLLMBackend).mockResolvedValue('none')
  }
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
    vi.mocked(callLLM).mockClear()
    vi.mocked(callLLM).mockResolvedValue('Weekly digest text')
    vi.mocked(detectLLMBackend).mockResolvedValue('none')
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
    // Suspend callLLM forever so loading stays true
    vi.mocked(callLLM).mockReturnValue(new Promise(() => {}))

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

    // Clicking again within the 10-second cooldown must not call callLLM again
    const callsBefore = vi.mocked(callLLM).mock.calls.length
    fireEvent.click(screen.getByText('Regenerate'))

    await new Promise(r => setTimeout(r, 50))
    expect(vi.mocked(callLLM).mock.calls.length).toBe(callsBefore)
  })

  it('shows generic error message on failure', async () => {
    mockApiKey('sk-ant-test')
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('Unable to generate digest. Please try again.'))

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
    vi.mocked(detectLLMBackend).mockResolvedValue('claude')

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

    // callLLM should be invoked automatically without any user click
    await waitFor(() => {
      expect(vi.mocked(callLLM)).toHaveBeenCalledOnce()
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
    expect(vi.mocked(callLLM)).not.toHaveBeenCalled()
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
    expect(vi.mocked(callLLM)).not.toHaveBeenCalled()

    // The cached text is displayed directly without a network call
    expect(screen.getByText('Cached weekly digest')).toBeTruthy()

    localStorage.removeItem(cacheKey)
  })

  it('shows loading state during auto-generate on mount', async () => {
    localStorage.removeItem('digest_cache_2026-W09')
    vi.mocked(detectLLMBackend).mockResolvedValue('claude')

    // Suspend callLLM forever so loading stays true
    vi.mocked(callLLM).mockReturnValue(new Promise(() => {}))

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
