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

// Labels are i18n keys — components resolve via t(label as TKey)
const APP_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /visual studio code|vscode/i, label: 'sessionTag.coding' },
  { pattern: /github|gitlab|bitbucket/i,   label: 'sessionTag.codeReview' },
  { pattern: /figma|sketch|adobe xd/i,     label: 'sessionTag.design' },
  { pattern: /slack|teams|discord|zoom|meet/i, label: 'sessionTag.communication' },
  { pattern: /notion|obsidian|roam|logseq/i,   label: 'sessionTag.notes' },
  { pattern: /chrome|firefox|safari|edge/i,    label: 'sessionTag.browsing' },
  { pattern: /terminal|cmd|powershell|bash/i,  label: 'sessionTag.terminal' },
  { pattern: /word|excel|sheets|docs|spreadsheet/i, label: 'sessionTag.documents' },
  { pattern: /jira|linear|trello|asana/i,      label: 'sessionTag.projectManagement' },
]

export function suggestSessionName(titles: string[]): string {
  const filtered = titles
    .map(t => t.trim())
    .filter(t => !IGNORED_TITLES.has(t.toLowerCase()) && t.length > 0)

  if (filtered.length === 0) return 'sessionTag.session'

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

// Ordered extraction rules — first match wins.
const TAG_EXTRACTORS: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => string }> = [
  // VSCode / Cursor: "filename — repo-name — Visual Studio Code"
  {
    pattern: /—\s+([^—]+?)\s+—\s+(?:Visual Studio Code|Cursor)\s*$/i,
    extract: m => m[1].trim(),
  },
  // Linear: "PC-42 Issue title — Linear"
  {
    pattern: /^([A-Z]{1,8}-\d+)\s+.+—\s+Linear\s*$/i,
    extract: m => m[1].toUpperCase(),
  },
  // Jira: "PROJ-1234 Title - Jira"
  {
    pattern: /^([A-Z]{1,8}-\d+)\s+/,
    extract: m => m[1].toUpperCase(),
  },
  // GitHub PR: "title #N · Pull Request"
  {
    pattern: /#(\d+)\s*[·•]\s*Pull Request/i,
    extract: m => `PR #${m[1]}`,
  },
  // GitHub repo: "org/repo-name: ..." or "org/repo-name — GitHub"
  {
    pattern: /[\w.-]+\/([\w.-]+?)(?::\s|—|\s*·)/,
    extract: m => m[1].trim(),
  },
]

export function suggestSessionTag(titles: string[]): string | null {
  for (const title of titles) {
    for (const { pattern, extract } of TAG_EXTRACTORS) {
      const m = title.match(pattern)
      if (m) return extract(m)
    }
  }
  return null
}

export function buildNamingPrompt(titles: string[], categoryName: string, lang: 'en' | 'pt' = 'en'): string {
  const uniqueTitles = [...new Set(titles)].slice(0, 10)
  return JSON.stringify({
    task: lang === 'pt'
      ? 'Sugira um nome curto (2-4 palavras) em português para esta sessão de trabalho'
      : 'Suggest a short session name (2-4 words) based on these window titles',
    category: categoryName,
    titles: uniqueTitles,
    constraint: lang === 'pt'
      ? 'Responda APENAS o nome, nada mais. Em português.'
      : 'Return only the name, nothing else.',
  })
}
