/**
 * Browser soak runner — AI contact enrichment, client-side, BYO key.
 *
 * Mirrors src/phases/soak/index.ts but: constructs the Anthropic client with
 * `dangerouslyAllowBrowser: true` (the key is the user's own, held in memory and
 * never sent to our servers), reuses the pure prompt/confidence helpers from
 * datasink/core, and narrates progress as TerminalLine events instead of ora.
 */

import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, calculateConfidence } from 'datasink/core'
import type { SinkRecord, SoakResult } from 'datasink/core'
import type { OnLine } from './engine'
import { line } from './engine'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const RATE_LIMIT_MS = 200
const MAX_RETRIES = 2

export interface SoakRunResult {
  records: SinkRecord[]
  enriched: number
  failed: number
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}

function parseEnrichment(text: string): SoakResult {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
    const data = JSON.parse(cleaned)
    return {
      provider: 'anthropic',
      platform: data.platform,
      platformType: data.platformType,
      roleDetail: data.roleDetail,
      genres: data.genres,
      coverageArea: data.coverageArea,
      contactMethod: data.contactMethod,
      bestTiming: data.bestTiming,
      submissionGuidelines: data.submissionGuidelines,
      pitchTips: data.pitchTips,
      geographicScope: data.geographicScope,
      confidence: calculateConfidence(data),
    }
  } catch {
    return { provider: 'anthropic', confidence: 'none', reasoning: 'Failed to parse response' }
  }
}

function detailFor(soak: SoakResult): string {
  const bits: string[] = []
  if (soak.platformType) bits.push(soak.platformType)
  if (soak.genres?.length) bits.push(soak.genres.slice(0, 2).join(', '))
  return bits.join(' · ')
}

export async function runSoakBrowser(
  records: SinkRecord[],
  onLine: OnLine,
  opts: { anthropicKey: string; model?: string },
): Promise<SoakRunResult> {
  onLine(line('phase-header', { name: 'Soak', label: 'AI contact enrichment' }))

  const client = new Anthropic({ apiKey: opts.anthropicKey, dangerouslyAllowBrowser: true })
  const model = opts.model ?? DEFAULT_MODEL

  const enrichable: { index: number; record: SinkRecord }[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const hasValidEmail = r.scrub ? r.scrub.email.valid : Boolean(r.raw.email)
    const isDuplicate = r.rinse?.duplicate ?? false
    if (hasValidEmail && !isDuplicate) enrichable.push({ index: i, record: r })
  }

  const result = [...records]
  let enriched = 0
  let failed = 0

  if (enrichable.length === 0) {
    onLine(line('plain', { text: 'No enrichable contacts (need a valid, non-duplicate email).', dim: true }))
    onLine(line('blank'))
    return { records: result, enriched, failed }
  }

  for (let i = 0; i < enrichable.length; i++) {
    const { index, record } = enrichable[i]
    let soak: SoakResult
    try {
      const text = await withRetry(async () => {
        const response = await client.messages.create({
          model,
          max_tokens: 512,
          messages: [{ role: 'user', content: buildPrompt(record) }],
        })
        const block = response.content[0]
        return block?.type === 'text' ? block.text : ''
      }, MAX_RETRIES)
      soak = parseEnrichment(text)
      if (soak.confidence === 'none') failed += 1
      else enriched += 1
    } catch (err) {
      failed += 1
      soak = {
        provider: 'anthropic',
        confidence: 'none',
        reasoning: err instanceof Error ? err.message : 'Enrichment failed',
      }
    }
    result[index] = { ...result[index], soak, phases: [...result[index].phases, 'soak'] }

    onLine(
      line('soak-row', {
        tone: soak.confidence === 'none' ? 'fail' : soak.confidence === 'high' ? 'ok' : 'warn',
        name: record.raw.name,
        detail: detailFor(soak),
        confidence: soak.confidence,
      }),
    )

    if (i < enrichable.length - 1) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  onLine(line('soak-summary', { enriched, failed }))
  onLine(line('blank'))

  return { records: result, enriched, failed }
}
