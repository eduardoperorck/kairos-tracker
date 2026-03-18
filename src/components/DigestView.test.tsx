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

import { loadCredential } from '../services/credentials'

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
    vi.stubGlobal('fetch', vi.fn())
    mockApiKey(null)
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
    // fetch never resolves
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))

    renderWithI18n(<DigestView {...defaultProps} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByText('Generating…')).toBeTruthy()
    })
  })

  it('respects 10s cooldown', async () => {
    mockApiKey('sk-ant-test')
    const mockResponse = {
      content: [{ text: 'Your weekly summary here.' }]
    }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    renderWithI18n(<DigestView {...defaultProps} />)

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
    mockApiKey('sk-ant-test')
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )

    renderWithI18n(<DigestView {...defaultProps} />)

    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      const errorEl = document.querySelector('.text-red-400')
      expect(errorEl).toBeTruthy()
      // Should not expose raw "Internal Server Error" from API
      expect(errorEl?.textContent).not.toBe('Internal Server Error')
    })
  })
})
