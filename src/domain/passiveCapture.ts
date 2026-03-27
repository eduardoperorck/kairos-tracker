export type WindowRule = {
  id: string
  matchType: 'process' | 'title' | 'workspace'
  pattern: string
  categoryId: string | null
  tag?: string
  mode: 'auto' | 'suggest' | 'ignore'
  enabled: boolean
  /** Task 7: when true, this rule auto-switches the active timer on match (no confirm needed) */
  autoSwitch?: boolean
}

export type ActiveWindow = {
  title: string
  process: string
  timestamp: number
  vsWorkspace?: string | null
}

export type CaptureBlock = {
  process: string
  title: string
  domain?: string | null
  startedAt: number
  endedAt: number
  categoryId: string | null
  tag?: string
  confirmed: boolean
}

/** Maps known executable names (lowercase) to their friendly product names. */
export const PROCESS_FRIENDLY_NAMES: Record<string, string> = {
  'code.exe': 'Visual Studio Code',
  'code - insiders.exe': 'VS Code Insiders',
  'cursor.exe': 'Cursor',
  'devenv.exe': 'Visual Studio',
  'idea64.exe': 'IntelliJ IDEA',
  'pycharm64.exe': 'PyCharm',
  'webstorm64.exe': 'WebStorm',
  'datagrip64.exe': 'DataGrip',
  'rider64.exe': 'Rider',
  'chrome.exe': 'Google Chrome',
  'msedge.exe': 'Microsoft Edge',
  'firefox.exe': 'Firefox',
  'brave.exe': 'Brave Browser',
  'arc.exe': 'Arc',
  'opera.exe': 'Opera',
  'vivaldi.exe': 'Vivaldi',
  'slack.exe': 'Slack',
  'discord.exe': 'Discord',
  'teams.exe': 'Microsoft Teams',
  'zoom.exe': 'Zoom',
  'notion.exe': 'Notion',
  'obsidian.exe': 'Obsidian',
  'figma.exe': 'Figma',
  'postman.exe': 'Postman',
  'insomnia.exe': 'Insomnia',
  'spotify.exe': 'Spotify',
  'windowsterminal.exe': 'Windows Terminal',
  'wt.exe': 'Windows Terminal',
  'powershell.exe': 'PowerShell',
  'cmd.exe': 'Command Prompt',
  'wezterm-gui.exe': 'WezTerm',
  'alacritty.exe': 'Alacritty',
  'explorer.exe': 'File Explorer',
  'excel.exe': 'Microsoft Excel',
  'winword.exe': 'Microsoft Word',
  'powerpnt.exe': 'PowerPoint',
  'outlook.exe': 'Outlook',
  'onenote.exe': 'OneNote',
  'notepad.exe': 'Notepad',
  'notepad++.exe': 'Notepad++',
  'sublimetext.exe': 'Sublime Text',
  'gitkraken.exe': 'GitKraken',
  'sourcetree.exe': 'Sourcetree',
  'docker desktop.exe': 'Docker Desktop',
  'dbeaver.exe': 'DBeaver',
  'tableplus.exe': 'TablePlus',
}

/**
 * Extracts the application name from a window title.
 * Many apps put their name at the end: "file.ts — workspace — Visual Studio Code"
 * or "Settings - My App". Returns null if nothing useful can be extracted.
 */
export function extractAppNameFromTitle(title: string): string | null {
  if (!title) return null
  // Try em-dash separator — common in VS Code, JetBrains, etc.
  const emParts = title.split(' — ')
  if (emParts.length >= 2) {
    const last = emParts[emParts.length - 1].trim()
    if (last && !/\.(ts|tsx|js|jsx|py|md|txt|json|html|css|rs|go|java)$/i.test(last)) return last
  }
  // Try hyphen separator " - " — common on Windows apps
  const hyphenParts = title.split(' - ')
  if (hyphenParts.length >= 2) {
    const last = hyphenParts[hyphenParts.length - 1].trim()
    if (last && !/\.(ts|tsx|js|jsx|py|md|txt|json|html|css|rs|go|java)$/i.test(last)) return last
  }
  // Single-word title with no separators (e.g. "Slack", "Discord")
  if (!/[\s—\-]/.test(title) && title.length > 2) return title
  return null
}

