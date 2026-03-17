import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectLLMBackend } from './llm'

describe('detectLLMBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('returns ollama when available', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"models":[]}', { status: 200 }))
    const backend = await detectLLMBackend(null)
    expect(backend).toBe('ollama')
  })

  it('returns claude when ollama down and key present', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const backend = await detectLLMBackend('sk-ant-test')
    expect(backend).toBe('claude')
  })

  it('returns none when nothing available', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const backend = await detectLLMBackend(null)
    expect(backend).toBe('none')
  })
})
