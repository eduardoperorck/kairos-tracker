/**
 * Task 9: AI fallback context classifier.
 *
 * Called when no rule or heuristic score is confident enough (score < SCORE_THRESHOLD_AUTO).
 * Uses the local Ollama model first; falls back to Claude if Ollama is unavailable.
 * Returns a categoryId guess or null if the AI cannot classify with confidence.
 */

import { callLLM, detectLLMBackend } from './llm'
import type { Category } from '../domain/timer'

type ClassifyInput = {
  process: string
  title: string
  domain: string | null
  vsWorkspace: string | null
}

type ClassifyResult = {
  categoryId: string
  confidence: number   // 0–1
  reason: string
} | null

const CACHE_TTL_MS = 10 * 60_000  // 10 minutes — don't re-classify the same context
const cache = new Map<string, { result: ClassifyResult; expiresAt: number }>()

function cacheKey(input: ClassifyInput): string {
  return `${input.process}::${input.vsWorkspace ?? ''}::${input.domain ?? ''}`
}

/**
 * Ask the AI to classify the current window context into one of the provided categories.
 * Returns null when no LLM backend is available, the context is already covered by rules,
 * or the AI cannot make a confident determination.
 */
export async function classifyContext(
  input: ClassifyInput,
  categories: Category[],
  apiKey?: string | null,
): Promise<ClassifyResult> {
  if (categories.length === 0) return null

  const key = cacheKey(input)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  const backend = await detectLLMBackend(apiKey ?? undefined)
  if (backend === 'none') return null

  const categoryList = categories
    .map(c => `- id: "${c.id}", name: "${c.name}"`)
    .join('\n')

  const prompt = `You are a productivity assistant. Classify the current computer activity into exactly one category.

Current context:
- Process: ${JSON.stringify(input.process)}
- Window title: ${JSON.stringify(input.title ?? '')}
${input.domain ? `- Website: ${JSON.stringify(input.domain)}` : ''}
${input.vsWorkspace ? `- VS Code workspace: ${JSON.stringify(input.vsWorkspace)}` : ''}

Available categories:
${categoryList}

Respond with a JSON object only — no markdown, no explanation:
{"categoryId": "<id from the list>", "confidence": <0.0-1.0>, "reason": "<one sentence>"}

If you cannot determine the category with confidence >= 0.6, respond:
{"categoryId": null, "confidence": 0, "reason": "uncertain"}`

  try {
    const raw = await callLLM(prompt, backend, { apiKey: apiKey ?? undefined })
    const trimmed = raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(trimmed) as { categoryId: string | null; confidence: number; reason: string }
    if (!parsed.categoryId || parsed.confidence < 0.6) {
      cache.set(key, { result: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return null
    }
    const result: ClassifyResult = {
      categoryId: parsed.categoryId,
      confidence: parsed.confidence,
      reason: parsed.reason,
    }
    cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } catch {
    return null
  }
}
