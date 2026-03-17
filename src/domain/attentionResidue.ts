export const SETTLING_DURATION_MS = 5 * 60_000 // 5 minutes

export type AttentionResidueState =
  | { settling: true; remainingMs: number; fromCategory: string }
  | { settling: false }

export function computeAttentionResidue(
  switchedAt: number,
  fromCategory: string,
  now: number,
): AttentionResidueState {
  const elapsed = now - switchedAt
  if (elapsed >= SETTLING_DURATION_MS) return { settling: false }
  return { settling: true, remainingMs: SETTLING_DURATION_MS - elapsed, fromCategory }
}

export function formatResidueCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
