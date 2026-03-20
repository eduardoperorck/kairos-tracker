import { describe, it, expect } from 'vitest'
import { translations } from './i18n'

describe('i18n key parity', () => {
  const en = translations.en
  const pt = translations.pt

  it('pt has all keys that en has', () => {
    const enKeys = Object.keys(en)
    const ptKeys = Object.keys(pt)
    const missingInPt = enKeys.filter(k => !ptKeys.includes(k))
    expect(missingInPt).toEqual([])
  })

  it('en has all keys that pt has', () => {
    const enKeys = Object.keys(en)
    const ptKeys = Object.keys(pt)
    const missingInEn = ptKeys.filter(k => !enKeys.includes(k))
    expect(missingInEn).toEqual([])
  })

  it('pt has no empty string values', () => {
    const emptyKeys = Object.entries(pt)
      .filter(([, v]) => v === '')
      .map(([k]) => k)
    expect(emptyKeys).toEqual([])
  })
})

describe('i18n PT relative-time translation values', () => {
  const pt = translations.pt

  it('relative.justNow translates to "agora" in pt', () => {
    expect(pt['relative.justNow']).toBe('agora')
  })

  it('relative.yesterday translates to "ontem" in pt', () => {
    expect(pt['relative.yesterday']).toBe('ontem')
  })

  it('relative.minAgo contains the placeholder {n} in pt', () => {
    expect(pt['relative.minAgo']).toContain('{n}')
  })

  it('relative.minAgo contains "min" in pt', () => {
    expect(pt['relative.minAgo']).toContain('min')
  })

  it('relative.hAgo contains the placeholder {n} in pt', () => {
    expect(pt['relative.hAgo']).toContain('{n}')
  })

  it('relative.daysAgo contains the placeholder {n} in pt', () => {
    expect(pt['relative.daysAgo']).toContain('{n}')
  })
})

describe('i18n EN relative-time translation values', () => {
  const en = translations.en

  it('relative.justNow is "just now" in en', () => {
    expect(en['relative.justNow']).toBe('just now')
  })

  it('relative.yesterday is "yesterday" in en', () => {
    expect(en['relative.yesterday']).toBe('yesterday')
  })

  it('relative.minAgo contains the placeholder {n} in en', () => {
    expect(en['relative.minAgo']).toContain('{n}')
  })
})
