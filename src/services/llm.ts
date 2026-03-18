export type LLMBackend = 'ollama' | 'claude' | 'none'
export type LLMStatus = {
  backend: LLMBackend
  model?: string
  available: boolean
}

export async function detectLLMBackend(claudeApiKey: string | null): Promise<LLMBackend> {
  // Check Ollama first (local, free)
  try {
    const r = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(500),
    })
    if (r.ok) return 'ollama'
  } catch { /* not running */ }

  // Fall back to Claude API
  if (claudeApiKey) return 'claude'

  return 'none'
}

export async function getLLMStatus(claudeApiKey: string | null): Promise<LLMStatus> {
  try {
    const r = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(500),
    })
    if (r.ok) {
      const data = await r.json() as { models?: { name: string }[] }
      const model = data.models?.[0]?.name ?? 'llama3'
      return { backend: 'ollama', model, available: true }
    }
  } catch { /* not running */ }

  if (claudeApiKey) {
    return { backend: 'claude', model: 'claude-haiku-4-5-20251001', available: true }
  }

  return { backend: 'none', available: false }
}

async function callOllama(prompt: string, model = 'llama3'): Promise<string> {
  const r = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  if (!r.ok) throw new Error(`Ollama error: ${r.status}`)
  const data = await r.json() as { response: string }
  return data.response
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) {
    if (r.status === 401) throw new Error('Invalid API key.')
    if (r.status === 429) throw new Error('Rate limited.')
    throw new Error('AI service unavailable.')
  }
  const data = await r.json() as { content: { text: string }[] }
  return data.content[0]?.text ?? ''
}

export async function callLLM(
  prompt: string,
  backend: LLMBackend,
  options: { apiKey?: string; model?: string } = {}
): Promise<string> {
  if (backend === 'ollama') return callOllama(prompt, options.model)
  if (backend === 'claude') {
    if (!options.apiKey) throw new Error('Claude API key required')
    return callClaude(prompt, options.apiKey)
  }
  throw new Error('No LLM backend available. Configure Ollama or Claude API key.')
}
