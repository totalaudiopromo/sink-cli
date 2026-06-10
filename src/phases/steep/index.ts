import type {
  CacheAdapter,
  PhaseProgress,
  SinkConfig,
  SinkRecord,
  SteepResult,
} from '../../types.js'
import { getScraper } from './registry.js'
import { getProvider as getSoakProvider } from '../soak/registry.js'
import { buildSteepPrompt, calculateOutletConfidence } from './prompt.js'
import { outletToDomain, SteepConfigError } from './provider.js'
import { InMemoryCache } from './cache/in-memory.js'

const DEFAULT_CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

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

function markPhase(records: SinkRecord[]): SinkRecord[] {
  return records.map((r) => ({
    ...r,
    phases: r.phases.includes('steep') ? r.phases : [...r.phases, 'steep' as const],
  }))
}

function pickDomain(record: SinkRecord): string {
  if (record.raw.website) return outletToDomain(record.raw.website)
  if (record.raw.outlet) return outletToDomain(record.raw.outlet)
  return ''
}

function isCacheHit(result: SteepResult, ttl: number): boolean {
  const age = Date.now() - new Date(result.scrapedAt).getTime()
  return age < ttl
}

/**
 * Apply per-contact attribution to an outlet-level SteepResult.
 *
 * If the contact's name appears in the extracted `contacts` map, the per-contact
 * channels (instagram, linkedIn, twitter, role) are attached and confidence is
 * promoted to 'high' for matched fields. Otherwise the result reflects outlet-level
 * data only with `confirmedAtOutlet=false`.
 */
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

interface OutletExtraction {
  result: SteepResult
  payload: ExtractedPayload | null
}

export async function steep(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void,
): Promise<SinkRecord[]> {
  const scraperName = config.steep.scraper
  const extractorName = config.steep.extractor
  const cache: CacheAdapter = config.steep.cache ?? new InMemoryCache()
  const cacheTtl = config.steep.cacheTtl ?? DEFAULT_CACHE_TTL

  const scraper = await getScraper(scraperName)
  const extractor = await getSoakProvider(extractorName)

  const scraperConfig = (config.steep[scraperName] as Record<string, unknown>) ?? {}
  const extractorConfig = (config.steep[extractorName] as Record<string, unknown>) ?? {}

  try {
    await scraper.init(scraperConfig)
    await extractor.init(extractorConfig)
  } catch (err) {
    if (err instanceof SteepConfigError) {
      // Skip the phase silently if creds are missing -- mirrors soak's behaviour
      return records
    }
    throw err
  }

  if (!extractor.complete) {
    throw new SteepConfigError(
      `Extractor provider '${extractorName}' does not implement complete(). Steep requires raw prompt completion.`,
    )
  }

  // Group records by outlet domain so we scrape each outlet exactly once
  const grouped = new Map<string, SinkRecord[]>()
  for (const record of records) {
    const isDuplicate = record.rinse?.duplicate ?? false
    if (isDuplicate) continue
    const domain = pickDomain(record)
    if (!domain) continue
    const list = grouped.get(domain) ?? []
    list.push(record)
    grouped.set(domain, list)
  }

  const outletExtractions = new Map<string, OutletExtraction>()
  const totalOutlets = grouped.size
  let processed = 0

  for (const [domain, recordsAtOutlet] of grouped) {
    processed++
    onProgress?.({
      phase: 'steep',
      current: processed,
      total: totalOutlets,
      message: `Outlet ${domain}`,
    })

    // Cache check
    const cached = await cache.get(domain)
    if (cached && isCacheHit(cached, cacheTtl)) {
      outletExtractions.set(domain, {
        result: { ...cached, cacheAge: Date.now() - new Date(cached.scrapedAt).getTime() },
        payload: null, // contact attribution lost on cache hit; outlet-level fields still valid
      })
      continue
    }

    let scrape: { text: string; pagesFetched: string[] }
    try {
      scrape = await scraper.scrape(domain)
    } catch {
      scrape = { text: '', pagesFetched: [] }
    }

    if (!scrape.text) {
      const empty: SteepResult = {
        provider: `${scraperName}-${extractorName}`,
        outletDomain: domain,
        scrapedAt: new Date().toISOString(),
        cacheAge: 0,
        confirmedAtOutlet: false,
        confidence: { overall: 'none' },
        reasoning: 'Outlet site unreachable or empty',
      }
      await cache.set(domain, empty)
      outletExtractions.set(domain, { result: empty, payload: null })
      continue
    }

    const contactNames = recordsAtOutlet.map((r) => r.raw.name).slice(0, 50)
    const outletName = recordsAtOutlet[0]?.raw.outlet ?? domain
    const prompt = buildSteepPrompt({
      outletName,
      outletDomain: domain,
      contactNames,
      scrapedText: scrape.text,
    })

    let payload: ExtractedPayload | null
    try {
      const text = await extractor.complete(prompt, { maxTokens: 1024 })
      payload = parseExtraction(text)
    } catch {
      payload = null
    }

    if (!payload) {
      const partial: SteepResult = {
        provider: `${scraperName}-${extractorName}`,
        outletDomain: domain,
        scrapedAt: new Date().toISOString(),
        cacheAge: 0,
        confirmedAtOutlet: false,
        confidence: { overall: 'low' },
        reasoning: 'Extraction failed to parse',
      }
      await cache.set(domain, partial)
      outletExtractions.set(domain, { result: partial, payload: null })
      continue
    }

    const hasPortalOrEmail = Boolean(payload.submissionPortalUrl || payload.submissionEmail)
    const hasOutletSocial = Boolean(
      payload.outletInstagram || payload.outletTwitter || payload.outletLinkedIn,
    )

    const baseResult: SteepResult = {
      provider: `${scraperName}-${extractorName}`,
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

    await cache.set(domain, baseResult)
    outletExtractions.set(domain, { result: baseResult, payload })
  }

  const enrichedRecords: SinkRecord[] = records.map((record) => {
    const isDuplicate = record.rinse?.duplicate ?? false
    if (isDuplicate) return record

    const domain = pickDomain(record)
    if (!domain) return record

    const extraction = outletExtractions.get(domain)
    if (!extraction) return record

    const attributed = attributeContact(extraction.result, record.raw.name, extraction.payload)
    return { ...record, steep: attributed }
  })

  await scraper.dispose?.()
  await extractor.dispose?.()

  return markPhase(enrichedRecords)
}
