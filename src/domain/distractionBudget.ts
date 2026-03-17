import type { CaptureBlock } from './passiveCapture'

export type DistractionRule = {
  pattern: string // substring match on process name (case-insensitive)
  label: string
}

export type DistractionBudgetStatus = {
  usedMs: number
  budgetMs: number
  remainingMs: number
  overBudget: boolean
  pctUsed: number
  topDistractors: Array<{ label: string; usedMs: number }>
}

const DEFAULT_DISTRACTORS: DistractionRule[] = [
  { pattern: 'youtube', label: 'YouTube' },
  { pattern: 'twitter', label: 'Twitter/X' },
  { pattern: 'reddit', label: 'Reddit' },
  { pattern: 'instagram', label: 'Instagram' },
  { pattern: 'facebook', label: 'Facebook' },
  { pattern: 'tiktok', label: 'TikTok' },
  { pattern: 'netflix', label: 'Netflix' },
  { pattern: 'twitch', label: 'Twitch' },
  { pattern: 'discord', label: 'Discord' },
  { pattern: 'whatsapp', label: 'WhatsApp' },
  { pattern: 'telegram', label: 'Telegram' },
]

export function computeDistractionBudget(
  blocks: CaptureBlock[],
  rules: DistractionRule[] = DEFAULT_DISTRACTORS,
  budgetMs: number = 30 * 60_000, // 30 min default
): DistractionBudgetStatus {
  const usageByLabel = new Map<string, number>()

  for (const block of blocks) {
    const processLower = block.process.toLowerCase()
    const titleLower = block.title.toLowerCase()
    const blockDuration = block.endedAt - block.startedAt

    for (const rule of rules) {
      const patternLower = rule.pattern.toLowerCase()
      if (processLower.includes(patternLower) || titleLower.includes(patternLower)) {
        usageByLabel.set(rule.label, (usageByLabel.get(rule.label) ?? 0) + blockDuration)
        break // count each block only once
      }
    }
  }

  const usedMs = [...usageByLabel.values()].reduce((sum, ms) => sum + ms, 0)
  const remainingMs = Math.max(0, budgetMs - usedMs)
  const pctUsed = budgetMs > 0 ? Math.min(100, Math.round((usedMs / budgetMs) * 100)) : 0

  const topDistractors = [...usageByLabel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, ms]) => ({ label, usedMs: ms }))

  return {
    usedMs,
    budgetMs,
    remainingMs,
    overBudget: usedMs > budgetMs,
    pctUsed,
    topDistractors,
  }
}

export { DEFAULT_DISTRACTORS }
