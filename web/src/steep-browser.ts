/**
 * Browser steep runner — outlet research, client-side, BYO key.
 *
 * Mirrors src/phases/steep/index.ts. Scraping goes through the thin
 * /api/firecrawl-proxy Edge Function (Firecrawl's API blocks browser CORS); the
 * user's Firecrawl key is passed per-request and never stored. Extraction calls
 * Anthropic directly (dangerouslyAllowBrowser) reusing the pure prompt/confidence
 * helpers from datasink/core. Progress is narrated as TerminalLine events.
 */

import Anthropic from '@anthropic-ai/sdk'
import { buildSteepPrompt, calculateOutletConfidence, outletToDomain } from 'datasink/core'
import type { SinkRecord, SteepResult } from 'datasink/core'
import type { OnLine } from './engine'
import { line } from './engine'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const SUBPATHS = ['', '/about', '/contact', '/team', '/presenters', '/submit', '/submissions']

interface ExtractedContact {
  role?: string
  instagram?: string
  linkedIn?: string
  twitter?: string
}

interface ExtractedPayload {
  outletInstagram?: string
  outletTwitter?: string
  outletLinkedIn?: string
  outletFacebook?: string
  submissionPortalUrl?: string
  submissionEmail?: string
  submissionFormat?: 'mp3' | 'link' | 'form' | 'mixed'
  recentPresenters?: string[]
  recentCoverage?: string[]
  pitchHooks?: string[]
  contacts?: Record<string, ExtractedContact>
  confidenceNotes?: string
}

export interface SteepRunResult {
  records: SinkRecord[]
  outletsScraped: number
  outletsWithPortal: number
  contactsConfirmed: number
}

function pickDomain(record: SinkRecord): string {
  if (record.raw.website) return outletToDomain(record.raw.website)
  if (record.raw.outlet) return outletToDomain(record.raw.outlet)
  return ''
}

function parseExtraction(text: string): ExtractedPayload | null {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()
    return JSON.parse(cleaned) as ExtractedPayload
  } catch {
    return null
  }
}

async function scrapeOne(url: string, firecrawlKey: string): Promise<string> {
  const res = await fetch('/api/firecrawl-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, firecrawlKey }),
  })
  if (!res.ok) return ''
  const data = (await res.json()) as { markdown?: string; content?: string }
  return (data.markdown ?? data.content ?? '').slice(0, 4000)
}

async function scrapeDomain(
  domain: string,
  firecrawlKey: string,
): Promise<{ text: string; pagesFetched: string[] }> {
  if (!domain.includes('.')) return { text: '', pagesFetched: [] }
  const fragments: string[] = []
  const pagesFetched: string[] = []
  for (const path of SUBPATHS) {
    const url = `https://${domain}${path}`
    try {
      const md = await scrapeOne(url, firecrawlKey)
      if (md) {
        fragments.push(`---PAGE: ${url}---\n${md}`)
        pagesFetched.push(url)
      }
    } catch {
      // tolerate per-page failures
    }
  }
  return { text: fragments.join('\n\n'), pagesFetched }
}

function attributeContact(
  base: SteepResult,
  contactName: string,
  payload: ExtractedPayload | null,
): SteepResult {
  if (!payload?.contacts) return { ...base, confirmedAtOutlet: false }
  const lowerName = contactName.trim().toLowerCase()
  let match: ExtractedContact | undefined
  for (const [key, value] of Object.entries(payload.contacts)) {
    if (key.trim().toLowerCase() === lowerName) {
      match = value
      break
    }
  }
  if (!match) return { ...base, confirmedAtOutlet: false }
  return {
    ...base,
    confirmedAtOutlet: true,
    contactRole: match.role ?? base.contactRole,
    contactInstagram: match.instagram ?? base.contactInstagram,
    contactLinkedIn: match.linkedIn ?? base.contactLinkedIn,
    contactTwitter: match.twitter ?? base.contactTwitter,
    confidence: {
      ...base.confidence,
      instagram: match.instagram ? 'high' : base.confidence.instagram,
      linkedIn: match.linkedIn ? 'high' : base.confidence.linkedIn,
    },
  }
}

function detailFor(result: SteepResult, pages: number): string {
  const bits: string[] = [`${pages} page${pages === 1 ? '' : 's'}`]
  if (result.submissionPortalUrl || result.submissionEmail) bits.push('portal found')
  else if (result.outletInstagram || result.outletTwitter || result.outletLinkedIn) bits.push('socials')
  return bits.join(' · ')
}

