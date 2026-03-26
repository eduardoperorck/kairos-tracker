import type { Session } from './timer'

/**
 * Splits a session into two parts.
 * The last `splitDurationMs` of the original session becomes a new session
 * belonging to `newCategoryId`. The first part keeps the original session's id.
 */
export function splitSession(
  session: Session,
  splitDurationMs: number,
  newCategoryId: string,
): [Session, Session] {
  const totalMs = session.endedAt - session.startedAt
  if (splitDurationMs <= 0 || splitDurationMs >= totalMs) {
    throw new Error('splitDurationMs must be > 0 and < total session duration')
  }

  const splitAt = session.startedAt + (totalMs - splitDurationMs)

  const first: Session = { ...session, endedAt: splitAt }
  const second: Session = {
    id: `${session.id}-split-${Date.now()}`,
    categoryId: newCategoryId,
    startedAt: splitAt,
    endedAt: session.endedAt,
    date: session.date,
  }

  return [first, second]
}

/**
 * Returns a copy of the session with updated startedAt / endedAt.
 */
export function editSessionTime(
  session: Session,
  startedAt: number,
  endedAt: number,
): Session {
  if (endedAt <= startedAt) {
    throw new Error('endedAt must be greater than startedAt')
  }
  return { ...session, startedAt, endedAt }
}
