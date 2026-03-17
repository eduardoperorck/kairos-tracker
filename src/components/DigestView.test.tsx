import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { DigestView } from './DigestView'
import type { ReactNode } from 'react'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeStorage(apiKey: string | null = null) {
  return {
    getSetting: vi.fn((key: string) => {
      if (key === 'anthropic_api_key') return Promise.resolve(apiKey)
      return Promise.resolve(null)
    }),
    setSetting: vi.fn().mockResolvedValue(undefined),
    saveCategory: vi.fn(),
    loadCategories: vi.fn().mockResolvedValue([]),
    deleteCategory: vi.fn(),
    renameCategory: vi.fn(),
    setWeeklyGoal: vi.fn(),
    setColor: vi.fn(),
    saveSession: vi.fn(),
    loadSessionsByDate: vi.fn().mockResolvedValue([]),
    loadSessionsSince: vi.fn().mockResolvedValue([]),
    importSessions: vi.fn(),
    saveIntention: vi.fn(),
    loadIntentionsByDate: vi.fn().mockResolvedValue([]),
    saveEveningReview: vi.fn(),
    loadEveningReviewByDate: vi.fn().mockResolvedValue(null),
  }
}

const defaultProps = {
  categories: [],
  sessions: [],
  historySessions: [],
  today: '2026-03-17',
}

describe('DigestView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows Generate button initially', () => {
    renderWithI18n(<DigestView {...defaultProps} storage={makeStorage()} />)
    expect(screen.getByText('Generate')).toBeTruthy()
  })

  it('shows API key input when no key configured', async () => {
    renderWithI18n(<DigestView {...defaultProps} storage={makeStorage(null)} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sk-ant/)).toBeTruthy()
    })
  })

  it('shows loading state when generating', async () => {
    // fetch never resolves
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))

    renderWithI18n(<DigestView {...defaultProps} storage={makeStorage('sk-ant-test')} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByText('Generating…')).toBeTruthy()
    })
  })

  it('respects 10s cooldown', async () => {
    const mockResponse = {
      content: [{ text: 'Your weekly summary here.' }]
    }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    renderWithI18n(<DigestView {...defaultProps} storage={makeStorage('sk-ant-test')} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByText('Regenerate')).toBeTruthy()
    })

    // Clicking again within cooldown should not call fetch again
    const callsBefore = vi.mocked(fetch).mock.calls.length
    fireEvent.click(screen.getByText('Regenerate'))

    await new Promise(r => setTimeout(r, 50))
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore)
  })

  it('shows generic error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )

    renderWithI18n(<DigestView {...defaultProps} storage={makeStorage('sk-ant-test')} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      const errorEl = document.querySelector('.text-red-400')
      expect(errorEl).toBeTruthy()
      // Should not expose raw "Internal Server Error" from API
      expect(errorEl?.textContent).not.toBe('Internal Server Error')
    })
  })
})