export async function runSteepBrowser(
  records: SinkRecord[],
  onLine: OnLine,
  opts: { anthropicKey: string; firecrawlKey: string; model?: string },
): Promise<SteepRunResult> {
  onLine(line('phase-header', { name: 'Steep', label: 'outlet research' }))

  const client = new Anthropic({ apiKey: opts.anthropicKey, dangerouslyAllowBrowser: true })
  const model = opts.model ?? DEFAULT_MODEL

  // Group non-duplicate records by outlet domain — one scrape per outlet.
  const grouped = new Map<string, SinkRecord[]>()
  for (const record of records) {
    if (record.rinse?.duplicate) continue
    const domain = pickDomain(record)
    if (!domain) continue
    const list = grouped.get(domain) ?? []
    list.push(record)
    grouped.set(domain, list)
  }

  if (grouped.size === 0) {
    onLine(line('plain', { text: 'No outlet domains to research.', dim: true }))
    onLine(line('blank'))
    return { records, outletsScraped: 0, outletsWithPortal: 0, contactsConfirmed: 0 }
  }

  const extractions = new Map<string, { result: SteepResult; payload: ExtractedPayload | null }>()
  let outletsWithPortal = 0

  for (const [domain, recordsAtOutlet] of grouped) {
    let scrape: { text: string; pagesFetched: string[] }
    try {
      scrape = await scrapeDomain(domain, opts.firecrawlKey)
    } catch {
      scrape = { text: '', pagesFetched: [] }
    }

    if (!scrape.text) {
      const empty: SteepResult = {
        provider: 'firecrawl-anthropic',
        outletDomain: domain,
        scrapedAt: new Date().toISOString(),
        cacheAge: 0,
        confirmedAtOutlet: false,
        confidence: { overall: 'none' },
        reasoning: 'Outlet site unreachable or empty',
      }
      extractions.set(domain, { result: empty, payload: null })
      onLine(line('steep-row', { tone: 'fail', domain, detail: 'unreachable', confidence: 'none' }))
      continue
    }

    const contactNames = recordsAtOutlet.map((r) => r.raw.name).slice(0, 50)
    const outletName = recordsAtOutlet[0]?.raw.outlet ?? domain
    const prompt = buildSteepPrompt({ outletName, outletDomain: domain, contactNames, scrapedText: scrape.text })

    let payload: ExtractedPayload | null
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = response.content[0]
      payload = parseExtraction(block?.type === 'text' ? block.text : '')
    } catch {
      payload = null
    }

    if (!payload) {
      const partial: SteepResult = {
        provider: 'firecrawl-anthropic',
        outletDomain: domain,
        scrapedAt: new Date().toISOString(),
        cacheAge: 0,
        confirmedAtOutlet: false,
        confidence: { overall: 'low' },
        reasoning: 'Extraction failed to parse',
      }
      extractions.set(domain, { result: partial, payload: null })
      onLine(line('steep-row', { tone: 'warn', domain, detail: 'extraction failed', confidence: 'low' }))
      continue
    }

    const hasPortalOrEmail = Boolean(payload.submissionPortalUrl || payload.submissionEmail)
    const hasOutletSocial = Boolean(payload.outletInstagram || payload.outletTwitter || payload.outletLinkedIn)
    if (hasPortalOrEmail) outletsWithPortal += 1

    const baseResult: SteepResult = {
      provider: 'firecrawl-anthropic',
      outletDomain: domain,
      scrapedAt: new Date().toISOString(),
      cacheAge: 0,
      outletInstagram: payload.outletInstagram,
      outletTwitter: payload.outletTwitter,
      outletLinkedIn: payload.outletLinkedIn,
      outletFacebook: payload.outletFacebook,
      submissionPortalUrl: payload.submissionPortalUrl,
      submissionEmail: payload.submissionEmail,
      submissionFormat: payload.submissionFormat,
      recentPresenters: payload.recentPresenters,
      recentCoverage: payload.recentCoverage,
      pitchHooks: payload.pitchHooks,
      confirmedAtOutlet: false,
      confidence: {
        overall: calculateOutletConfidence({
          hasPortalOrEmail,
          hasOutletSocial,
          pagesFetched: scrape.pagesFetched.length,
        }),
        instagram: payload.outletInstagram ? 'medium' : undefined,
        linkedIn: payload.outletLinkedIn ? 'medium' : undefined,
        portal: hasPortalOrEmail ? 'high' : undefined,
      },
      reasoning: payload.confidenceNotes,
    }

    extractions.set(domain, { result: baseResult, payload })
    onLine(
      line('steep-row', {
        tone: baseResult.confidence.overall === 'high' ? 'ok' : 'warn',
        domain,
        detail: detailFor(baseResult, scrape.pagesFetched.length),
        confidence: baseResult.confidence.overall,
      }),
    )
  }

  // Attribute per-contact and attach to records.
  let contactsConfirmed = 0
  const enriched: SinkRecord[] = records.map((record) => {
    if (record.rinse?.duplicate) return record
    const domain = pickDomain(record)
    if (!domain) return record
    const extraction = extractions.get(domain)
    if (!extraction) return record
    const attributed = attributeContact(extraction.result, record.raw.name, extraction.payload)
    if (attributed.confirmedAtOutlet) contactsConfirmed += 1
    return { ...record, steep: attributed, phases: [...record.phases, 'steep'] }
  })

  onLine(
    line('steep-summary', {
      outlets: grouped.size,
      portals: outletsWithPortal,
      confirmed: contactsConfirmed,
    }),
  )
  onLine(line('blank'))

  return { records: enriched, outletsScraped: grouped.size, outletsWithPortal, contactsConfirmed }
}
