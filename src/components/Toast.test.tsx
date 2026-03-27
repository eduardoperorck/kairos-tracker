import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toast } from './Toast'

describe('Toast', () => {
  it('renders null when message is null', () => {
    const { container } = render(<Toast message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the message when provided', () => {
    render(<Toast message="Rule created" />)
    expect(screen.getByText('Rule created')).toBeInTheDocument()
  })

  it('renders with role="status" for accessibility', () => {
    render(<Toast message="Category archived" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
