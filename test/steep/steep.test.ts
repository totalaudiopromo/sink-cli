import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nanoid } from 'nanoid'
import { steep } from '../../src/phases/steep/index.js'
import { outletToDomain } from '../../src/phases/steep/provider.js'
import { InMemoryCache } from '../../src/phases/steep/cache/in-memory.js'
import { registerScraper } from '../../src/phases/steep/registry.js'
import { registerProvider } from '../../src/phases/soak/registry.js'
import { loadConfig } from '../../src/config.js'
import type {
  SinkConfig,
  SinkRecord,
  SteepResult,
  SteepScraper,
  SoakProvider,
  RawRecord,
} from '../../src/types.js'

function record(raw: Partial<RawRecord>): SinkRecord {
  return {
    id: nanoid(),
    raw: { name: 'Unknown', ...raw },
    phases: [],
    timestamp: new Date().toISOString(),
  }
}

/** Stub extractor returning a fixed extraction payload via complete(). */
function makeExtractor(payload: unknown): { provider: SoakProvider; complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn(async () => JSON.stringify(payload))
  const provider: SoakProvider = {
    name: 'fake-extractor',
    init: async () => {},
    enrich: async () => ({ provider: 'fake-extractor', confidence: 'none' }),
    complete,
  }
  return { provider, complete }
}

/** Stub scraper returning canned text only for real (dotted) domains. */
function makeScraper(
  text = '---PAGE: https://example.com---\nteam page content',
): { scraper: SteepScraper; scrape: ReturnType<typeof vi.fn> } {
  const scrape = vi.fn(async (domain: string) => {
    if (!domain.includes('.')) return { text: '', pagesFetched: [] }
    return { text, pagesFetched: [`https://${domain}`, `https://${domain}/team`] }
  })
  const scraper: SteepScraper = {
    name: 'fake-scraper',
    init: async () => {},
    scrape,
  }
  return { scraper, scrape }
}

async function configWith(cache: InMemoryCache): Promise<SinkConfig> {
  const config = await loadConfig()
  config.steep.scraper = 'fake-scraper'
  config.steep.extractor = 'fake-extractor'
  config.steep.cache = cache
  return config
}

describe('outletToDomain', () => {
  it('extracts host from a URL and strips www', () => {
    expect(outletToDomain('https://www.amazingradio.com/about')).toBe('amazingradio.com')
  })

  it('keeps a bare domain token', () => {
    expect(outletToDomain('amazingradio.com')).toBe('amazingradio.com')
  })

  it('slugifies free-text outlet names (no dot, so scraper will skip)', () => {
    expect(outletToDomain('BBC Radio 1')).toBe('bbc-radio-1')
    expect(outletToDomain("Pluggin' Baby")).toBe('pluggin-baby')
  })

  it('returns empty string for empty input', () => {
    expect(outletToDomain('')).toBe('')
  })
})

describe('steep', () => {
  beforeEach(() => {
    // Re-register fresh stubs before each test (registry is a module singleton).
    const { scraper } = makeScraper()
    registerScraper('fake-scraper', async () => scraper)
    const { provider } = makeExtractor({})
    registerProvider('fake-extractor', async () => provider)
  })

  it('scrapes an outlet and attributes a matching contact', async () => {
    const { scraper, scrape } = makeScraper()
    registerScraper('fake-scraper', async () => scraper)
    const { provider } = makeExtractor({
      outletInstagram: '@amazingradio',
      submissionEmail: 'music@amazingradio.com',
      recentPresenters: ['Sarah Jones'],
      contacts: {
        'Sarah Jones': { role: 'Producer', instagram: '@sarahj' },
      },
    })
    registerProvider('fake-extractor', async () => provider)

    const records = [
      record({ name: 'Sarah Jones', website: 'https://amazingradio.com' }),
      record({ name: 'Tom Richards', website: 'https://amazingradio.com' }),
    ]
    const config = await configWith(new InMemoryCache())
    const result = await steep(records, config)

    // One scrape powers both contacts at the outlet.
    expect(scrape).toHaveBeenCalledTimes(1)

    const sarah = result.find((r) => r.raw.name === 'Sarah Jones')
    const tom = result.find((r) => r.raw.name === 'Tom Richards')

    expect(sarah?.steep?.confirmedAtOutlet).toBe(true)
    expect(sarah?.steep?.contactInstagram).toBe('@sarahj')
    expect(sarah?.steep?.outletInstagram).toBe('@amazingradio')

    // Tom is at the same outlet but not named on the page.
    expect(tom?.steep?.confirmedAtOutlet).toBe(false)
    expect(tom?.steep?.outletInstagram).toBe('@amazingradio')

    // Both records are marked as having gone through steep.
    expect(sarah?.phases).toContain('steep')
    expect(tom?.phases).toContain('steep')
  })

  it('serves a fresh cached scrape without calling the scraper', async () => {
    const { scraper, scrape } = makeScraper()
    registerScraper('fake-scraper', async () => scraper)

    const cache = new InMemoryCache()
    const cached: SteepResult = {
      provider: 'fake-scraper-fake-extractor',
      outletDomain: 'amazingradio.com',
      scrapedAt: new Date(Date.now() - 1000).toISOString(),
      cacheAge: 0,
      outletInstagram: '@cached',
      confirmedAtOutlet: false,
      confidence: { overall: 'medium' },
    }
    await cache.set('amazingradio.com', cached)

    const records = [record({ name: 'Sarah Jones', website: 'https://amazingradio.com' })]
    const config = await configWith(cache)
    const result = await steep(records, config)

    expect(scrape).not.toHaveBeenCalled()
    const sarah = result[0]
    expect(sarah.steep?.outletInstagram).toBe('@cached')
    expect(sarah.steep?.cacheAge).toBeGreaterThan(0)
  })

  it('skips records with no resolvable outlet domain', async () => {
    const { scraper, scrape } = makeScraper()
    registerScraper('fake-scraper', async () => scraper)

    const records = [record({ name: 'Freelancer', outlet: undefined, website: undefined })]
    const config = await configWith(new InMemoryCache())
    const result = await steep(records, config)

    expect(scrape).not.toHaveBeenCalled()
    expect(result[0].steep).toBeUndefined()
    expect(result[0].phases).toContain('steep')
  })

  it('records an empty result when the scrape returns no text', async () => {
    const emptyScrape = vi.fn(async () => ({ text: '', pagesFetched: [] }))
    registerScraper('fake-scraper', async () => ({
      name: 'fake-scraper',
      init: async () => {},
      scrape: emptyScrape,
    }))

    const records = [record({ name: 'Sarah Jones', website: 'https://amazingradio.com' })]
    const config = await configWith(new InMemoryCache())
    const result = await steep(records, config)

    expect(emptyScrape).toHaveBeenCalledTimes(1)
    expect(result[0].steep?.confidence.overall).toBe('none')
    expect(result[0].steep?.confirmedAtOutlet).toBe(false)
  })

  it('does not scrape duplicate records', async () => {
    const { scraper, scrape } = makeScraper()
    registerScraper('fake-scraper', async () => scraper)

    const dupe = record({ name: 'Sarah Jones', website: 'https://amazingradio.com' })
    dupe.rinse = { duplicate: true, canonical: false }
    const records = [dupe]
    const config = await configWith(new InMemoryCache())
    const result = await steep(records, config)

    expect(scrape).not.toHaveBeenCalled()
    expect(result[0].steep).toBeUndefined()
  })
})
