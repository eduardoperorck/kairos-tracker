import { useState, useRef, useEffect } from 'react'
import { useI18n } from '../i18n'
import type { Category } from '../domain/timer'

const PRIMARY_VIEWS = ['tracker', 'today', 'stats', 'history'] as const
const SECONDARY_VIEWS = ['settings'] as const
type View = 'tracker' | 'stats' | 'history' | 'today' | 'settings'

interface Props {
  view: View
  setView: (v: View) => void
  dailyRecap: string | null
  activeCategory: Category | undefined
}

export function AppHeader({ view, setView, dailyRecap, activeCategory }: Props) {
  const { t } = useI18n()
  const [navMoreOpen, setNavMoreOpen] = useState(false)
  const navMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!navMoreOpen) return
    function onDown(e: MouseEvent) {
      if (navMoreRef.current && !navMoreRef.current.contains(e.target as Node)) setNavMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [navMoreOpen])

  return (
    <header className="border-b border-white/6 transition-colors" style={
      activeCategory?.color && view === 'tracker'
        ? { borderColor: activeCategory.color + '30', backgroundColor: activeCategory.color + '08' }
        : {}
    }>
      <div className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Kairos" className="h-6 w-6 rounded" />
          <span className="text-sm font-semibold text-zinc-100">{t('app.title')}</span>
          {dailyRecap && (
            <span className="text-xs text-zinc-600 hidden sm:inline">· {dailyRecap}</span>
          )}
        </div>
        <nav className="flex items-center">
          {PRIMARY_VIEWS.map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative px-4 h-14 text-sm transition-colors ${
                view === v ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'tracker' ? t('nav.timer') : v === 'today' ? t('nav.today') : v === 'stats' ? t('nav.stats') : t('nav.history')}
              {view === v && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
              )}
            </button>
          ))}

          <div className="relative" ref={navMoreRef}>
            <button
              onClick={() => setNavMoreOpen(p => !p)}
              className={`relative px-3 h-14 text-sm transition-colors ${
                SECONDARY_VIEWS.includes(view as typeof SECONDARY_VIEWS[number])
                  ? 'text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="More"
            >
              ···
              {SECONDARY_VIEWS.includes(view as typeof SECONDARY_VIEWS[number]) && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
              )}
            </button>
            {navMoreOpen && (
              <div className="absolute right-0 top-14 z-30 w-36 rounded-lg border border-white/[0.1] bg-zinc-900 py-1 shadow-xl text-sm">
                {SECONDARY_VIEWS.map(v => (
                  <button
                    key={v}
                    onClick={() => { setView(v); setNavMoreOpen(false) }}
                    className={`flex w-full px-4 py-2 transition-colors ${
                      view === v ? 'text-zinc-100 bg-white/[0.04]' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
                    }`}
                  >
                    {t('nav.settings')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
