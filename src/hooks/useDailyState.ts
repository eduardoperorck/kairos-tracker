import { useState, useEffect } from 'react'
import { createIntention, createEveningReview, type Intention, type EveningReview } from '../domain/intentions'
import { toDateString } from '../domain/timer'
import type { Storage } from '../persistence/storage'

interface HistorySession {
  date: string
  categoryId: string
  startedAt: number
  endedAt: number
}

interface Deps {
  storage: Pick<Storage, 'loadIntentionsByDate' | 'loadEveningReviewByDate' | 'saveIntention' | 'saveEveningReview'>
  today: string
  historySessions: HistorySession[]
  t: (key: string) => string
}

export function useDailyState({ storage, today, historySessions, t }: Deps) {
  const [intentions, setIntentions] = useState<Intention[]>([])
  const [eveningReview, setEveningReview] = useState<EveningReview | null>(null)
  const [dailyRecap, setDailyRecap] = useState<string | null>(null)
  const [showMorningPrompt, setShowMorningPrompt] = useState(() => {
    const todayKey = toDateString(Date.now())
    return localStorage.getItem(`morning_prompt_dismissed_${todayKey}`) !== 'true'
  })

  // Load today's intentions and evening review
  useEffect(() => {
    Promise.all([
      storage.loadIntentionsByDate(today),
      storage.loadEveningReviewByDate(today),
    ]).then(([ints, rev]) => {
      setIntentions(ints)
      setEveningReview(rev)
    }).catch(err => {
      console.error('[useDailyState] Failed to load daily data:', err)
    })
  }, [today])

  // Daily recap — show yesterday's summary on first open of the day
  useEffect(() => {
    if (historySessions.length === 0) return
    const todayStr = toDateString(Date.now())
    const lastOpen = localStorage.getItem('last_open_date')
    localStorage.setItem('last_open_date', todayStr)
    if (!lastOpen || lastOpen === todayStr) return

    const yesterday = toDateString(Date.now() - 86_400_000)
    const yesterdaySessions = historySessions.filter(s => s.date === yesterday)
    if (yesterdaySessions.length === 0) return

    const totalMs = yesterdaySessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
    const catCount = new Set(yesterdaySessions.map(s => s.categoryId)).size
    const totalH = Math.floor(totalMs / 3_600_000)
    const totalM = Math.floor((totalMs % 3_600_000) / 60_000)
    const timeStr = totalH > 0 ? `${totalH}h ${totalM}m` : `${totalM}m`
    setDailyRecap(`${t('app.yesterdayPrefix')} ${timeStr} tracked across ${catCount} ${catCount === 1 ? t('app.category') : t('app.categories')}.`)
  }, [historySessions])

  async function handleAddIntention(text: string) {
    const intention = createIntention(text, today)
    await storage.saveIntention(intention)
    setIntentions(prev => [...prev, intention])
  }

  async function handleSaveReview(mood: (1 | 2 | 3 | 4 | 5) | undefined, notes: string) {
    const review = createEveningReview(today, mood, notes)
    await storage.saveEveningReview(review)
    setEveningReview(review)
  }

  return {
    intentions,
    setIntentions,
    eveningReview,
    setEveningReview,
    dailyRecap,
    setDailyRecap,
    showMorningPrompt,
    setShowMorningPrompt,
    handleAddIntention,
    handleSaveReview,
  }
}
