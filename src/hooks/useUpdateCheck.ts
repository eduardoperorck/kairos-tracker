import { useState, useEffect } from 'react'

const CHECK_KEY = 'last_update_check'
const MIN_INTERVAL_MS = 24 * 3_600_000 // check at most once per day
const REPO = 'pichau/kairos-tracker'
const CURRENT_VERSION = '1.0.0'

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [a0, a1, a2] = parse(a)
  const [b0, b1, b2] = parse(b)
  if (a0 !== b0) return a0 > b0
  if (a1 !== b1) return a1 > b1
  return (a2 ?? 0) > (b2 ?? 0)
}

export function useUpdateCheck(): string | null {
  const [latestVersion, setLatestVersion] = useState<string | null>(null)

  useEffect(() => {
    const last = localStorage.getItem(CHECK_KEY)
    if (last && Date.now() - parseInt(last) < MIN_INTERVAL_MS) return

    const controller = new AbortController()
    void fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { tag_name?: string } | null) => {
        localStorage.setItem(CHECK_KEY, String(Date.now()))
        const tag = data?.tag_name
        if (tag && semverGt(tag, CURRENT_VERSION)) {
          setLatestVersion(tag.replace(/^v/, ''))
        }
      })
      .catch(() => {/* network unavailable — silently skip */})

    return () => controller.abort()
  }, [])

  return latestVersion
}