/** Returns the friendly display name for a process, falling back gracefully.
 * Handles processes reported with or without the `.exe` extension.
 * Also accepts a window title to extract the app name as a last resort. */
export function getFriendlyProcessName(process: string, displayName?: string, title?: string): string {
  const lower = process.toLowerCase()
  // Try exact match, then with .exe appended, then without .exe suffix
  const friendly = PROCESS_FRIENDLY_NAMES[lower]
    ?? PROCESS_FRIENDLY_NAMES[lower.endsWith('.exe') ? lower : lower + '.exe']
    ?? PROCESS_FRIENDLY_NAMES[lower.replace(/\.exe$/, '')]
  if (friendly) return friendly
  // Use OS display_name if it differs meaningfully from the process name
  const exeStem = process.replace(/\.exe$/i, '')
  if (displayName && displayName.toLowerCase() !== lower && displayName !== exeStem) return displayName
  // Last resort: extract from window title
  if (title) {
    const fromTitle = extractAppNameFromTitle(title)
    if (fromTitle && fromTitle.toLowerCase() !== lower && fromTitle !== exeStem) return fromTitle
  }
  return exeStem
}

export type RawPollEvent = {
  window: ActiveWindow
  domain?: string | null
  timestamp: number
}

export function matchRule(window: ActiveWindow, rules: WindowRule[]): WindowRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.matchType === 'process') {
      if (window.process.toLowerCase() === rule.pattern.toLowerCase()) return rule
    } else if (rule.matchType === 'title') {
      if (window.title.toLowerCase().includes(rule.pattern.toLowerCase())) return rule
    } else if (rule.matchType === 'workspace') {
      if (window.vsWorkspace && window.vsWorkspace.toLowerCase() === rule.pattern.toLowerCase()) return rule
    }
  }
  return null
}

/**
 * Returns true when the VS Code workspace should be shown to the user for
 * category assignment — i.e. no rule (auto, suggest, or ignore) covers it yet.
 */
export function needsWorkspaceClassification(workspace: string, rules: WindowRule[]): boolean {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.matchType !== 'workspace') continue
    if (rule.pattern.toLowerCase() === workspace.toLowerCase()) return false
  }
  return true
}

const MIN_BLOCK_MS = 30_000 // 30 seconds minimum

/** M84: Returns the most frequent (mode) value from a frequency map. Ties broken by insertion order. */
function modeFromCounts(counts: Map<string, number>): string {
  let best = ''
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      best = value
    }
  }
  return best
}

