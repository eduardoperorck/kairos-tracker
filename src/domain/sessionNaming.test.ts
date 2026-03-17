import { describe, it, expect } from 'vitest'
import { suggestSessionName, buildNamingPrompt } from './sessionNaming'

describe('suggestSessionName', () => {
  it('returns "Session" for empty array', () => {
    expect(suggestSessionName([])).toBe('Session')
  })

  it('returns "Session" when all titles are ignored', () => {
    expect(suggestSessionName(['', 'settings', 'desktop'])).toBe('Session')
  })

  it('returns "Coding" for VS Code title', () => {
    expect(suggestSessionName(['Visual Studio Code - main.ts'])).toBe('Coding')
  })

  it('returns "Communication" for Slack title', () => {
    expect(suggestSessionName(['Slack - #general'])).toBe('Communication')
  })

  it('returns most frequent title', () => {
    const titles = ['Report draft', 'Report draft', 'Report draft', 'settings']
    expect(suggestSessionName(titles)).toBe('Report draft')
  })

  it('truncates long titles', () => {
    const longTitle = 'A'.repeat(50)
    const result = suggestSessionName([longTitle])
    expect(result.length).toBeLessThanOrEqual(40)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns "Design" for Figma title', () => {
    expect(suggestSessionName(['Figma - Homepage design'])).toBe('Design')
  })

  it('returns "Code Review" for GitHub title', () => {
    expect(suggestSessionName(['GitHub - Pull Request #123'])).toBe('Code Review')
  })
})

describe('buildNamingPrompt', () => {
  it('returns a valid JSON string', () => {
    const prompt = buildNamingPrompt(['VS Code', 'Terminal'], 'Work')
    expect(() => JSON.parse(prompt)).not.toThrow()
  })

  it('includes category name', () => {
    const prompt = buildNamingPrompt([], 'Deep Work')
    const parsed = JSON.parse(prompt)
    expect(parsed.category).toBe('Deep Work')
  })

  it('limits titles to 10', () => {
    const titles = Array.from({ length: 20 }, (_, i) => `Title ${i}`)
    const prompt = buildNamingPrompt(titles, 'Work')
    const parsed = JSON.parse(prompt)
    expect(parsed.titles.length).toBeLessThanOrEqual(10)
  })
})
