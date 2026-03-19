import { describe, it, expect } from 'vitest'
import { suggestSessionName, suggestSessionTag, buildNamingPrompt } from './sessionNaming'

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

describe('suggestSessionTag', () => {
  it('returns null for empty titles', () => {
    expect(suggestSessionTag([])).toBeNull()
  })

  it('extracts repo name from VSCode title', () => {
    expect(suggestSessionTag(['timer.ts — productivity-challenge — Visual Studio Code'])).toBe('productivity-challenge')
  })

  it('extracts repo from Cursor title', () => {
    expect(suggestSessionTag(['App.tsx — my-project — Cursor'])).toBe('my-project')
  })

  it('extracts ticket ID from Linear title', () => {
    expect(suggestSessionTag(['PC-42 Fix timer stop bug — Linear'])).toBe('PC-42')
  })

  it('extracts Jira ticket ID', () => {
    expect(suggestSessionTag(['PROJ-1234 Implement feature - Jira'])).toBe('PROJ-1234')
  })

  it('extracts PR number from GitHub title', () => {
    expect(suggestSessionTag(['Fix timer #87 · Pull Request · anthropics/claude · GitHub'])).toBe('PR #87')
  })

  it('extracts repo from GitHub title', () => {
    expect(suggestSessionTag(['anthropics/claude-code: Claude Code — GitHub'])).toBe('claude-code')
  })

  it('returns null when no pattern matches', () => {
    expect(suggestSessionTag(['Some random window title'])).toBeNull()
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