export function aggregateBlocks(events: RawPollEvent[], rules: WindowRule[]): CaptureBlock[] {
  if (events.length === 0) return []
  const blocks: CaptureBlock[] = []
  let currentProcess = events[0].window.process
  // M84: track title frequency within each block to use mode instead of last title
  let titleCounts = new Map<string, number>([[events[0].window.title, 1]])
  let currentDomain = events[0].domain ?? null
  let blockStart = events[0].timestamp
  let lastTimestamp = events[0].timestamp

  for (let i = 1; i < events.length; i++) {
    const ev = events[i]
    if (ev.window.process !== currentProcess) {
      // End current block — use mode title for classification
      const duration = lastTimestamp - blockStart
      if (duration >= MIN_BLOCK_MS) {
        const modeTitle = modeFromCounts(titleCounts)
        const fakeWindow = { title: modeTitle, process: currentProcess, timestamp: blockStart }
        const rule = matchRule(fakeWindow, rules)
        blocks.push({
          process: currentProcess,
          title: modeTitle,
          domain: currentDomain,
          startedAt: blockStart,
          endedAt: lastTimestamp,
          categoryId: rule?.categoryId ?? null,
          tag: rule?.tag,
          confirmed: rule?.mode === 'auto',
        })
      }
      currentProcess = ev.window.process
      titleCounts = new Map([[ev.window.title, 1]])
      currentDomain = ev.domain ?? null
      blockStart = ev.timestamp
    } else {
      // M84: increment frequency count for this title
      titleCounts.set(ev.window.title, (titleCounts.get(ev.window.title) ?? 0) + 1)
      if (ev.domain) currentDomain = ev.domain
    }
    lastTimestamp = ev.timestamp
  }
  // Close last block
  const duration = lastTimestamp - blockStart
  if (duration >= MIN_BLOCK_MS) {
    const modeTitle = modeFromCounts(titleCounts)
    const fakeWindow = { title: modeTitle, process: currentProcess, timestamp: blockStart }
    const rule = matchRule(fakeWindow, rules)
    blocks.push({
      process: currentProcess,
      title: modeTitle,
      domain: currentDomain,
      startedAt: blockStart,
      endedAt: lastTimestamp,
      categoryId: rule?.categoryId ?? null,
      tag: rule?.tag,
      confirmed: rule?.mode === 'auto',
    })
  }
  return blocks
}

/**
 * Returns true when the process should be shown to the user for classification.
 * A process is considered unclassified if no enabled rule maps it to a category
 * or explicitly ignores it. Rules with mode:'suggest' and categoryId:null count
 * as "known but unclassified" and still need user assignment.
 */
export function needsClassification(proc: string, rules: WindowRule[]): boolean {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.matchType !== 'process') continue
    if (rule.pattern.toLowerCase() !== proc.toLowerCase()) continue
    if (rule.mode === 'ignore' || rule.categoryId !== null) return false
  }
  return true
}

/**
 * Rich info about an unclassified process shown in the classification prompt.
 * `process` is the exe name used for rule matching; `displayName` is the
 * human-readable product name returned by the OS (e.g. "Google Chrome").
 */
export type UnclassifiedApp = {
  process: string
  displayName: string
  /** Window title — used in the classify overlay for additional context */
  title?: string
  iconBase64?: string
}

/**
 * Returns the categoryId to auto-start when the given window is active,
 * or null if no auto rule matches. Only rules with mode:'auto' and a
 * non-null categoryId trigger auto-start.
 */
export function getAutoStartCategory(
  win: Pick<ActiveWindow, 'process' | 'title'>,
  rules: WindowRule[]
): string | null {
  const rule = matchRule({ ...win, timestamp: 0 }, rules)
  return (rule?.mode === 'auto' && rule.categoryId) ? rule.categoryId : null
}

export function pendingSuggestions(blocks: CaptureBlock[]): CaptureBlock[] {
  return blocks.filter(b => !b.confirmed && b.categoryId !== null)
}

// ─── detectDistractionApps ───────────────────────────────────────────────────

export type DistractionApp = {
  process: string
  visitCount: number
  avgDurationMs: number
  totalMs: number
}

/**
 * Identifies apps where the user frequently visits but never stays more than
 * `shortBlockMs` continuously — a signal for context-switching / distraction.
 * Requires at least 7 days of data (checked by caller via date span).
 */
export function detectDistractionApps(
  blocks: CaptureBlock[],
  shortBlockMs = 5 * 60_000, // 5 minutes
  minVisits = 5,
): DistractionApp[] {
  const stats = new Map<string, { count: number; shortCount: number; totalMs: number }>()

  for (const b of blocks) {
    const dur = b.endedAt - b.startedAt
    const existing = stats.get(b.process) ?? { count: 0, shortCount: 0, totalMs: 0 }
    stats.set(b.process, {
      count: existing.count + 1,
      shortCount: existing.shortCount + (dur < shortBlockMs ? 1 : 0),
      totalMs: existing.totalMs + dur,
    })
  }

  const result: DistractionApp[] = []
  for (const [process, s] of stats.entries()) {
    if (s.count < minVisits) continue
    // Distraction: >70% of visits are short
    if (s.shortCount / s.count < 0.7) continue
    result.push({
      process,
      visitCount: s.count,
      avgDurationMs: Math.round(s.totalMs / s.count),
      totalMs: s.totalMs,
    })
  }

  return result.sort((a, b) => b.visitCount - a.visitCount)
}

