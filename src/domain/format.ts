/** "HH:MM" in the local timezone (never UTC). */
export function formatLocalTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "YYYY-MM-DD" in the local timezone (never UTC). */
export function toLocalDateString(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatRelativeTime(ms: number, now: number, lang: 'en' | 'pt' = 'en'): string {
  const diff = now - ms
  if (diff < 60_000) return lang === 'pt' ? 'agora' : 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return lang === 'pt' ? `há ${minutes} min` : `${minutes} min ago`
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 24) return lang === 'pt' ? `há ${hours}h` : `${hours}h ago`
  const days = Math.floor(diff / 86_400_000)
  if (days === 1) return lang === 'pt' ? 'ontem' : 'yesterday'
  return lang === 'pt' ? `há ${days} dias` : `${days} days ago`
}

/** Format a YYYY-MM-DD date string for display: MM/DD/YYYY (en) or DD/MM/YYYY (pt). */
export function formatDisplayDate(dateStr: string, lang: 'en' | 'pt'): string {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const [y, m, d] = parts
  return lang === 'pt' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`
}

export function formatShortDate(dateStr: string, lang: 'en' | 'pt'): string {
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const [, month, day] = parts
  return lang === 'pt' ? `${day}/${month}` : `${month}/${day}`
}
