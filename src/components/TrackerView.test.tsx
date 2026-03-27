import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TrackerView } from './TrackerView'
import { I18nProvider } from '../i18n'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'
import type { StoreCategory, TimerContext, CaptureContext } from './TrackerView'
import type { Session } from '../domain/timer'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeCategory(overrides: Partial<StoreCategory> = {}): StoreCategory {
  return {
    id: 'cat-1',
    name: 'Work',
    accumulatedMs: 0,
    activeEntry: null,
    ...overrides,
  }
}

function makeTimerContext(overrides: Partial<TimerContext> = {}): TimerContext {
  return {
    input: '',
    setInput: vi.fn(),
    categories: [],
    sessions: [] as Session[],
    historySessions: [] as Session[],
    weekDates: [],
    categoryInsights: {},
    activeCategory: undefined,
    claudeApiKey: null,
    breakSkipCount: 0,
    onAdd: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onArchive: vi.fn(),
    onRename: vi.fn(),
    onSetGoal: vi.fn(),
    onSetColor: vi.fn(),
    onSetTag: vi.fn(),
    onNLPConfirm: vi.fn(),
    ...overrides,
  }
}

function makeCaptureContext(overrides: Partial<CaptureContext> = {}): CaptureContext {
  return { ...overrides }
}

const baseProps = {
  timer: makeTimerContext(),
  capture: makeCaptureContext(),
  onFocusLock: vi.fn(),
  storage: createInMemoryStorage(),
}

describe('TrackerView — M70: NLP log time button', () => {
  it('renders the log session button when claudeApiKey is null', () => {
    renderWithI18n(<TrackerView {...baseProps} timer={makeTimerContext({ claudeApiKey: null })} />)
    expect(screen.getByTitle(/AI entry requires/i)).toBeInTheDocument()
  })

  it('shows "manual" indicator when claudeApiKey is null', () => {
    renderWithI18n(<TrackerView {...baseProps} timer={makeTimerContext({ claudeApiKey: null })} />)
    expect(screen.getByTitle(/AI entry requires/i)).toBeInTheDocument()
  })

  it('log session button is still visible with an API key set', () => {
    renderWithI18n(<TrackerView {...baseProps} timer={makeTimerContext({ claudeApiKey: 'sk-test-key' })} />)
    // button shows without the "manual" info note
    expect(screen.queryByTitle(/AI entry requires/i)).not.toBeInTheDocument()
  })
})

describe('TrackerView — M103: no MVD input field', () => {
  it('does not render an expanded MVD text input field', () => {
    const mvdItems = [{ id: 'm1', text: 'Write tests', done: false, createdAt: Date.now() }]
    renderWithI18n(
      <TrackerView
        {...baseProps}
        mvd={{ items: mvdItems, onChange: vi.fn() }}
      />
    )
    // MVD chips should display
    expect(screen.getByText('Write tests')).toBeTruthy()
    // There should be no expanded MVD add-item input (only the log bar input)
    const inputs = screen.queryAllByRole('textbox')
    // No MVD input should be expanded — only the persistent log bar input is present
    const mvdInput = inputs.find(i => i.getAttribute('placeholder')?.includes('priority'))
    expect(mvdInput).toBeUndefined()
  })

  it('renders MVD items as chips, not as form inputs', () => {
    const mvdItems = [
      { id: 'm1', text: 'Deep focus', done: false, createdAt: Date.now() },
      { id: 'm2', text: 'Review PR', done: true, createdAt: Date.now() },
    ]
    renderWithI18n(
      <TrackerView
        {...baseProps}
        mvd={{ items: mvdItems, onChange: vi.fn() }}
      />
    )
    expect(screen.getByText('Deep focus')).toBeTruthy()
    expect(screen.getByText('Review PR')).toBeTruthy()
  })

  it('does not render MVD section at all when mvd is not provided', () => {
    renderWithI18n(<TrackerView {...baseProps} />)
    expect(screen.queryByText("Today's goals")).toBeNull()
  })
})

describe('TrackerView — M104: no compact toggle button', () => {
  it('does not render a compact toggle button', () => {
    renderWithI18n(<TrackerView {...baseProps} />)
    expect(screen.queryByRole('button', { name: /compact/i })).toBeNull()
  })

  it('does not render a compact toggle button even with many categories', () => {
    const cats = Array.from({ length: 6 }, (_, i) =>
      makeCategory({ id: `cat-${i}`, name: `Cat ${i}` })
    )
    renderWithI18n(<TrackerView {...baseProps} timer={makeTimerContext({ categories: cats })} />)
    expect(screen.queryByRole('button', { name: /compact/i })).toBeNull()
  })
})

