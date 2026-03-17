import type { CaptureBlock } from './passiveCapture'

export type DWSComponents = {
  continuousBlock: number   // 0 or 25
  lowSwitches: number       // 0 or 25
  flowSession: number       // 0 or 25
  noDistractions: number    // 0 or 25
  total: number             // 0-100
}

const DISTRACTION_PROCESSES = ['Spotify.exe', 'steam.exe', 'Discord.exe', 'netflix.com', 'youtube.com']
const MIN_CONTINUOUS_MS = 25 * 60_000 // 25 min
const FLOW_SESSION_MS = 45 * 60_000   // 45 min
const HIGH_SWITCH_THRESHOLD = 5

export function computeDWS(
  blocks: CaptureBlock[],
  sessionStart: number,
  sessionEnd: number,
  distractionProcesses: string[] = DISTRACTION_PROCESSES
): DWSComponents {
  if (blocks.length === 0) {
    return { continuousBlock: 0, lowSwitches: 0, flowSession: 0, noDistractions: 0, total: 0 }
  }

  const sessionBlocks = blocks.filter(b => b.startedAt >= sessionStart && b.endedAt <= sessionEnd)

  // Component 1: continuous block > 25 min
  const maxContinuousMs = sessionBlocks.reduce((max, b) => {
    const dur = b.endedAt - b.startedAt
    return dur > max ? dur : max
  }, 0)
  const continuousBlock = maxContinuousMs >= MIN_CONTINUOUS_MS ? 25 : 0

  // Component 2: context switches < 5 in the session
  const switchCount = Math.max(0, sessionBlocks.length - 1)
  const lowSwitches = switchCount < HIGH_SWITCH_THRESHOLD ? 25 : 0

  // Component 3: session >= 45 min (flow)
  const sessionMs = sessionEnd - sessionStart
  const flowSession = sessionMs >= FLOW_SESSION_MS ? 25 : 0

  // Component 4: no distraction apps
  const hasDistraction = sessionBlocks.some(b =>
    distractionProcesses.some(d => b.process.toLowerCase().includes(d.toLowerCase()))
  )
  const noDistractions = hasDistraction ? 0 : 25

  const total = continuousBlock + lowSwitches + flowSession + noDistractions
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
