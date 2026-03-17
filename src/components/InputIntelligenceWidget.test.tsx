import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InputIntelligenceWidget } from './InputIntelligenceWidget'
import type { InputActivity } from '../domain/inputIntelligence'

function makeActivity(keystrokes = 0, windowMs = 60_000): InputActivity {
  return { keystrokes, mouseClicks: 0, mouseDistancePx: 0, windowMs }
}

describe('InputIntelligenceWidget', () => {
  it('shows idle intensity for zero keystrokes', () => {
    render(<InputIntelligenceWidget activity={makeActivity(0)} />)
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('shows intense intensity for 100 kpm', () => {
    render(<InputIntelligenceWidget activity={makeActivity(100)} />)
    expect(screen.getByText('intense')).toBeInTheDocument()
  })

  it('shows keystrokes per minute', () => {
    render(<InputIntelligenceWidget activity={makeActivity(60)} />)
    expect(screen.getByText('60kpm')).toBeInTheDocument()
  })

  it('renders keyboard icon', () => {
    render(<InputIntelligenceWidget activity={makeActivity()} />)
    expect(screen.getByText('⌨️')).toBeInTheDocument()
  })
})