describe('TrackerView — M107: FocusDebtBanner suppressed when timer is running', () => {
  it('does NOT render FocusDebtBanner when a timer is active (isRunning=true)', () => {
    const active = makeCategory({
      activeEntry: { startedAt: 1_000_000, endedAt: null },
    })
    renderWithI18n(
      <TrackerView
        {...baseProps}
        timer={makeTimerContext({ categories: [active], activeCategory: active, breakSkipCount: 10 })}
      />
    )
    expect(screen.queryByText('Focus Debt')).toBeNull()
  })

  it('renders FocusDebtBanner when no timer is running and there is debt', () => {
    // Create sessions that generate focus debt: many skipped breaks (via breakSkipCount)
    // breakSkipCount=10 with no sessions should produce debt > 0
    renderWithI18n(
      <TrackerView
        {...baseProps}
        timer={makeTimerContext({ categories: [makeCategory()], activeCategory: undefined, breakSkipCount: 10 })}
      />
    )
    // FocusDebtBanner may or may not render depending on debt level,
    // but the key assertion is that it is NOT suppressed by logic
    // (the banner renders or returns null based on debt level internally).
    // We assert the banner container is not blocked by the isRunning guard.
    // Since breakSkipCount=10 produces debt, the title should appear.
    expect(screen.getByText('Focus Debt')).toBeTruthy()
  })
})

describe('TrackerView — M-UX1: Banner reasoning context', () => {
  it('workspace banner shows "VS Code opened" context text', () => {
    renderWithI18n(
      <TrackerView
        {...baseProps}
        capture={makeCaptureContext({
          unclassifiedWorkspace: 'productivity-challenge',
          onAssignWorkspace: vi.fn(),
          onDismissWorkspace: vi.fn(),
        })}
      />
    )
    expect(screen.getByText(/VS Code opened/i)).toBeInTheDocument()
  })

  it('workspace banner dismiss button says "Always ignore"', () => {
    renderWithI18n(
      <TrackerView
        {...baseProps}
        capture={makeCaptureContext({
          unclassifiedWorkspace: 'my-project',
          onAssignWorkspace: vi.fn(),
          onDismissWorkspace: vi.fn(),
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Always ignore/i })).toBeInTheDocument()
  })

  it('elevation banner shows "is active while tracking" context', () => {
    const workCat = makeCategory({ id: 'cat-1', name: 'Work', activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(
      <TrackerView
        {...baseProps}
        timer={makeTimerContext({ categories: [workCat], activeCategory: workCat })}
        capture={makeCaptureContext({
          elevationSuggestion: { process: 'cursor.exe', displayName: 'Cursor', categoryId: 'cat-1' },
          onElevateProcess: vi.fn(),
          onDismissElevation: vi.fn(),
        })}
      />
    )
    expect(screen.getByText(/is active while tracking/i)).toBeInTheDocument()
  })

  it('workspace banner shows "just now" when workspace first detected', () => {
    renderWithI18n(
      <TrackerView
        {...baseProps}
        capture={makeCaptureContext({
          unclassifiedWorkspace: 'productivity-challenge',
          onAssignWorkspace: vi.fn(),
          onDismissWorkspace: vi.fn(),
        })}
      />
    )
    expect(screen.getByText(/just now/i)).toBeInTheDocument()
  })

  it('elevation banner shows "active just now" when elevation first appears', () => {
    const workCat = makeCategory({ id: 'cat-1', name: 'Work', activeEntry: { startedAt: Date.now(), endedAt: null } })
    renderWithI18n(
      <TrackerView
        {...baseProps}
        timer={makeTimerContext({ categories: [workCat], activeCategory: workCat })}
        capture={makeCaptureContext({
          elevationSuggestion: { process: 'cursor.exe', displayName: 'Cursor', categoryId: 'cat-1' },
          onElevateProcess: vi.fn(),
          onDismissElevation: vi.fn(),
        })}
      />
    )
    expect(screen.getByText(/active just now/i)).toBeInTheDocument()
  })

  it('dead time banner shows the current window process as context', () => {
    const workCat = makeCategory({ id: 'cat-1', name: 'Work', activeEntry: { startedAt: Date.now() - 60_000, endedAt: null } })
    renderWithI18n(
      <TrackerView
        {...baseProps}
        timer={makeTimerContext({ categories: [workCat], activeCategory: workCat })}
        capture={makeCaptureContext({
          idleMs: 15 * 60_000,
          currentWindow: { process: 'chrome.exe', workspace: null, domain: null },
        })}
      />
    )
    expect(screen.getByText(/idle in chrome\.exe/i)).toBeInTheDocument()
  })
})
