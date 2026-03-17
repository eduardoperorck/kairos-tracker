import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { NLPTimeEntry } from './NLPTimeEntry'
import type { ReactNode } from 'react'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const mockCategories = [
  { id: 'cat-1', name: 'Work' },
  { id: 'cat-2', name: 'Study' },
]

const mockOnConfirm = vi.fn()

describe('NLPTimeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows idle state initially', () => {
    renderWithI18n(
      <NLPTimeEntry categories={mockCategories} apiKey="sk-test" onConfirm={mockOnConfirm} />
    )
    expect(screen.getByPlaceholderText(/log time naturally/i)).toBeTruthy()
    expect(screen.getByText('Parse')).toBeTruthy()
  })

  it('shows loading state while parsing', async () => {
    // Never resolves
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))

    renderWithI18n(
      <NLPTimeEntry categories={mockCategories} apiKey="sk-test" onConfirm={mockOnConfirm} />
    )

    const input = screen.getByPlaceholderText(/log time naturally/i)
    fireEvent.change(input, { target: { value: 'worked 2h on work this morning' } })
    fireEvent.click(screen.getByText('Parse'))

    await waitFor(() => {
      expect(screen.getByText('Parsing…')).toBeTruthy()
    })
  })

  it('shows parsed preview on success', async () => {
    const mockResponse = {
      content: [{
        text: JSON.stringify({
          categoryId: 'cat-1',
          date: '2026-03-17',
          startHour: 9,
          durationMs: 7200000,
        })
      }]
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    renderWithI18n(
      <NLPTimeEntry categories={mockCategories} apiKey="sk-test" onConfirm={mockOnConfirm} />
    )

    const input = screen.getByPlaceholderText(/log time naturally/i)
    fireEvent.change(input, { target: { value: 'worked 2h on work this morning' } })
    fireEvent.click(screen.getByText('Parse'))

    await waitFor(() => {
      expect(screen.getByText('Add session')).toBeTruthy()
    })
  })

  it('confirm button is disabled during confirming', async () => {
    const mockResponse = {
      content: [{
        text: JSON.stringify({
          categoryId: 'cat-1',
          date: '2026-03-17',
          startHour: 9,
          durationMs: 7200000,
        })
      }]
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    // onConfirm never resolves during this test
    const slowConfirm = vi.fn(() => new Promise<void>(() => {}))

    renderWithI18n(
      <NLPTimeEntry categories={mockCategories} apiKey="sk-test" onConfirm={slowConfirm} />
    )

    const input = screen.getByPlaceholderText(/log time naturally/i)
    fireEvent.change(input, { target: { value: 'worked 2h' } })
    fireEvent.click(screen.getByText('Parse'))

    await waitFor(() => {
      expect(screen.getByText('Add session')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Add session'))

    await waitFor(() => {
      const btn = screen.getByText('Add session').closest('button')
      expect(btn?.disabled).toBe(true)
    })
  })

  it('shows error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    )

    renderWithI18n(
      <NLPTimeEntry categories={mockCategories} apiKey="sk-bad" onConfirm={mockOnConfirm} />
    )

    const input = screen.getByPlaceholderText(/log time naturally/i)
    fireEvent.change(input, { target: { value: 'worked 2h' } })
    fireEvent.click(screen.getByText('Parse'))

    await waitFor(() => {
      // Error message should be shown
      const errorEl = document.querySelector('.text-red-400')
      expect(errorEl).toBeTruthy()
    })
  })

  it('clears state on cancel', async () => {
    const mockResponse = {
      content: [{
        text: JSON.stringify({
          categoryId: 'cat-1',
          date: '2026-03-17',
          startHour: 9,
          durationMs: 7200000,
        })
      }]
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    renderWithI18n(
      <NLPTimeEntry categories={mockCategories} apiKey="sk-test" onConfirm={mockOnConfirm} />
    )

    const input = screen.getByPlaceholderText(/log time naturally/i)
    fireEvent.change(input, { target: { value: 'worked 2h' } })
    fireEvent.click(screen.getByText('Parse'))

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.queryByText('Add session')).toBeNull()
    })
  })
})
