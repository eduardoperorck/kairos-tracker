import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectLLMBackend, getLLMStatus, callLLM } from './llm'

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

describe('getLLMStatus', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('returns ollama status with first model name when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [{ name: 'mistral' }] }), { status: 200 })
    ))
    const status = await getLLMStatus(null)
    expect(status.backend).toBe('ollama')
    expect(status.available).toBe(true)
    expect(status.model).toBe('mistral')
  })

  it('returns ollama with fallback model when models list is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [] }), { status: 200 })
    ))
    const status = await getLLMStatus(null)
    expect(status.backend).toBe('ollama')
    expect(status.model).toBe('llama3')
  })

  it('returns claude status when ollama down and key present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')))
    const status = await getLLMStatus('sk-ant-test')
    expect(status.backend).toBe('claude')
    expect(status.available).toBe(true)
    expect(status.model).toBe('claude-haiku-4-5-20251001')
  })

  it('returns none when nothing available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')))
    const status = await getLLMStatus(null)
    expect(status.backend).toBe('none')
    expect(status.available).toBe(false)
  })
})

describe('callLLM', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('calls ollama endpoint and returns response text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ response: 'hello from ollama' }), { status: 200 })
    ))
    const result = await callLLM('test prompt', 'ollama')
    expect(result).toBe('hello from ollama')
  })

  it('calls claude endpoint and returns content text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [{ text: 'hello from claude' }] }), { status: 200 })
    ))
    const result = await callLLM('test prompt', 'claude', { apiKey: 'sk-ant-test' })
    expect(result).toBe('hello from claude')
  })

  it('throws when backend is none', async () => {
    await expect(callLLM('test', 'none')).rejects.toThrow('No LLM backend available')
  })

  it('throws when claude backend called without api key', async () => {
    await expect(callLLM('test', 'claude')).rejects.toThrow('Claude API key required')
  })

  it('throws on ollama non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response('', { status: 500 })
    ))
    await expect(callLLM('test', 'ollama')).rejects.toThrow('Ollama error: 500')
  })

  it('throws descriptive error on claude 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response('', { status: 401 })
    ))
    await expect(callLLM('test', 'claude', { apiKey: 'bad-key' })).rejects.toThrow('Invalid API key.')
  })

  it('throws descriptive error on claude 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response('', { status: 429 })
    ))
    await expect(callLLM('test', 'claude', { apiKey: 'sk-ant-test' })).rejects.toThrow('Rate limited.')
  })
})
