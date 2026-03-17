import { useEffect, useRef, useState } from 'react'
import type { InputActivity } from '../domain/inputIntelligence'

const POLL_INTERVAL_MS = 5_000 // update every 5 seconds
const WINDOW_MS = 60_000 // measure over 1-minute window

// Falls back to frontend event counting when Tauri is unavailable (browser mode).
export function useInputActivity(): InputActivity {
  const [activity, setActivity] = useState<InputActivity>({
    keystrokes: 0,
    mouseClicks: 0,
    mouseDistancePx: 0,
    windowMs: WINDOW_MS,
  })

  const counters = useRef({ keystrokes: 0, mouseClicks: 0, mouseDistancePx: 0 })
  const lastMousePos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    function onKeyDown() {
      counters.current.keystrokes++
    }
    function onMouseDown() {
      counters.current.mouseClicks++
    }
    function onMouseMove(e: MouseEvent) {
      if (lastMousePos.current) {
        const dx = e.clientX - lastMousePos.current.x
        const dy = e.clientY - lastMousePos.current.y
        counters.current.mouseDistancePx += Math.sqrt(dx * dx + dy * dy)
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)

    const interval = setInterval(() => {
      setActivity({
        keystrokes: counters.current.keystrokes,
        mouseClicks: counters.current.mouseClicks,
        mouseDistancePx: Math.round(counters.current.mouseDistancePx),
        windowMs: WINDOW_MS,
      })
      // Reset counters for next window
      counters.current = { keystrokes: 0, mouseClicks: 0, mouseDistancePx: 0 }
    }, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      clearInterval(interval)
    }
  }, [])

  return activity
}
