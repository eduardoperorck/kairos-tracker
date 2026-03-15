import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { useTimerStore } from '../store/useTimerStore'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'

function renderApp() {
  return render(<App storage={createInMemoryStorage()} />)
}

beforeEach(() => {
  useTimerStore.setState({ categories: [], sessions: [], historySessions: [] })
})

describe('App', () => {
  it('renders the app title', () => {
    renderApp()
    expect(screen.getByText('Time Tracker')).toBeInTheDocument()
  })

  it('renders an input and add button', () => {
    renderApp()
    expect(screen.getByPlaceholderText('Category name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('adding a category shows it in the list', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('clears the input after adding a category', async () => {
    renderApp()
    const input = screen.getByPlaceholderText('Category name')
    await userEvent.type(input, 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(input).toHaveValue('')
  })

  it('does not add a category with an empty name', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('shows a Start button for each category', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('clicking Start changes the button to Stop', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('clicking Stop returns the button to Start', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('starting a second category stops the first', async () => {
    renderApp()
    for (const name of ['Work', 'Study']) {
      await userEvent.type(screen.getByPlaceholderText('Category name'), name)
      await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    }
    const starts = screen.getAllByRole('button', { name: 'Start' })
    await userEvent.click(starts[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'Start' })[0])

    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('shows a delete button per category', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('clicking delete shows confirm and cancel buttons', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('cancelling delete keeps the category', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('clicking category name shows an input with current name', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByText('Work'))
    expect(screen.getByRole('textbox', { name: /rename/i })).toHaveValue('Work')
  })

  it('editing and pressing Enter renames the category', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByText('Work'))
    const input = screen.getByRole('textbox', { name: /rename/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Deep Work{Enter}')
    expect(screen.getByText('Deep Work')).toBeInTheDocument()
  })

  it('pressing Escape cancels the rename', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByText('Work'))
    const input = screen.getByRole('textbox', { name: /rename/i })
    await userEvent.clear(input)
    await userEvent.type(input, 'Something{Escape}')
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('confirming delete removes the category', async () => {
    renderApp()
    await userEvent.type(screen.getByPlaceholderText('Category name'), 'Work')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(screen.queryByText('Work')).not.toBeInTheDocument()
  })
})
