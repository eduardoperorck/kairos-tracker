import { useState, useEffect } from 'react'

export function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0)
      return
    }

    setElapsed(Date.now() - startedAt)

    const id = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 1000)

    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}
