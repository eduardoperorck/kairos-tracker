export type WindowRule = {
  id: string
  matchType: 'process' | 'title'
  pattern: string
  categoryId: string | null
  tag?: string
  mode: 'auto' | 'suggest' | 'ignore'
  enabled: boolean
}

export type ActiveWindow = {
  title: string
  process: string
  timestamp: number
}

export type CaptureBlock = {
  process: string
  title: string
  startedAt: number
  endedAt: number
  categoryId: string | null
  tag?: string
  confirmed: boolean
}

export type RawPollEvent = {
  window: ActiveWindow
  timestamp: number
}

export function matchRule(window: ActiveWindow, rules: WindowRule[]): WindowRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.matchType === 'process') {
      if (window.process.toLowerCase() === rule.pattern.toLowerCase()) return rule
    } else if (rule.matchType === 'title') {
      if (window.title.toLowerCase().includes(rule.pattern.toLowerCase())) return rule
    }
  }
  return null
}

const MIN_BLOCK_MS = 30_000 // 30 seconds minimum

export function aggregateBlocks(events: RawPollEvent[], rules: WindowRule[]): CaptureBlock[] {
  if (events.length === 0) return []
  const blocks: CaptureBlock[] = []
  let currentProcess = events[0].window.process
  let currentTitle = events[0].window.title
  let blockStart = events[0].timestamp
  let lastTimestamp = events[0].timestamp

  for (let i = 1; i < events.length; i++) {
    const ev = events[i]
    if (ev.window.process !== currentProcess) {
      // End current block
      const duration = lastTimestamp - blockStart
      if (duration >= MIN_BLOCK_MS) {
        const fakeWindow = { title: currentTitle, process: currentProcess, timestamp: blockStart }
        const rule = matchRule(fakeWindow, rules)
        blocks.push({
          process: currentProcess,
          title: currentTitle,
          startedAt: blockStart,
          endedAt: lastTimestamp,
          categoryId: rule?.categoryId ?? null,
          tag: rule?.tag,
          confirmed: rule?.mode === 'auto',
        })
      }
      currentProcess = ev.window.process
      currentTitle = ev.window.title
      blockStart = ev.timestamp
    }
    lastTimestamp = ev.timestamp
  }
  // Close last block
  const duration = lastTimestamp - blockStart
  if (duration >= MIN_BLOCK_MS) {
    const fakeWindow = { title: currentTitle, process: currentProcess, timestamp: blockStart }
    const rule = matchRule(fakeWindow, rules)
    blocks.push({
      process: currentProcess,
      title: currentTitle,
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

export function pendingSuggestions(blocks: CaptureBlock[]): CaptureBlock[] {
  return blocks.filter(b => !b.confirmed && b.categoryId !== null)
}

export const DEFAULT_DEV_RULES: WindowRule[] = [
  { id: 'vscode', matchType: 'process', pattern: 'Code.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'idea', matchType: 'process', pattern: 'idea64.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'terminal', matchType: 'process', pattern: 'WindowsTerminal.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'zoom', matchType: 'process', pattern: 'Zoom.exe', categoryId: null, tag: 'meeting', mode: 'suggest', enabled: true },
  { id: 'teams', matchType: 'process', pattern: 'Teams.exe', categoryId: null, tag: 'meeting', mode: 'suggest', enabled: true },
  { id: 'slack', matchType: 'process', pattern: 'Slack.exe', categoryId: null, tag: 'admin', mode: 'suggest', enabled: true },
  { id: 'discord', matchType: 'process', pattern: 'Discord.exe', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'github-title', matchType: 'title', pattern: 'GitHub', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'stackoverflow-title', matchType: 'title', pattern: 'Stack Overflow', categoryId: null, mode: 'suggest', enabled: true },
  { id: 'steam', matchType: 'process', pattern: 'steam.exe', categoryId: null, mode: 'ignore', enabled: true },
  { id: 'spotify', matchType: 'process', pattern: 'Spotify.exe', categoryId: null, mode: 'ignore', enabled: true },
]
