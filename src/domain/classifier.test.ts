import { describe, it, expect } from 'vitest'
import { extractDomainFromTitle, extractVsCodeWorkspace, scoreWindow, computeTimeOfDayPrior } from './classifier'
import type { SignalSet, DomainRule } from './classifier'
import type { WindowRule } from './passiveCapture'

// ─── extractDomainFromTitle ───────────────────────────────────────────────────

describe('extractDomainFromTitle', () => {
  it('extracts domain from Chrome title', () => {
    expect(extractDomainFromTitle('GitHub - microsoft/vscode - Google Chrome', 'chrome.exe'))
      .toBe('github.com')
  })

  it('extracts domain from Chrome title with subdomain', () => {
    expect(extractDomainFromTitle('Issues · myorg/repo · GitHub - Google Chrome', 'chrome.exe'))
      .toBe('github.com')
  })

  it('handles chrome title with plain domain segment', () => {
    expect(extractDomainFromTitle('Stack Overflow - Where Developers Learn - Google Chrome', 'chrome.exe'))
      .toBe('stackoverflow.com')
  })

  it('extracts domain from Edge title', () => {
    expect(extractDomainFromTitle('Jira - Microsoft Edge', 'msedge.exe'))
      .toBe('jira.atlassian.net')
  })

  it('extracts domain from Edge with full domain in title', () => {
    expect(extractDomainFromTitle('figma.com - Microsoft Edge', 'msedge.exe'))
      .toBe('figma.com')
  })

  it('extracts domain from Firefox title with domain visible', () => {
    expect(extractDomainFromTitle('github.com/myorg/repo — Mozilla Firefox', 'firefox.exe'))
      .toBe('github.com')
  })

  it('returns null for Firefox title with no recognizable domain', () => {
    expect(extractDomainFromTitle('New Tab — Mozilla Firefox', 'firefox.exe'))
      .toBeNull()
  })

  it('extracts domain from Brave title', () => {
    expect(extractDomainFromTitle('reddit.com - Brave', 'brave.exe'))
      .toBe('reddit.com')
  })

  it('extracts domain from a title containing a URL path', () => {
    expect(extractDomainFromTitle('youtube.com/watch?v=abc123 - Google Chrome', 'chrome.exe'))
      .toBe('youtube.com')
  })

  it('returns null for non-browser process', () => {
    expect(extractDomainFromTitle('index.ts — my-project — Visual Studio Code', 'Code.exe'))
      .toBeNull()
  })

  it('returns null for empty title', () => {
    expect(extractDomainFromTitle('', 'chrome.exe'))
      .toBeNull()
  })

  it('returns null for new tab page', () => {
    expect(extractDomainFromTitle('New Tab - Google Chrome', 'chrome.exe'))
      .toBeNull()
  })

  it('returns null for browser title with no domain', () => {
    expect(extractDomainFromTitle('Google Chrome', 'chrome.exe'))
      .toBeNull()
  })

  it('recognises known domain name appearing literally in title', () => {
    expect(extractDomainFromTitle('netflix.com - Google Chrome', 'chrome.exe'))
      .toBe('netflix.com')
  })
})

// ─── extractVsCodeWorkspace (M-A4) ──────────────────────────────────────────

describe('extractVsCodeWorkspace', () => {
  it('extracts workspace from standard VS Code title (file + workspace)', () => {
    expect(extractVsCodeWorkspace('index.ts — my-project — Visual Studio Code', 'Code.exe'))
      .toBe('my-project')
  })

  it('extracts workspace when only workspace is open (no file)', () => {
    expect(extractVsCodeWorkspace('productivity-challenge — Visual Studio Code', 'Code.exe'))
      .toBe('productivity-challenge')
  })

  it('returns null for a single file open with no workspace', () => {
    expect(extractVsCodeWorkspace('settings.json — Visual Studio Code', 'Code.exe'))
      .toBeNull()
  })

  it('returns null for the VS Code welcome screen', () => {
    expect(extractVsCodeWorkspace('Visual Studio Code', 'Code.exe'))
      .toBeNull()
  })

  it('strips unsaved file indicator and extracts workspace', () => {
    expect(extractVsCodeWorkspace('● unsaved.ts — my-project — Visual Studio Code', 'Code.exe'))
      .toBe('my-project')
  })

  it('works with Cursor (VS Code fork)', () => {
    expect(extractVsCodeWorkspace('main.rs — my-app — Cursor', 'Cursor.exe'))
      .toBe('my-app')
  })

  it('works with VS Code Insiders', () => {
    expect(extractVsCodeWorkspace('App.tsx — my-app — Visual Studio Code - Insiders', 'Code - Insiders.exe'))
      .toBe('my-app')
  })

  it('returns null for non-VS Code process', () => {
    expect(extractVsCodeWorkspace('main.rs — my-app — Visual Studio Code', 'chrome.exe'))
      .toBeNull()
  })

  it('returns null for Untitled file with no workspace', () => {
    expect(extractVsCodeWorkspace('Untitled-1 — Visual Studio Code', 'Code.exe'))
      .toBeNull()
  })
})

