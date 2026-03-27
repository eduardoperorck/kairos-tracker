import type { WindowRule } from './passiveCapture'

// ─── extractDomainFromTitle ───────────────────────────────────────────────────

const BROWSER_PROCESSES = new Set([
  'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe',
  'arc.exe', 'opera.exe', 'vivaldi.exe',
])

const BROWSER_SUFFIXES = [
  ' - Google Chrome', ' - Microsoft Edge',
  ' — Mozilla Firefox', ' - Mozilla Firefox',
  ' - Brave', ' - Arc', ' - Opera', ' - Vivaldi',
]

function stripBrowserSuffix(title: string): string | null {
  for (const suffix of BROWSER_SUFFIXES) {
    if (title.endsWith(suffix)) return title.slice(0, title.length - suffix.length)
  }
  return null
}

function parseDomain(segment: string): string | null {
  const urlMatch = segment.match(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  if (urlMatch) return urlMatch[1].toLowerCase()
  const bareMatch = segment.match(/^([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\.[a-zA-Z]{2,})(?:\/|$)/)
  if (bareMatch) return bareMatch[1].toLowerCase()
  return null
}

const TITLE_DOMAIN_HINTS: Array<[pattern: string, domain: string]> = [
  ['github.com', 'github.com'], ['github', 'github.com'],
  ['gitlab.com', 'gitlab.com'], ['gitlab', 'gitlab.com'],
  ['stackoverflow.com', 'stackoverflow.com'], ['stack overflow', 'stackoverflow.com'],
  ['figma.com', 'figma.com'], ['figma', 'figma.com'],
  ['notion.so', 'notion.so'], ['notion', 'notion.so'],
  ['youtube.com', 'youtube.com'], ['youtube', 'youtube.com'],
  ['netflix.com', 'netflix.com'], ['netflix', 'netflix.com'],
  ['reddit.com', 'reddit.com'], ['reddit', 'reddit.com'],
  ['twitter.com', 'twitter.com'], ['x.com', 'x.com'],
  ['jira.atlassian.net', 'jira.atlassian.net'], ['jira', 'jira.atlassian.net'],
  ['linear.app', 'linear.app'], ['linear', 'linear.app'],
  ['vercel.com', 'vercel.com'], ['netlify.com', 'netlify.com'],
  ['docs.google.com', 'docs.google.com'], ['google docs', 'docs.google.com'],
  ['google sheets', 'sheets.google.com'], ['google slides', 'slides.google.com'],
  ['coursera.org', 'coursera.org'], ['coursera', 'coursera.org'],
  ['udemy.com', 'udemy.com'], ['udemy', 'udemy.com'],
  ['mdn web docs', 'developer.mozilla.org'],
]

const SKIP_TITLES = new Set(['new tab', 'newtab', ''])

export function extractDomainFromTitle(title: string, process: string): string | null {
  if (!BROWSER_PROCESSES.has(process.toLowerCase())) return null
  const stripped = stripBrowserSuffix(title) ?? title
  const strippedLower = stripped.trim().toLowerCase()
  if (SKIP_TITLES.has(strippedLower)) return null

  const direct = parseDomain(stripped.trim())
  if (direct) return direct

  const urlMatch = stripped.match(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  if (urlMatch) return urlMatch[1].toLowerCase()

  for (const [pattern, domain] of TITLE_DOMAIN_HINTS) {
    if (strippedLower.includes(pattern)) return domain
  }
  return null
}

// ─── extractVsCodeWorkspace (M-A4) ──────────────────────────────────────────

const VSCODE_PROCESSES = new Set(['code.exe', 'code - insiders.exe', 'cursor.exe'])

const VSCODE_SUFFIXES = [
  ' — Visual Studio Code - Insiders',
  ' — Visual Studio Code',
  ' - Visual Studio Code',
  ' — Cursor',
  ' - Cursor',
]

/**
 * Parses the active workspace/folder name from a VS Code or Cursor window title.
 * Returns null when no workspace can be determined (welcome screen, single file, etc.).
 *
 * VS Code title formats:
 *   "file.ts — workspace — Visual Studio Code"     → "workspace"
 *   "workspace — Visual Studio Code"               → "workspace"
 *   "file.ts — Visual Studio Code"                 → null (single file, no workspace)
 *   "Visual Studio Code"                            → null
 */
export function extractVsCodeWorkspace(title: string, process: string): string | null {
  if (!VSCODE_PROCESSES.has(process.toLowerCase())) return null

  let stripped = title
  for (const suffix of VSCODE_SUFFIXES) {
    if (title.endsWith(suffix)) {
      stripped = title.slice(0, title.length - suffix.length)
      break
    }
  }
  if (stripped === title) return null  // no VS Code suffix matched

  // Strip unsaved-file indicator (● or •)
  stripped = stripped.replace(/^[●•]\s*/, '').trim()

  const parts = stripped.split(' — ')

  if (parts.length >= 2) {
    // Last segment is the workspace name
    return parts[parts.length - 1].trim() || null
  }

  // Some VS Code versions (or WSL) use " - " (hyphen) instead of " — " (em-dash).
  // e.g. "file.ts - workspace - Visual Studio Code" → stripped = "file.ts - workspace"
  const hyphenParts = stripped.split(' - ')
  if (hyphenParts.length >= 2) {
    return hyphenParts[hyphenParts.length - 1].trim() || null
  }

  // Single segment: workspace only if it has no file extension and is not "Untitled-N"
  const single = parts[0].trim()
  if (!single) return null
  if (/^Untitled-\d+$/.test(single)) return null
  if (/\.\w{1,6}$/.test(single)) return null  // looks like a filename
  return single
}

/**
 * Extracts the project folder name from a full file path.
 * Used when VS Code has no formal workspace open but a file path is available.
 *
 * Examples:
 *   "C:\Projects\my-project\src\App.tsx"  → "my-project"
 *   "/home/user/projects/my-app/index.ts" → "my-app"
 *   "App.tsx"                              → null
 */
const GENERIC_FOLDERS = new Set([
  'src', 'lib', 'dist', 'build', 'out', 'public', 'static',
  'components', 'pages', 'app', 'test', 'tests', '__tests__',
  'Desktop', 'Downloads', 'Documents', 'Users', 'home', 'tmp',
])

/**
 * If a workspace string looks like "filename.ext - FolderName" (e.g. from VS Code title
 * when no workspace is open), strips the filename prefix and returns just the folder name.
 *
 * Example: "ux_analysis.md - Productivity Challenge" → "Productivity Challenge"
 */
export function stripFileFromWorkspaceName(ws: string): string {
  const idx = ws.indexOf(' - ')
  if (idx === -1) return ws
  const before = ws.slice(0, idx)
  // Only strip if the part before " - " looks like a filename (has a file extension)
  if (/\.\w{1,6}$/.test(before.trim())) {
    return ws.slice(idx + 3).trim()
  }
  return ws
}

export function workspaceFolderFromFilePath(filePath: string): string | null {
  if (!filePath) return null
  // Normalise Windows and Unix separators; drop the filename (last segment)
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
  // Walk parent folders from closest to farthest, skipping generic names
  // e.g. project/src/components/App.tsx → skip "components", skip "src", return "project"
  for (let i = parts.length - 2; i >= 0; i--) {
    const folder = parts[i]
    // Skip volume letters like "C:" on Windows
    if (/^\w:$/.test(folder)) break
    if (!GENERIC_FOLDERS.has(folder)) return folder
  }
  return null
}

// ─── Scoring engine (M-A2 + M-A3) ───────────────────────────────────────────

export type SignalSet = {
  process: string
  title: string
  domain: string | null
  vsWorkspace: string | null
  inputRate: 'high' | 'low' | 'none'
}

export type DomainRule = {
  id: string
  domain: string      // exact domain, e.g. "github.com"
  categoryId: string  // the category this domain maps to
}

/** Minimum score to auto-switch category silently. */
export const SCORE_THRESHOLD_AUTO = 0.70
/** Minimum score to surface a suggestion to the user. */
export const SCORE_THRESHOLD_SUGGEST = 0.40

// Signal weights
const W_PROCESS_AUTO    = 0.50
const W_PROCESS_SUGGEST = 0.30
const W_TITLE_AUTO      = 0.20
const W_TITLE_SUGGEST   = 0.12
const W_DOMAIN          = 0.20
const W_WORKSPACE       = 0.15
const W_INPUT_HIGH      = 0.10
const W_HYSTERESIS      = 0.15

/**
 * Multi-signal confidence scorer.
 *
 * Aggregates weighted signals from process rules, title rules, domain rules,
 * and VS Code workspace into a per-category confidence score (0..1).
 *
 * - `activeCategoryId`: when provided, that category receives a +0.15 hysteresis
 *   bonus to prevent noisy switching while a session is in progress.
 *
 * Returns results sorted descending by score.
 */
export function scoreWindow(
  signals: SignalSet,
  windowRules: WindowRule[],
  domainRules: DomainRule[],
  activeCategoryId?: string,
): Array<{ categoryId: string; score: number }> {
  const scores = new Map<string, number>()

  const add = (categoryId: string, weight: number) => {
    scores.set(categoryId, Math.min(1.0, (scores.get(categoryId) ?? 0) + weight))
  }

  // Process rules
  const procLower = signals.process.toLowerCase()
  for (const rule of windowRules) {
    if (!rule.enabled || !rule.categoryId || rule.mode === 'ignore') continue
    if (rule.matchType !== 'process') continue
    if (rule.pattern.toLowerCase() !== procLower) continue
    add(rule.categoryId, rule.mode === 'auto' ? W_PROCESS_AUTO : W_PROCESS_SUGGEST)
  }

  // Title rules
  const titleLower = signals.title.toLowerCase()
  for (const rule of windowRules) {
    if (!rule.enabled || !rule.categoryId || rule.mode === 'ignore') continue
    if (rule.matchType !== 'title') continue
    if (!titleLower.includes(rule.pattern.toLowerCase())) continue
    add(rule.categoryId, rule.mode === 'auto' ? W_TITLE_AUTO : W_TITLE_SUGGEST)
  }

  // Domain rules
  if (signals.domain) {
    const d = signals.domain.toLowerCase()
    for (const dr of domainRules) {
      if (d === dr.domain || d.endsWith('.' + dr.domain)) {
        add(dr.categoryId, W_DOMAIN)
      }
    }
  }

  // VS Code workspace — exact workspace rules get process-level weight;
  // title rules that happen to match the workspace name keep the lower W_WORKSPACE weight
  if (signals.vsWorkspace) {
    const wsLower = signals.vsWorkspace.toLowerCase()
    for (const rule of windowRules) {
      if (!rule.enabled || !rule.categoryId || rule.mode === 'ignore') continue
      if (rule.matchType === 'workspace') {
        if (wsLower === rule.pattern.toLowerCase()) {
          add(rule.categoryId, rule.mode === 'auto' ? W_PROCESS_AUTO : W_PROCESS_SUGGEST)
        }
      } else if (rule.matchType === 'title') {
        if (wsLower.includes(rule.pattern.toLowerCase())) {
          add(rule.categoryId, W_WORKSPACE)
        }
      }
    }
  }

  // High input rate boosts the current leader
  if (signals.inputRate === 'high' && scores.size > 0) {
    let topCat = ''
    let topScore = -1
    for (const [cat, score] of scores) {
      if (score > topScore) { topScore = score; topCat = cat }
    }
    if (topCat) add(topCat, W_INPUT_HIGH)
  }

  // Hysteresis: bonus for the currently active category (M-A3)
  if (activeCategoryId) {
    const current = scores.get(activeCategoryId) ?? 0
    scores.set(activeCategoryId, Math.min(1.0, current + W_HYSTERESIS))
  }

  return Array.from(scores.entries())
    .map(([categoryId, score]) => ({ categoryId, score }))
    .sort((a, b) => b.score - a.score)
}

// ─── M-B3: Time-of-day prior ─────────────────────────────────────────────────

/**
 * Computes a time-of-day category prior from historical sessions.
 *
 * Returns a map of categoryId → fraction (0..1) representing how often
 * that category was active during `hourNow` across all historical sessions.
 * The fractions sum to 1.0 (or 0 if no data for that hour).
 *
 * Use with a small weight (e.g. 0.05) when incorporating into scoreWindow.
 */
export function computeTimeOfDayPrior(
  sessions: ReadonlyArray<{ startedAt: number; categoryId: string }>,
  hourNow: number = new Date().getHours(),
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const s of sessions) {
    if (new Date(s.startedAt).getHours() !== hourNow) continue
    counts.set(s.categoryId, (counts.get(s.categoryId) ?? 0) + 1)
  }

  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0)
  if (total === 0) return new Map()

  const prior = new Map<string, number>()
  for (const [cat, count] of counts) {
    prior.set(cat, count / total)
  }
  return prior
}
