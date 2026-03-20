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
  it('renders CSV, JSON, HTML export buttons inside dropdown', () => {
    renderWithI18n(<HistoryView sessions={[]} categories={[]} />)
    fireEvent.click(screen.getByText(/export/i))
    expect(screen.getByText('Download CSV')).toBeTruthy()
    expect(screen.getByText('Download JSON')).toBeTruthy()
    expect(screen.getByText('Download HTML')).toBeTruthy()
  })

  it('clicking Download CSV triggers download', () => {
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
    fireEvent.click(screen.getByText(/export/i))
    fireEvent.click(screen.getByText('Download CSV'))
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('clicking Download JSON triggers download', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      return origCreate(tag)
    })
    renderWithI18n(<HistoryView sessions={[makeSession()]} categories={categories} />)
    fireEvent.click(screen.getByText(/export/i))
    fireEvent.click(screen.getByText('Download JSON'))
    expect(createObjectURL).toHaveBeenCalled()
  })
})

describe('HistoryView — M72: inline tag suggestion', () => {
  it('shows "+ tag" button for untagged sessions when onTagSession is provided', () => {
    renderWithI18n(
      <HistoryView
        sessions={[makeSession()]}
        categories={categories}
        onTagSession={vi.fn()}
      />
    )
    expect(screen.getByText('+ tag')).toBeTruthy()
  })

  it('does NOT show "+ tag" button when neither onTagSession nor onBulkTag is provided', () => {
    renderWithI18n(
      <HistoryView sessions={[makeSession()]} categories={categories} />
    )
    expect(screen.queryByText('+ tag')).toBeNull()
  })

  it('does NOT show "+ tag" button for sessions that already have a tag', () => {
    renderWithI18n(
      <HistoryView
        sessions={[makeSession({ tag: 'deep work' })]}
        categories={categories}
        onTagSession={vi.fn()}
      />
    )
    expect(screen.queryByText('+ tag')).toBeNull()
  })

  it('clicking "+ tag" reveals quick-tag chips', () => {
    renderWithI18n(
      <HistoryView
        sessions={[makeSession()]}
        categories={categories}
        onTagSession={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('+ tag'))
    expect(screen.getByText('deep-work')).toBeTruthy()
    expect(screen.getByText('admin')).toBeTruthy()
    expect(screen.getByText('meeting')).toBeTruthy()
    expect(screen.getByText('learning')).toBeTruthy()
  })

  it('selecting a quick-tag chip calls onTagSession with the correct session id and tag', async () => {
    const onTagSession = vi.fn().mockResolvedValue(undefined)
    renderWithI18n(
      <HistoryView
        sessions={[makeSession({ id: 'session-42' })]}
        categories={categories}
        onTagSession={onTagSession}
      />
    )
    fireEvent.click(screen.getByText('+ tag'))
    fireEvent.click(screen.getByText('deep-work'))
    expect(onTagSession).toHaveBeenCalledWith('session-42', 'deep-work')
  })

  it('selecting a quick-tag chip calls onTagSession once', async () => {
    const onTagSession = vi.fn().mockResolvedValue(undefined)
    renderWithI18n(
      <HistoryView
        sessions={[makeSession()]}
        categories={categories}
        onTagSession={onTagSession}
      />
    )
    fireEvent.click(screen.getByText('+ tag'))
    fireEvent.click(screen.getByText('admin'))
    expect(onTagSession).toHaveBeenCalledOnce()
  })

  it('shows "+ tag" via onBulkTag when onTagSession is absent', () => {
    renderWithI18n(
      <HistoryView
        sessions={[makeSession()]}
        categories={categories}
        onBulkTag={vi.fn()}
      />
    )
    // The checkbox renders when onBulkTag is provided; the + tag button also renders
    expect(screen.getByText('+ tag')).toBeTruthy()
  })

  it('does NOT show "+ tag" button for a tagged session even when onTagSession is provided', () => {
    const tagged = makeSession({ id: 'tagged', tag: 'meeting' })
    const untagged = makeSession({ id: 'untagged-1' })
    renderWithI18n(
      <HistoryView
        sessions={[tagged, untagged]}
        categories={categories}
        onTagSession={vi.fn()}
      />
    )
    // Only one "+ tag" button — for the untagged session
    const tagButtons = screen.getAllByText('+ tag')
    expect(tagButtons).toHaveLength(1)
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
