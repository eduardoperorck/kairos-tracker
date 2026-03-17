import { useState } from 'react'
import { useI18n } from '../i18n'
import { useScreenshots } from '../hooks/useScreenshots'

type Props = {
  date: string
  enabled: boolean
}

export function ScreenshotTimeline({ date, enabled }: Props) {
  const { t } = useI18n()
  const { paths } = useScreenshots(date, enabled)
  const [fullscreen, setFullscreen] = useState<string | null>(null)

  if (!enabled) {
    return (
      <div className="mt-4 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
        <p className="text-xs text-zinc-700">{t('screenshot.disabled')}</p>
      </div>
    )
  }

  if (paths.length === 0) {
    return (
      <div className="mt-4">
        <p className="text-xs text-zinc-700">{t('screenshot.empty')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
          {t('screenshot.title')} — {paths.length} captures
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {paths.map(p => {
            // Extract HH-MM from path for label
            const name = p.split(/[/\\]/).pop()?.replace('.jpg', '') ?? ''
            return (
              <button
                key={p}
                onClick={() => setFullscreen(p)}
                className="shrink-0 flex flex-col items-center gap-1 group"
                title={name}
              >
                <div className="h-16 w-24 rounded border border-white/[0.07] bg-zinc-800 overflow-hidden group-hover:border-white/20 transition-all">
                  <img
                    src={`asset://localhost/${p.replace(/\\/g, '/')}`}
                    alt={name}
                    className="h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <span className="text-[9px] text-zinc-700">{name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setFullscreen(null)}
        >
          <img
            src={`asset://localhost/${fullscreen.replace(/\\/g, '/')}`}
            alt="screenshot"
            className="max-h-screen max-w-screen-lg object-contain"
          />
          <button
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 text-2xl"
            onClick={() => setFullscreen(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
