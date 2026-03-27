import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { useTimerStore } from '../store/useTimerStore'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'
import { I18nProvider } from '../i18n'

function renderApp() {
  return render(<I18nProvider><App storage={createInMemoryStorage()} /></I18nProvider>)
}

/** Open ghost card and add a category by name. */
async function addCategory(name: string) {
  await userEvent.click(screen.getByText('+ Add category'))
  await userEvent.type(screen.getByPlaceholderText('Category name'), name)
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
}

/** Open the ··· overflow menu for a category card (expects exactly one 'More options' button). */
async function openOverflow() {
  await userEvent.click(screen.getByRole('button', { name: 'More options' }))
}

beforeEach(() => {
  useTimerStore.setState({ categories: [], sessions: [], historySessions: [] })
})

describe('App', () => {
  it('renders the app title', () => {
    renderApp()
    expect(screen.getAllByText('Kairos Tracker').length).toBeGreaterThan(0)
  })

  it('renders ghost card add button', () => {
    renderApp()
    expect(screen.getByText('+ Add category')).toBeInTheDocument()
  })

  it('clicking ghost card reveals input and add button', async () => {
    renderApp()
    await userEvent.click(screen.getByText('+ Add category'))
    expect(screen.getByPlaceholderText('Category name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('adding a category shows it in the list', async () => {
    renderApp()
    await addCategory('Work')
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('input is empty when ghost card is expanded again after adding', async () => {
    renderApp()
    await addCategory('Work')
    // Expand the ghost card again — the input should be empty
    await userEvent.click(screen.getByText('+ Add category'))
    expect(screen.getByPlaceholderText('Category name')).toHaveValue('')
  })

  it('does not add a category with an empty name', async () => {
    renderApp()
    await userEvent.click(screen.getByText('+ Add category'))
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    // No Start button should appear (no category was added)
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('shows a Start button for each category', async () => {
    renderApp()
    await addCategory('Work')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('clicking Start changes the button to Stop', async () => {
    renderApp()
    await addCategory('Work')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('clicking Stop returns to Start', async () => {
    renderApp()
    await addCategory('Work')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('starting a second category stops the first', async () => {
    renderApp()
    for (const name of ['Work', 'Study']) {
      await addCategory(name)
    }
    const starts = screen.getAllByRole('button', { name: 'Start' })
    await userEvent.click(starts[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])

    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('shows overflow menu button per category', async () => {
    renderApp()
    await addCategory('Work')
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument()
  })

  it('clicking overflow menu shows archive option', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  })

  it('clicking archive shows confirm and cancel buttons', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('cancelling archive keeps the category', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('clicking rename in overflow shows input with current name', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    await userEvent.click(screen.getByText(/rename/i))
    expect(screen.getByRole('textbox', { name: /rename/i })).toHaveValue('Work')
  })

  it('editing and pressing Enter renames the category', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    await userEvent.click(screen.getByText(/rename/i))
    const input = screen.getByRole('textbox', { name: /rename/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Deep Work{Enter}')
    expect(screen.getByText('Deep Work')).toBeInTheDocument()
  })

  it('pressing Escape cancels the rename', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    await userEvent.click(screen.getByText(/rename/i))
    const input = screen.getByRole('textbox', { name: /rename/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Something{Escape}')
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('confirming archive removes the category from the active list', async () => {
    renderApp()
    await addCategory('Work')
    await openOverflow()
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(screen.queryByText('Work')).not.toBeInTheDocument()
  })

  it('shortcut tip shows after onboarding when categories exist', async () => {
    localStorage.setItem('onboarding_complete', 'true')
    localStorage.removeItem('shortcut_tip_shown')

    renderApp()
    await addCategory('Work')

    expect(screen.getByText(/Tip: press/)).toBeInTheDocument()
  })
})