// ─── computeCaptureRatio ─────────────────────────────────────────────────────

import type { Session } from './timer'

/**
 * Returns the fraction of sessions (0–1) that overlap with at least one
 * passive-capture block.  Used to surface a "passive capture inactive" notice.
 */
export function computeCaptureRatio(
  sessions: { startedAt: number; endedAt: number }[],
  blocks: CaptureBlock[]
): number {
  if (sessions.length === 0) return 0
  const coveredCount = sessions.filter(s =>
    blocks.some(b => b.startedAt < s.endedAt && b.endedAt > s.startedAt)
  ).length
  return coveredCount / sessions.length
}

// ─── computeTrackingAccuracy ─────────────────────────────────────────────────

export type TrackingAccuracyScore = {
  autoAccuracy: number    // % auto-classified blocks never overridden by user
  coverage: number        // % of tracked time covered by auto rules
  stabilityScore: number  // avg session duration normalised to 0–100 (60 min = 100)
  noiseRatio: number      // sessions < 2 min / total sessions
  weeklyTAS: number       // composite score
}

export function computeTrackingAccuracy(
  sessions: Session[],
  blocks: CaptureBlock[]
): TrackingAccuracyScore {
  const totalSessions = sessions.length
  if (totalSessions === 0) {
    return { autoAccuracy: 0, coverage: 0, stabilityScore: 0, noiseRatio: 0, weeklyTAS: 0 }
  }

  // autoAccuracy: confirmed blocks / total blocks
  const confirmedBlocks = blocks.filter(b => b.confirmed).length
  const autoAccuracy = blocks.length > 0 ? (confirmedBlocks / blocks.length) * 100 : 100

  // coverage: % of session time that has overlapping capture blocks
  const totalMs = sessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
  const coveredMs = sessions.reduce((sum, s) => {
    const hasBlock = blocks.some(b => b.startedAt < s.endedAt && b.endedAt > s.startedAt)
    return sum + (hasBlock ? (s.endedAt - s.startedAt) : 0)
  }, 0)
  const coverage = totalMs > 0 ? (coveredMs / totalMs) * 100 : 0

  // stabilityScore: avg session duration (in minutes) normalised — 60 min = 100
  const avgDurationMs = totalMs / totalSessions
  /** A 60-minute average session is considered fully stable (score = 100) */
  const STABILITY_ANCHOR_MS = 60 * 60_000
  const stabilityScore = Math.min(100, (avgDurationMs / STABILITY_ANCHOR_MS) * 100)

  // noiseRatio: sessions < 2 min / total sessions
  const noisySessions = sessions.filter(s => (s.endedAt - s.startedAt) < 2 * 60_000).length
  const noiseRatio = noisySessions / totalSessions

  const weeklyTAS = Math.round(
    autoAccuracy * 0.4 +
    coverage * 0.3 +
    stabilityScore * 0.2 +
    (1 - noiseRatio) * 100 * 0.1
  )

  return { autoAccuracy, coverage, stabilityScore, noiseRatio, weeklyTAS }
}

