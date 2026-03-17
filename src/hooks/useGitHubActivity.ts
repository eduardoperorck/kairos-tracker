import { useState, useEffect } from 'react'

type CommitMap = Map<string, number> // date -> commit count

export function useGitHubActivity(username: string | null): CommitMap {
  const [commits, setCommits] = useState<CommitMap>(new Map())

  useEffect(() => {
    if (!username) { setCommits(new Map()); return }

    // Validate username format before constructing URL
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(username)) { setCommits(new Map()); return }

    const map = new Map<string, number>()

    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100`)
      .then(r => { if (!r.ok) return []; return r.json() })
      .then((events: { type: string; created_at: string; payload?: { commits?: unknown[] } }[]) => {
        for (const ev of events) {
          if (ev.type !== 'PushEvent') continue
          const date = ev.created_at.slice(0, 10)
          const count = (ev.payload?.commits as unknown[])?.length ?? 1
          map.set(date, (map.get(date) ?? 0) + count)
        }
        setCommits(new Map(map))
      })
      .catch(() => setCommits(new Map()))
  }, [username])

  return commits
}
