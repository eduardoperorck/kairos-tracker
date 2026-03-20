import type { CaptureBlock } from './passiveCapture'
import { DEFAULT_DEV_RULES } from './passiveCapture'

export type DWSComponents = {
  continuousBlock: number   // 0-25
  lowSwitches: number       // 0-25
  flowSession: number       // 0-25
  noDistractions: number    // 0 or 25 (binary — presence/absence)
  total: number             // 0-100
}

const MIN_CONTINUOUS_MS = 25 * 60_000 // 25 min
const FLOW_SESSION_MS = 45 * 60_000   // 45 min
const SWITCHES_PER_HOUR_THRESHOLD = 5  // Mark et al. 2005

// Ignore-mode process patterns from default rules
const IGNORE_PROCESSES = new Set(
  DEFAULT_DEV_RULES
    .filter(r => r.mode === 'ignore' && r.matchType === 'process')
    .map(r => r.pattern.toLowerCase())
)

// Distraction title patterns (for browser tabs)
const DISTRACTION_TITLE_PATTERNS = ['youtube', 'netflix', 'twitch', 'reddit', 'twitter', 'instagram', 'tiktok', 'facebook']

function isDistractionBlock(block: CaptureBlock): boolean {
  if (IGNORE_PROCESSES.has(block.process.toLowerCase())) return true
  const titleLower = block.title.toLowerCase()
  return DISTRACTION_TITLE_PATTERNS.some(p => titleLower.includes(p))
}

export function computeDWS(
  blocks: CaptureBlock[],
  sessionStart: number,
  sessionEnd: number,
): DWSComponents {
  if (blocks.length === 0) {
    return { continuousBlock: 0, lowSwitches: 0, flowSession: 0, noDistractions: 0, total: 0 }
  }

  const sessionBlocks = blocks.filter(b => b.startedAt >= sessionStart && b.endedAt <= sessionEnd)

  // Component 1: continuous block — proportional to 25min target
  const maxContinuousMs = sessionBlocks.reduce((max, b) => {
    const dur = b.endedAt - b.startedAt
    return dur > max ? dur : max
  }, 0)
  const continuousBlock = Math.min(25, (maxContinuousMs / MIN_CONTINUOUS_MS) * 25)

  // Component 2: context switches per hour — Mark et al. 2005 threshold: < 5/h
  const sessionMs = sessionEnd - sessionStart
  const sessionHours = sessionMs / 3_600_000
  const switchCount = Math.max(0, sessionBlocks.length - 1)
  const switchesPerHour = switchCount / Math.max(sessionHours, 1)
  // Linear decay from 25 (0 switches/h) to 0 (5+ switches/h)
  const lowSwitches = Math.max(0, 25 * (1 - switchesPerHour / SWITCHES_PER_HOUR_THRESHOLD))

  // Component 3: session >= 45 min (flow) — proportional
  const flowSession = Math.min(25, (sessionMs / FLOW_SESSION_MS) * 25)

  // Component 4: no distraction apps (binary — presence/absence is inherently binary)
  const hasDistraction = sessionBlocks.some(isDistractionBlock)
  const noDistractions = hasDistraction ? 0 : 25

  const total = Math.round(continuousBlock + lowSwitches + flowSession + noDistractions)
  return { continuousBlock, lowSwitches, flowSession, noDistractions, total }
}

export function getDWSLabel(score: number): string {
  if (score >= 75) return 'Deep Work'
  if (score >= 50) return 'Moderate Focus'
  if (score >= 25) return 'Light Focus'
  return 'Fragmented'
}

export function getDWSColor(score: number): string {
  if (score >= 75) return 'text-emerald-400'
  if (score >= 50) return 'text-blue-400'
  if (score >= 25) return 'text-yellow-400'
  return 'text-red-400'
}
