import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { HistoryView } from './HistoryView'
import type { Session, Category } from '../domain/timer'
import type { ReactNode } from 'react'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const categories: Category[] = [
  { id: 'c1', name: 'Work', activeEntry: null },
  { id: 'c2', name: 'Study', activeEntry: null },
]

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    categoryId: 'c1',
    date: '2026-03-15',
    startedAt: new Date('2026-03-15T09:00:00Z').getTime(),
    endedAt:   new Date('2026-03-15T10:00:00Z').getTime(),
    ...overrides,
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('HistoryView — empty state', () => {
  it('shows empty message when no sessions', () => {
    renderWithI18n(<HistoryView sessions={[]} categories={[]} />)
    expect(screen.getByText('No history yet.')).toBeTruthy()
  })

  it('renders History heading', () => {
    renderWithI18n(<HistoryView sessions={[]} categories={[]} />)
    expect(screen.getByText('History')).toBeTruthy()
  })
})

describe('HistoryView — with sessions', () => {
  it('renders session category name', () => {
    renderWithI18n(
      <HistoryView sessions={[makeSession()]} categories={categories} />
    )
    expect(screen.getByText('Work')).toBeTruthy()
  })

  it('shows formatted date heading', () => {
    renderWithI18n(
      <HistoryView sessions={[makeSession()]} categories={categories} />
    )
    expect(screen.getByText('2026-03-15')).toBeTruthy()
  })

  it('marks flow sessions with ⚡ flow badge', () => {
    // 60-min session = flow (≥ 45 min)
    renderWithI18n(
      <HistoryView sessions={[makeSession()]} categories={categories} />
    )
    expect(screen.getByText('⚡ flow')).toBeTruthy()
  })

  it('does not show flow badge for short sessions', () => {
    const short = makeSession({
      endedAt: new Date('2026-03-15T09:10:00Z').getTime(), // 10 min only
    })
    renderWithI18n(
      <HistoryView sessions={[short]} categories={categories} />
    )
    expect(screen.queryByText('⚡ flow')).toBeNull()
  })

  it('shows context tag when present', () => {
    renderWithI18n(
      <HistoryView sessions={[makeSession({ tag: 'deep work' })]} categories={categories} />
    )
    expect(screen.getByText('deep work')).toBeTruthy()
  })

  it('groups sessions by date, newest first', () => {
    const s1 = makeSession({ id: 's1', date: '2026-03-14', startedAt: new Date('2026-03-14T09:00:00Z').getTime(), endedAt: new Date('2026-03-14T10:00:00Z').getTime() })
    const s2 = makeSession({ id: 's2', date: '2026-03-15', startedAt: new Date('2026-03-15T09:00:00Z').getTime(), endedAt: new Date('2026-03-15T10:00:00Z').getTime() })
    renderWithI18n(
      <HistoryView sessions={[s1, s2]} categories={categories} />
    )
    const dates = screen.getAllByText(/2026-03-1/)
    expect(dates[0].textContent).toBe('2026-03-15')
    expect(dates[1].textContent).toBe('2026-03-14')
  })

  it('renders multiple sessions for the same day', () => {
    const s1 = makeSession({ id: 's1', categoryId: 'c1' })
    const s2 = makeSession({ id: 's2', categoryId: 'c2' })
    renderWithI18n(
      <HistoryView sessions={[s1, s2]} categories={categories} />
    )
    expect(screen.getByText('Work')).toBeTruthy()
    expect(screen.getByText('Study')).toBeTruthy()
  })
})

describe('HistoryView — export buttons', () => {
  it('renders CSV, JSON, HTML export buttons', () => {
    renderWithI18n(<HistoryView sessions={[]} categories={[]} />)
    expect(screen.getByText('CSV')).toBeTruthy()
    expect(screen.getByText('JSON')).toBeTruthy()
    expect(screen.getByText('HTML')).toBeTruthy()
  })

  it('clicking CSV triggers download', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const clickMock = vi.fn()
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') { Object.defineProperty(el, 'click', { value: clickMock }); return el }
      return el
    })

    renderWithI18n(<HistoryView sessions={[makeSession()]} categories={categories} />)
    fireEvent.click(screen.getByText('CSV'))
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('clicking JSON triggers download', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      return origCreate(tag)
    })
    renderWithI18n(<HistoryView sessions={[makeSession()]} categories={categories} />)
    fireEvent.click(screen.getByText('JSON'))
    expect(createObjectURL).toHaveBeenCalled()
  })
})

describe('HistoryView — import', () => {
  it('shows Import Toggl button when onImportSessions provided', () => {
    renderWithI18n(
      <HistoryView sessions={[]} categories={[]} onImportSessions={async () => {}} />
    )
    expect(screen.getByText('Import Toggl')).toBeTruthy()
  })

  it('does NOT show Import Toggl button when no handler', () => {
    renderWithI18n(<HistoryView sessions={[]} categories={[]} />)
    expect(screen.queryByText('Import Toggl')).toBeNull()
  })

  it('shows import status after successful import', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined)
    renderWithI18n(
      <HistoryView sessions={[]} categories={categories} onImportSessions={onImport} />
    )

    const csvContent = [
      'User,Email,Client,Project,Task,Description,Start date,Start time,End date,End time,Duration',
      ',,,Work,,,2026-03-15,09:00:00,2026-03-15,10:00:00,01:00:00',
    ].join('\n')

    const file = new File([csvContent], 'export.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(/Imported/)).toBeTruthy()
    })
  })
})
