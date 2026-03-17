// Heuristic session naming from window titles.
// If a Claude API key is present, callers may use the Claude API externally.
// This module provides the pure heuristic fallback — no network calls.

const IGNORED_TITLES = new Set([
  '',
  'program manager',
  'task manager',
  'settings',
  'start',
  'desktop',
])

const APP_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /visual studio code|vscode/i, label: 'Coding' },
  { pattern: /github|gitlab|bitbucket/i, label: 'Code Review' },
  { pattern: /figma|sketch|adobe xd/i, label: 'Design' },
  { pattern: /slack|teams|discord|zoom|meet/i, label: 'Communication' },
  { pattern: /notion|obsidian|roam|logseq/i, label: 'Notes' },
  { pattern: /chrome|firefox|safari|edge/i, label: 'Browsing' },
  { pattern: /terminal|cmd|powershell|bash/i, label: 'Terminal' },
  { pattern: /word|excel|sheets|docs|spreadsheet/i, label: 'Documents' },
  { pattern: /jira|linear|trello|asana/i, label: 'Project Management' },
]

export function suggestSessionName(titles: string[]): string {
  const filtered = titles
    .map(t => t.trim())
    .filter(t => !IGNORED_TITLES.has(t.toLowerCase()) && t.length > 0)

  if (filtered.length === 0) return 'Session'

  // Count frequency of each title
  const freq = new Map<string, number>()
  for (const title of filtered) {
    freq.set(title, (freq.get(title) ?? 0) + 1)
  }

  // Most frequent title
  const mostFrequent = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]

  // Check app patterns
  for (const { pattern, label } of APP_PATTERNS) {
    if (pattern.test(mostFrequent)) return label
  }

  // Truncate long titles
  if (mostFrequent.length > 40) return mostFrequent.slice(0, 37) + '…'
  return mostFrequent
}

export function buildNamingPrompt(titles: string[], categoryName: string): string {
  const uniqueTitles = [...new Set(titles)].slice(0, 10)
  return JSON.stringify({
    task: 'Suggest a short session name (2-4 words) based on these window titles',
    category: categoryName,
    titles: uniqueTitles,
    constraint: 'Return only the name, nothing else.',
  })
}
