import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { SettingsView } from './SettingsView'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'
import { FOCUS_PRESETS } from '../domain/focusGuard'
import type { ReactNode } from 'react'
import type { Storage } from '../persistence/storage'

function renderWithI18n(ui: ReactNode) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function makeStorage(): Storage {
  return createInMemoryStorage()
}

const defaultPreset = FOCUS_PRESETS[0]

function makeDefaultProps(storage: Storage, overrides = {}) {
  return {
    categories: [],
    sessions: [],
    storage,
    webhookUrl: '',
    onWebhookUrlChange: vi.fn(),
    focusPreset: defaultPreset,
    onFocusPresetChange: vi.fn(),
    focusStrictMode: false,
    onFocusStrictModeChange: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  // Mock getLLMStatus to avoid fetch calls in tests
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SettingsView — renders', () => {
  it('renders Settings heading', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('renders Backup & Restore section', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    expect(screen.getAllByText(/backup/i).length).toBeGreaterThan(0)
  })

  it('renders language buttons', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    expect(screen.getByText('English')).toBeTruthy()
    expect(screen.getByText('Português')).toBeTruthy()
  })

  it('renders focus preset buttons', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    // At least one preset name should be visible
    expect(screen.getByText('Pomodoro')).toBeTruthy()
  })

  it('renders strict mode toggle', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeTruthy()
  })

  it('renders Webhooks section', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    expect(screen.getByPlaceholderText('https://…')).toBeTruthy()
  })
})

describe('SettingsView — strict mode toggle', () => {
  it('calls onFocusStrictModeChange when toggle is clicked', () => {
    const storage = makeStorage()
    const onFocusStrictModeChange = vi.fn()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage, { onFocusStrictModeChange })} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onFocusStrictModeChange).toHaveBeenCalledWith(true)
  })

  it('shows strict mode as enabled when focusStrictMode=true', () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage, { focusStrictMode: true })} />)
    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })
})

describe('SettingsView — focus preset', () => {
  it('calls onFocusPresetChange when a preset is clicked', () => {
    const storage = makeStorage()
    const onFocusPresetChange = vi.fn()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage, { onFocusPresetChange })} />)
    // Click the second preset (52/17)
    const buttons = screen.getAllByText(/\d+m \/ \d+m/)
    fireEvent.click(buttons[1])
    expect(onFocusPresetChange).toHaveBeenCalled()
  })
})

describe('SettingsView — backup', () => {
  it('triggers CSV download when backup button is clicked', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    const clickMock = vi.fn()
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') { Object.defineProperty(el, 'click', { value: clickMock }); return el }
      return el
    })

    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)
    fireEvent.click(screen.getByText(/download backup/i))
    expect(createObjectURL).toHaveBeenCalled()
  })
})

describe('SettingsView — restore backup', () => {
  it('shows restored session count after valid JSON restore', async () => {
    const storage = makeStorage()
    const sessions = [
      { id: 's1', categoryId: 'c1', startedAt: 0, endedAt: 3600000, date: '2026-03-15' },
    ]
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)

    const file = new File([JSON.stringify(sessions)], 'backup.json', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(/Restored 1 session/i)).toBeTruthy()
    })
  })

  it('shows error message for invalid JSON backup', async () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)

    const file = new File(['not json at all {{{'], 'backup.json', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(/Error: invalid backup file/i)).toBeTruthy()
    })
  })

  it('shows error for non-array JSON backup', async () => {
    const storage = makeStorage()
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)

    const file = new File([JSON.stringify({ not: 'array' })], 'backup.json', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(/Error: invalid backup file/i)).toBeTruthy()
    })
  })
})

describe('SettingsView — webhooks', () => {
  it('calls onWebhookUrlChange when save button clicked', async () => {
    const storage = makeStorage()
    const onWebhookUrlChange = vi.fn()
    storage.setSetting = vi.fn().mockResolvedValue(undefined)
    renderWithI18n(<SettingsView {...makeDefaultProps(storage, { onWebhookUrlChange })} />)

    const input = screen.getByPlaceholderText('https://…')
    fireEvent.change(input, { target: { value: 'https://example.com/hook' } })

    // Find Save buttons — there's one in webhooks and one in API key section
    const saveButtons = screen.getAllByText('Save')
    fireEvent.click(saveButtons[saveButtons.length - 1])

    await waitFor(() => {
      expect(onWebhookUrlChange).toHaveBeenCalledWith('https://example.com/hook')
    })
  })
})

describe('SettingsView — sync path validation', () => {
  it('shows invalid sync path error for path traversal attempt', async () => {
    const storage = makeStorage()
    await storage.setSetting('sync_path', '../etc/passwd')
    renderWithI18n(<SettingsView {...makeDefaultProps(storage)} />)

    await waitFor(() => {
      expect(screen.getByText(/sync now/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByText(/sync now/i))

    await waitFor(() => {
      expect(screen.getByText(/Invalid sync path/i)).toBeTruthy()
    })
  })
})
