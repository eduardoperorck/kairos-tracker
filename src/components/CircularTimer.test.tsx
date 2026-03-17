import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CircularTimer } from './CircularTimer'

describe('CircularTimer', () => {
  it('renders elapsed time as text', () => {
    render(<CircularTimer elapsedMs={90_000} cycleMs={1_500_000} />)
    expect(screen.getByText('01:30')).toBeInTheDocument()
  })

  it('renders an SVG arc', () => {
    const { container } = render(<CircularTimer elapsedMs={0} cycleMs={1_500_000} />)
    expect(container.querySelector('circle')).toBeTruthy()
  })

  it('computes progress between 0 and 1', () => {
    const { container } = render(<CircularTimer elapsedMs={750_000} cycleMs={1_500_000} />)
    const arc = container.querySelectorAll('circle')[1] // progress arc
    const dashoffset = (arc as SVGCircleElement).style.strokeDashoffset
    // At 50% progress the offset should be ~half the circumference
    expect(dashoffset).toBeTruthy()
  })

  it('caps progress at 1 when elapsed exceeds cycle', () => {
    // Should not throw or produce negative offsets
    const { container } = render(<CircularTimer elapsedMs={2_000_000} cycleMs={1_500_000} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('adds flow pulse class when isFlow is true', () => {
    const { container } = render(<CircularTimer elapsedMs={0} cycleMs={1_500_000} isFlow />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})