// ─── scoreWindow (M-A2 + M-A3) ──────────────────────────────────────────────

const BASE_RULES: WindowRule[] = [
  { id: 'vscode', matchType: 'process', pattern: 'Code.exe', categoryId: 'work', mode: 'auto', enabled: true },
  { id: 'chrome-suggest', matchType: 'process', pattern: 'chrome.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'github-title', matchType: 'title', pattern: 'GitHub', categoryId: 'work', mode: 'auto', enabled: true },
  { id: 'youtube-title', matchType: 'title', pattern: 'YouTube', categoryId: 'personal', mode: 'auto', enabled: true },
  { id: 'spotify-ignore', matchType: 'process', pattern: 'Spotify.exe', categoryId: null, mode: 'ignore', enabled: true },
]

function signals(overrides: Partial<SignalSet> = {}): SignalSet {
  return { process: 'unknown.exe', title: '', domain: null, vsWorkspace: null, inputRate: 'none', ...overrides }
}

describe('scoreWindow', () => {
  it('returns empty when no rules match', () => {
    expect(scoreWindow(signals(), BASE_RULES, [])).toHaveLength(0)
  })

  it('scores process auto-rule at 0.50', () => {
    const result = scoreWindow(signals({ process: 'Code.exe' }), BASE_RULES, [])
    expect(result[0].categoryId).toBe('work')
    expect(result[0].score).toBeCloseTo(0.50)
  })

  it('ignores rules with null categoryId', () => {
    // chrome.exe has a suggest rule but categoryId is null → no score
    const result = scoreWindow(signals({ process: 'chrome.exe' }), BASE_RULES, [])
    expect(result).toHaveLength(0)
  })

  it('ignores mode:ignore rules', () => {
    const result = scoreWindow(signals({ process: 'Spotify.exe' }), BASE_RULES, [])
    expect(result).toHaveLength(0)
  })

  it('ignores disabled rules', () => {
    const rules: WindowRule[] = [
      { id: 'x', matchType: 'process', pattern: 'Code.exe', categoryId: 'work', mode: 'auto', enabled: false },
    ]
    expect(scoreWindow(signals({ process: 'Code.exe' }), rules, [])).toHaveLength(0)
  })

  it('title match contributes 0.20 for auto rule', () => {
    const result = scoreWindow(signals({ title: 'GitHub Pull Request' }), BASE_RULES, [])
    const work = result.find(r => r.categoryId === 'work')!
    expect(work.score).toBeCloseTo(0.20)
  })

  it('combined process + title scores accumulate', () => {
    // process (0.50) + title (0.20) = 0.70
    const result = scoreWindow(signals({ process: 'Code.exe', title: 'GitHub Pull Request' }), BASE_RULES, [])
    expect(result[0].categoryId).toBe('work')
    expect(result[0].score).toBeCloseTo(0.70)
  })

  it('domain rule contributes 0.20 when domain matches', () => {
    const domainRules: DomainRule[] = [{ id: 'd1', domain: 'github.com', categoryId: 'work' }]
    const result = scoreWindow(signals({ domain: 'github.com' }), BASE_RULES, domainRules)
    const work = result.find(r => r.categoryId === 'work')!
    expect(work.score).toBeCloseTo(0.20)
  })

  it('domain rule + title rule accumulate for same category', () => {
    const domainRules: DomainRule[] = [{ id: 'd1', domain: 'github.com', categoryId: 'work' }]
    const result = scoreWindow(
      signals({ domain: 'github.com', title: 'GitHub Pull Request' }),
      BASE_RULES, domainRules
    )
    const work = result.find(r => r.categoryId === 'work')!
    expect(work.score).toBeCloseTo(0.40) // 0.20 domain + 0.20 title
  })

  it('high inputRate boosts top category by 0.10', () => {
    const high = scoreWindow(signals({ process: 'Code.exe', inputRate: 'high' }), BASE_RULES, [])
    const none = scoreWindow(signals({ process: 'Code.exe', inputRate: 'none' }), BASE_RULES, [])
    expect(high[0].score - none[0].score).toBeCloseTo(0.10)
  })

  it('low inputRate does not boost', () => {
    const low = scoreWindow(signals({ process: 'Code.exe', inputRate: 'low' }), BASE_RULES, [])
    const none = scoreWindow(signals({ process: 'Code.exe', inputRate: 'none' }), BASE_RULES, [])
    expect(low[0].score).toBeCloseTo(none[0].score)
  })

  it('results are sorted descending by score', () => {
    // Code.exe → work (0.50), YouTube in title → personal (0.20)
    const result = scoreWindow(signals({ process: 'Code.exe', title: 'YouTube' }), BASE_RULES, [])
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
    expect(result[0].categoryId).toBe('work')
  })

  it('score is capped at 1.0 even with many signals', () => {
    const domainRules: DomainRule[] = [{ id: 'd1', domain: 'github.com', categoryId: 'work' }]
    const result = scoreWindow(
      signals({ process: 'Code.exe', title: 'GitHub PR', domain: 'github.com', inputRate: 'high' }),
      BASE_RULES, domainRules
    )
    expect(result[0].score).toBeLessThanOrEqual(1.0)
  })

  // M-A3: hysteresis
  it('hysteresis adds 0.15 bonus to the active category', () => {
    const withH = scoreWindow(signals({ title: 'GitHub PR' }), BASE_RULES, [], 'work')
    const withoutH = scoreWindow(signals({ title: 'GitHub PR' }), BASE_RULES, [])
    const workWith = withH.find(r => r.categoryId === 'work')!
    const workWithout = withoutH.find(r => r.categoryId === 'work')!
    expect(workWith.score - workWithout.score).toBeCloseTo(0.15)
  })

  it('hysteresis applies even when active category has no other signals', () => {
    // 'personal' has no matching signals, but it IS the active category
    const result = scoreWindow(signals({ process: 'Code.exe' }), BASE_RULES, [], 'personal')
    const personal = result.find(r => r.categoryId === 'personal')
    expect(personal).toBeDefined()
    expect(personal!.score).toBeCloseTo(0.15)
  })

  it('hysteresis does not affect non-active categories', () => {
    const withH = scoreWindow(signals({ process: 'Code.exe' }), BASE_RULES, [], 'personal')
    const withoutH = scoreWindow(signals({ process: 'Code.exe' }), BASE_RULES, [])
    const workWith = withH.find(r => r.categoryId === 'work')!
    const workWithout = withoutH.find(r => r.categoryId === 'work')!
    expect(workWith.score).toBeCloseTo(workWithout.score)
  })

  // vsWorkspace signal
  it('workspace name matching a title rule contributes 0.15', () => {
    const result = scoreWindow(signals({ vsWorkspace: 'GitHub project' }), BASE_RULES, [])
    const work = result.find(r => r.categoryId === 'work')
    expect(work).toBeDefined()
    expect(work!.score).toBeCloseTo(0.15)
  })
})

// ─── computeTimeOfDayPrior (M-B3) ────────────────────────────────────────────

describe('computeTimeOfDayPrior', () => {
  function sessionAt(hour: number, categoryId: string) {
    const d = new Date(2026, 0, 1, hour, 0, 0)
    return { startedAt: d.getTime(), categoryId }
  }

  it('returns empty map when no sessions', () => {
    expect(computeTimeOfDayPrior([], 9)).toEqual(new Map())
  })

  it('returns empty map when no sessions at the given hour', () => {
    const sessions = [sessionAt(14, 'work'), sessionAt(14, 'work')]
    expect(computeTimeOfDayPrior(sessions, 9)).toEqual(new Map())
  })

  it('returns 1.0 for the only category at that hour', () => {
    const sessions = [sessionAt(9, 'work'), sessionAt(9, 'work'), sessionAt(9, 'work')]
    const prior = computeTimeOfDayPrior(sessions, 9)
    expect(prior.get('work')).toBeCloseTo(1.0)
  })

  it('returns proportional fractions for multiple categories', () => {
    const sessions = [
      sessionAt(9, 'work'), sessionAt(9, 'work'), sessionAt(9, 'work'),  // 3 work
      sessionAt(9, 'study'),                                               // 1 study
    ]
    const prior = computeTimeOfDayPrior(sessions, 9)
    expect(prior.get('work')).toBeCloseTo(0.75)
    expect(prior.get('study')).toBeCloseTo(0.25)
  })

  it('fractions sum to 1.0', () => {
    const sessions = [
      sessionAt(10, 'work'), sessionAt(10, 'study'), sessionAt(10, 'personal'),
    ]
    const prior = computeTimeOfDayPrior(sessions, 10)
    const sum = Array.from(prior.values()).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0)
  })

  it('ignores sessions from different hours', () => {
    const sessions = [sessionAt(8, 'personal'), sessionAt(9, 'work'), sessionAt(10, 'study')]
    const prior = computeTimeOfDayPrior(sessions, 9)
    expect(prior.size).toBe(1)
    expect(prior.get('work')).toBeCloseTo(1.0)
  })
})
