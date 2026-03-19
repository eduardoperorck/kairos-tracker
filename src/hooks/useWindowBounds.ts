import { useEffect } from 'react'

const STORAGE_KEY = 'window_bounds'
const SAVE_DELAY_MS = 500

interface Bounds { width: number; height: number; x: number; y: number }

function loadBounds(): Bounds | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Bounds
    if (b.width > 0 && b.height > 0) return b
    return null
  } catch { return null }
}

async function applyBounds(b: Bounds): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    await win.setSize({ type: 'Physical', width: b.width, height: b.height } as Parameters<typeof win.setSize>[0])
    await win.setPosition({ type: 'Physical', x: b.x, y: b.y } as Parameters<typeof win.setPosition>[0])
  } catch { /* browser / test env */ }
}

async function saveBounds(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    const size = await win.innerSize()
    const pos  = await win.outerPosition()
    const bounds: Bounds = { width: size.width, height: size.height, x: pos.x, y: pos.y }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounds))
  } catch { /* browser / test env */ }
}

export function useWindowBounds() {
  // Restore saved bounds on mount
  useEffect(() => {
    const b = loadBounds()
    if (b) void applyBounds(b)
  }, [])

  // Debounced save on window resize/move
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function onResize() {
      clearTimeout(timer)
      timer = setTimeout(() => void saveBounds(), SAVE_DELAY_MS)
    }

    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])
}