export const DEFAULT_DEV_RULES: WindowRule[] = [
  // ── Editors & IDEs ────────────────────────────────────────────────────────
  { id: 'vscode',      matchType: 'process', pattern: 'Code.exe',          categoryId: null, mode: 'suggest', enabled: true },
  { id: 'vscode-ins',  matchType: 'process', pattern: 'Code - Insiders.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'idea',        matchType: 'process', pattern: 'idea64.exe',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'webstorm',    matchType: 'process', pattern: 'webstorm64.exe',     categoryId: null, mode: 'suggest', enabled: true },
  { id: 'pycharm',     matchType: 'process', pattern: 'pycharm64.exe',      categoryId: null, mode: 'suggest', enabled: true },
  { id: 'rider',       matchType: 'process', pattern: 'rider64.exe',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'clion',       matchType: 'process', pattern: 'clion64.exe',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'goland',      matchType: 'process', pattern: 'goland64.exe',       categoryId: null, mode: 'suggest', enabled: true },
  { id: 'rustrover',   matchType: 'process', pattern: 'rustrover64.exe',    categoryId: null, mode: 'suggest', enabled: true },
  { id: 'sublimetext', matchType: 'process', pattern: 'sublime_text.exe',   categoryId: null, mode: 'suggest', enabled: true },
  { id: 'notepadpp',   matchType: 'process', pattern: 'notepad++.exe',      categoryId: null, mode: 'suggest', enabled: true },
  { id: 'vim',         matchType: 'process', pattern: 'vim.exe',            categoryId: null, mode: 'suggest', enabled: true },
  { id: 'neovim',      matchType: 'process', pattern: 'nvim.exe',           categoryId: null, mode: 'suggest', enabled: true },
  { id: 'cursor',      matchType: 'process', pattern: 'Cursor.exe',         categoryId: null, mode: 'suggest', enabled: true },

  // ── Terminals ─────────────────────────────────────────────────────────────
  { id: 'terminal',    matchType: 'process', pattern: 'WindowsTerminal.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'cmd',         matchType: 'process', pattern: 'cmd.exe',             categoryId: null, mode: 'suggest', enabled: true },
  { id: 'powershell',  matchType: 'process', pattern: 'powershell.exe',      categoryId: null, mode: 'suggest', enabled: true },
  { id: 'pwsh',        matchType: 'process', pattern: 'pwsh.exe',            categoryId: null, mode: 'suggest', enabled: true },
  { id: 'gitbash',     matchType: 'process', pattern: 'bash.exe',            categoryId: null, mode: 'suggest', enabled: true },
  { id: 'wezterm',     matchType: 'process', pattern: 'wezterm-gui.exe',     categoryId: null, mode: 'suggest', enabled: true },
  { id: 'alacritty',   matchType: 'process', pattern: 'Alacritty.exe',       categoryId: null, mode: 'suggest', enabled: true },

  // ── Browsers (suggest, not ignore — they often mean real work) ────────────
  { id: 'chrome',      matchType: 'process', pattern: 'chrome.exe',          categoryId: null, mode: 'suggest', enabled: true },
  { id: 'firefox',     matchType: 'process', pattern: 'firefox.exe',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'edge',        matchType: 'process', pattern: 'msedge.exe',          categoryId: null, mode: 'suggest', enabled: true },
  { id: 'brave',       matchType: 'process', pattern: 'brave.exe',           categoryId: null, mode: 'suggest', enabled: true },
  { id: 'arc',         matchType: 'process', pattern: 'Arc.exe',             categoryId: null, mode: 'suggest', enabled: true },

  // ── Communication & Meetings ──────────────────────────────────────────────
  { id: 'zoom',        matchType: 'process', pattern: 'Zoom.exe',            categoryId: null, tag: 'meeting', mode: 'suggest', enabled: true },
  { id: 'teams',       matchType: 'process', pattern: 'Teams.exe',           categoryId: null, tag: 'meeting', mode: 'suggest', enabled: true },
  { id: 'slack',       matchType: 'process', pattern: 'Slack.exe',           categoryId: null, tag: 'admin',   mode: 'suggest', enabled: true },
  { id: 'discord',     matchType: 'process', pattern: 'Discord.exe',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'telegram',    matchType: 'process', pattern: 'Telegram.exe',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'whatsapp',    matchType: 'process', pattern: 'WhatsApp.exe',        categoryId: null, tag: 'admin',   mode: 'suggest', enabled: true },
  { id: 'outlook',     matchType: 'process', pattern: 'OUTLOOK.EXE',         categoryId: null, tag: 'admin',   mode: 'suggest', enabled: true },
  { id: 'thunderbird', matchType: 'process', pattern: 'thunderbird.exe',     categoryId: null, tag: 'admin',   mode: 'suggest', enabled: true },
  { id: 'meet-title',  matchType: 'title',   pattern: 'Google Meet',         categoryId: null, tag: 'meeting', mode: 'suggest', enabled: true },
  { id: 'webex-title', matchType: 'title',   pattern: 'Webex',               categoryId: null, tag: 'meeting', mode: 'suggest', enabled: true },
  { id: 'loom',        matchType: 'process', pattern: 'Loom.exe',            categoryId: null, mode: 'suggest', enabled: true },

  // ── Design & Creative ─────────────────────────────────────────────────────
  { id: 'figma',       matchType: 'process', pattern: 'Figma.exe',           categoryId: null, mode: 'suggest', enabled: true },
  { id: 'figma-title', matchType: 'title',   pattern: 'Figma',               categoryId: null, mode: 'suggest', enabled: true },
  { id: 'photoshop',   matchType: 'process', pattern: 'Photoshop.exe',       categoryId: null, mode: 'suggest', enabled: true },
  { id: 'illustrator', matchType: 'process', pattern: 'Illustrator.exe',     categoryId: null, mode: 'suggest', enabled: true },
  { id: 'xd',          matchType: 'process', pattern: 'Adobe XD.exe',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'canva-title', matchType: 'title',   pattern: 'Canva',               categoryId: null, mode: 'suggest', enabled: true },
  { id: 'affinity',    matchType: 'process', pattern: 'Affinity Designer.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'blender',     matchType: 'process', pattern: 'blender.exe',         categoryId: null, mode: 'suggest', enabled: true },

  // ── Office & Docs ─────────────────────────────────────────────────────────
  { id: 'word',        matchType: 'process', pattern: 'WINWORD.EXE',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'excel',       matchType: 'process', pattern: 'EXCEL.EXE',           categoryId: null, mode: 'suggest', enabled: true },
  { id: 'powerpoint',  matchType: 'process', pattern: 'POWERPNT.EXE',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'notion-title', matchType: 'title',  pattern: 'Notion',              categoryId: null, mode: 'suggest', enabled: true },
  { id: 'obsidian',    matchType: 'process', pattern: 'Obsidian.exe',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'onenote',     matchType: 'process', pattern: 'ONENOTE.EXE',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'gdocs-title', matchType: 'title',   pattern: 'Google Docs',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'gsheets-title', matchType: 'title', pattern: 'Google Sheets',       categoryId: null, mode: 'suggest', enabled: true },

  // ── Dev Tools & Productivity ──────────────────────────────────────────────
  { id: 'postman',     matchType: 'process', pattern: 'Postman.exe',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'insomnia',    matchType: 'process', pattern: 'Insomnia.exe',        categoryId: null, mode: 'suggest', enabled: true },
  { id: 'dbeaver',     matchType: 'process', pattern: 'dbeaver.exe',         categoryId: null, mode: 'suggest', enabled: true },
  { id: 'tableplus',   matchType: 'process', pattern: 'TablePlus.exe',       categoryId: null, mode: 'suggest', enabled: true },
  { id: 'docker',      matchType: 'process', pattern: 'Docker Desktop.exe',  categoryId: null, mode: 'suggest', enabled: true },
  { id: 'sourcetree',  matchType: 'process', pattern: 'SourceTree.exe',      categoryId: null, mode: 'suggest', enabled: true },
  { id: 'gitkraken',   matchType: 'process', pattern: 'GitKraken.exe',       categoryId: null, mode: 'suggest', enabled: true },
  { id: 'linear-title', matchType: 'title',  pattern: 'Linear',              categoryId: null, mode: 'suggest', enabled: true },
  { id: 'jira-title',  matchType: 'title',   pattern: 'Jira',                categoryId: null, mode: 'suggest', enabled: true },
  { id: 'github-title', matchType: 'title',  pattern: 'GitHub',              categoryId: null, mode: 'suggest', enabled: true },
  { id: 'gitlab-title', matchType: 'title',  pattern: 'GitLab',              categoryId: null, mode: 'suggest', enabled: true },
  { id: 'stackoverflow-title', matchType: 'title', pattern: 'Stack Overflow', categoryId: null, mode: 'suggest', enabled: true },

  // ── Always-ignore (entertainment / background noise) ─────────────────────
  { id: 'steam',       matchType: 'process', pattern: 'steam.exe',           categoryId: null, mode: 'ignore', enabled: true },
  { id: 'spotify',     matchType: 'process', pattern: 'Spotify.exe',         categoryId: null, mode: 'ignore', enabled: true },
  { id: 'epic',        matchType: 'process', pattern: 'EpicGamesLauncher.exe', categoryId: null, mode: 'ignore', enabled: true },
  { id: 'netflix-title', matchType: 'title', pattern: 'Netflix',             categoryId: null, mode: 'ignore', enabled: true },
  { id: 'youtube-title', matchType: 'title', pattern: 'YouTube',             categoryId: null, mode: 'ignore', enabled: true },
  { id: 'taskmgr',     matchType: 'process', pattern: 'Taskmgr.exe',         categoryId: null, mode: 'ignore', enabled: true },
  { id: 'explorer',    matchType: 'process', pattern: 'explorer.exe',        categoryId: null, mode: 'ignore', enabled: true },
  { id: 'calculator',  matchType: 'process', pattern: 'Calculator.exe',      categoryId: null, mode: 'ignore', enabled: true },
  { id: 'vlc',         matchType: 'process', pattern: 'vlc.exe',             categoryId: null, mode: 'ignore', enabled: true },
]

// ─── M-B1: Default category slot suggestions ─────────────────────────────────
//
// Maps known app process/title IDs to a semantic category slot.
// Used during onboarding to pre-assign the user's actual category IDs.
// 'work' | 'study' | 'personal' are slot names — not actual categoryIds.

export type CategorySlot = 'work' | 'study' | 'personal'

/**
 * Suggested category slot for each DEFAULT_DEV_RULES entry that has a clear
 * default. Used by the onboarding wizard to pre-fill category assignments.
 * Apps with ambiguous intent (browsers, terminals) are omitted.
 */
export const DEFAULT_CATEGORY_SUGGESTIONS: Record<string, CategorySlot> = {
  // Editors & IDEs → work
  vscode: 'work', 'vscode-ins': 'work', idea: 'work', webstorm: 'work',
  pycharm: 'work', rider: 'work', clion: 'work', goland: 'work',
  rustrover: 'work', sublimetext: 'work', notepadpp: 'work', vim: 'work',
  neovim: 'work', cursor: 'work',
  // Dev tools → work
  postman: 'work', insomnia: 'work', dbeaver: 'work', tableplus: 'work',
  docker: 'work', sourcetree: 'work', gitkraken: 'work',
  // Communication → work (can be overridden by user)
  zoom: 'work', teams: 'work', slack: 'work', outlook: 'work', thunderbird: 'work',
  loom: 'work',
  // Office & docs → work
  word: 'work', excel: 'work', powerpoint: 'work', onenote: 'work',
  // Design → work
  figma: 'work', photoshop: 'work', illustrator: 'work', xd: 'work',
  affinity: 'work', blender: 'work',
  // Browser title hints → work
  'github-title': 'work', 'gitlab-title': 'work', 'linear-title': 'work',
  'jira-title': 'work', 'stackoverflow-title': 'study',
  // Notes → study (Obsidian often used for study/PKM)
  obsidian: 'study',
}
