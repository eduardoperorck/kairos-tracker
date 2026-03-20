import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TrackerView } from './TrackerView'
import { I18nProvider } from '../i18n'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'
import type { StoreCategory } from './TrackerView'
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

const baseProps = {
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
  onDelete: vi.fn(),
  onArchive: vi.fn(),
  onRename: vi.fn(),
  onSetGoal: vi.fn(),
  onSetColor: vi.fn(),
  onSetTag: vi.fn(),
  onFocusLock: vi.fn(),
  onNLPConfirm: vi.fn(),
  storage: createInMemoryStorage(),
}

describe('TrackerView — M70: NLP log time button', () => {
  it('renders the log time button when claudeApiKey is null', () => {
    renderWithI18n(<TrackerView {...baseProps} claudeApiKey={null} />)
    expect(screen.getByRole('button', { name: /log time/i })).toBeTruthy()
  })

  it('does NOT show "(AI)" in the button label when claudeApiKey is null', () => {
    renderWithI18n(<TrackerView {...baseProps} claudeApiKey={null} />)
    const btn = screen.getByRole('button', { name: /log time/i })
    expect(btn.textContent).not.toContain('(AI)')
  })

  it('shows "(AI)" indicator in the button label when claudeApiKey is provided', () => {
    renderWithI18n(<TrackerView {...baseProps} claudeApiKey="sk-test-key" />)
    const btn = screen.getByRole('button', { name: /log time/i })
    expect(btn.textContent).toContain('(AI)')
  })

  it('button is still visible with an API key set', () => {
    renderWithI18n(<TrackerView {...baseProps} claudeApiKey="sk-test-key" />)
    expect(screen.getByRole('button', { name: /log time/i })).toBeTruthy()
  })
})

describe('TrackerView — M103: no MVD input field', () => {
  it('does not render an MVD text input field', () => {
    const mvdItems = [{ id: 'm1', text: 'Write tests', done: false, createdAt: Date.now() }]
    renderWithI18n(
      <TrackerView
        {...baseProps}
        mvdItems={mvdItems}
        onMVDChange={vi.fn()}
      />
    )
    // MVD chips should display but no input for adding new items
    expect(screen.getByText('Write tests')).toBeTruthy()
    // There should be no dedicated MVD add-item input
    const inputs = screen.queryAllByRole('textbox')
    // The only textbox allowed is the ghost category input (not yet expanded)
    expect(inputs).toHaveLength(0)
  })

  it('renders MVD items as chips, not as form inputs', () => {
    const mvdItems = [
      { id: 'm1', text: 'Deep focus', done: false, createdAt: Date.now() },
      { id: 'm2', text: 'Review PR', done: true, createdAt: Date.now() },
    ]
    renderWithI18n(
      <TrackerView
        {...baseProps}
        mvdItems={mvdItems}
        onMVDChange={vi.fn()}
      />
    )
    expect(screen.getByText('Deep focus')).toBeTruthy()
    expect(screen.getByText('Review PR')).toBeTruthy()
  })

  it('does not render MVD section at all when onMVDChange is not provided', () => {
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
    renderWithI18n(<TrackerView {...baseProps} categories={cats} />)
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
        categories={[active]}
        activeCategory={active}
        breakSkipCount={10}
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
        categories={[makeCategory()]}
        activeCategory={undefined}
        breakSkipCount={10}
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
