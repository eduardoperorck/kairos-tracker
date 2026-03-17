import { useState } from 'react'
import { formatElapsed } from '../domain/format'
import { useI18n } from '../i18n'

type CategoryStat = {
  id: string
  name: string
  weeklyMs: number
  weeklyGoalMs?: number
  color?: string
}

type Props = {
  weekLabel: string
  stats: CategoryStat[]
  totalMs: number
  topStreak: number
  flowCount: number
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSvg(weekLabel: string, stats: CategoryStat[], totalMs: number, topStreak: number, flowCount: number): string {
  const W = 480
  const rowH = 44
  const topPad = 72
  const bottomPad = 56
  const H = topPad + stats.length * rowH + bottomPad
  const barMaxW = 260
  const maxMs = Math.max(...stats.map(s => s.weeklyMs), 1)

  const rows = stats.map((s, i) => {
    const y = topPad + i * rowH
    const barW = Math.round((s.weeklyMs / maxMs) * barMaxW)
    const color = s.color ?? '#6366f1'
    const goalPct = s.weeklyGoalMs && s.weeklyGoalMs > 0
      ? Math.min(Math.round((s.weeklyMs / s.weeklyGoalMs) * 100), 100)
      : null

    return `
      <rect x="100" y="${y + 10}" width="${barW}" height="14" rx="3" fill="${color}" opacity="0.7"/>
      <text x="96" y="${y + 22}" text-anchor="end" fill="#a1a1aa" font-size="12" font-family="monospace">${escapeXml(s.name.slice(0, 8))}</text>
      <text x="${100 + barW + 6}" y="${y + 22}" fill="#71717a" font-size="11" font-family="monospace">${formatElapsed(s.weeklyMs)}${goalPct !== null ? ' ' + goalPct + '%' : ''}</text>
    `
  }).join('')

  const footerY = topPad + stats.length * rowH + 24

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="12" fill="#0a0a0a"/>
  <rect width="${W}" height="${H}" rx="12" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>
  <text x="24" y="32" fill="#e4e4e7" font-size="14" font-weight="600" font-family="system-ui, sans-serif">⚡ Time Tracker</text>
  <text x="24" y="52" fill="#52525b" font-size="11" font-family="system-ui, sans-serif">Week of ${escapeXml(weekLabel)}</text>
  ${rows}
  <text x="24" y="${footerY}" fill="#52525b" font-size="11" font-family="monospace">${formatElapsed(totalMs)} total${topStreak > 0 ? ' · ' + topStreak + 'd streak' : ''}${flowCount > 0 ? ' · ' + flowCount + ' flows' : ''}</text>
</svg>`
}

async function svgToClipboard(svgStr: string): Promise<void> {
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = rej
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.width || 480
  canvas.height = img.height || 240
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)

  await new Promise<void>((res, rej) => {
    canvas.toBlob(async blob => {
      if (!blob) { rej(new Error('canvas blob failed')); return }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        res()
      } catch (e) {
        rej(e)
      }
    }, 'image/png')
  })
}

export function ShareWeekButton({ weekLabel, stats, totalMs, topStreak, flowCount }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function handleShare() {
    const svg = buildSvg(weekLabel, stats, totalMs, topStreak, flowCount)
    try {
      await svgToClipboard(svg)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      // Fallback: just download the SVG
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `week-${weekLabel}.svg`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('failed')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-white/[0.07] rounded px-3 py-1.5"
    >
      {status === 'copied' ? t('statCard.copied') : status === 'failed' ? t('statCard.copyFailed') : t('statCard.share')}
    </button>
  )
}
