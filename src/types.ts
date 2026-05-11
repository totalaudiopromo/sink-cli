/** Original row as parsed from CSV -- never mutated */
export interface RawRecord {
  name: string
  email?: string
  outlet?: string
  role?: string
  phone?: string
  website?: string
  notes?: string
  tags?: string[]
  extras?: Record<string, string>
}

/** Result of the scrub phase */
export interface ScrubResult {
  email: {
    valid: boolean
    normalised: string
    confidence: 'high' | 'medium' | 'low' | 'none'
    reason?: string
    corrected?: boolean
    original?: string
    suggested?: string
    catchAll?: boolean
    roleBased?: boolean
    disposable?: boolean
    smtpVerified?: boolean
    checks?: {
      regex: boolean
      typo: boolean
      disposable: boolean
      mx: boolean
      smtp?: boolean
    }
  }
}

/** Result of the rinse phase */
export interface RinseResult {
  duplicate: boolean
  mergedWith?: string
  matchType?: 'exact-email' | 'fuzzy-name' | 'cross-field'
  matchConfidence?: number
  canonical: boolean
}

/** Result of the soak phase */
export interface SoakResult {
  provider: string
  platform?: string
  platformType?: 'radio' | 'press' | 'playlist' | 'blog' | 'podcast'
  roleDetail?: string
  genres?: string[]
  coverageArea?: string
  contactMethod?: string
  bestTiming?: string
  submissionGuidelines?: string
  pitchTips?: string[]
  geographicScope?: 'national' | 'regional' | 'local'
  confidence: 'high' | 'medium' | 'low' | 'none'
  reasoning?: string
}

/** Confidence band per channel */
export type ChannelConfidence = 'high' | 'medium' | 'low'

/** Submission format expectations parsed from the outlet site */
export type SubmissionFormat = 'mp3' | 'link' | 'form' | 'mixed'

/**
 * Result of the steep phase.
 *
 * Outlet-level fields apply to every contact at that outlet (one scrape powers many records).
 * Contact-level fields are populated when the record's name appears on the scraped team / presenter
 * page. Confidence indicates how grounded each extraction is in the scraped text.
 */
export interface SteepResult {
  provider: string
  outletDomain: string
  scrapedAt: string
  cacheAge: number

  /** Outlet-level discoveries */
  outletInstagram?: string
  outletTwitter?: string
  outletLinkedIn?: string
  outletFacebook?: string
  submissionPortalUrl?: string
  submissionEmail?: string
  submissionFormat?: SubmissionFormat

  /** Per-contact attribution (set when name matches a presenter / team listing) */
  confirmedAtOutlet: boolean
  contactInstagram?: string
  contactLinkedIn?: string
  contactTwitter?: string
  contactRole?: string

  /** Grounded intelligence */
  recentPresenters?: string[]
  recentCoverage?: string[]
  pitchHooks?: string[]

  /** Per-field confidence bands. Overall reflects the outlet match. */
  confidence: {
    overall: 'high' | 'medium' | 'low' | 'none'
    instagram?: ChannelConfidence
    linkedIn?: ChannelConfidence
    portal?: ChannelConfidence
  }

  reasoning?: string
}

/** The record that flows through the pipeline */
export interface SinkRecord {
  id: string
  raw: RawRecord
  scrub?: ScrubResult
  rinse?: RinseResult
  soak?: SoakResult
  steep?: SteepResult
  phases: Phase[]
  timestamp: string
}

/** Aggregate stats across all phases */
export interface SinkStats {
  total: number
  scrub: {
    valid: number
    invalid: number
    risky: number
    typos: number
    domains: number
  }
  rinse: {
    duplicates: number
    merged: number
    fuzzyMatches: number
  }
  soak: {
    enriched: number
    failed: number
    skipped: number
  }
  steep: {
    outletsScraped: number
    outletsFromCache: number
    contactsMatched: number
    skipped: number
    failed: number
  }
  duration: number
}

/** Phase names */
export type Phase = 'scrub' | 'rinse' | 'soak' | 'steep'

/** Progress callback for phases */
export interface PhaseProgress {
  phase: Phase
  current: number
  total: number
  record?: SinkRecord
  message?: string
}

/**
 * LLM provider interface.
 *
 * Used by both soak (record-shaped enrich call) and steep (raw prompt
 * completion for grounded extraction). Providers must implement enrich;
 * complete is optional but required for steep.
 */
export interface SoakProvider {
  name: string
  init(config: Record<string, unknown>): Promise<void>
  enrich(record: SinkRecord): Promise<SoakResult>
  /** Send a raw prompt, return the assistant text. Required for steep. */
  complete?(prompt: string, opts?: { maxTokens?: number }): Promise<string>
  dispose?(): Promise<void>
}

/**
 * Outlet scraper interface for the steep phase.
 *
 * Implementations fetch and concatenate text from an outlet's website
 * (homepage + standard sub-paths). The grounded extractor then turns that
 * text into a SteepResult.
 */
export interface SteepScraper {
  name: string
  init(config: Record<string, unknown>): Promise<void>
  scrape(outletDomain: string): Promise<{ text: string; pagesFetched: string[] }>
  dispose?(): Promise<void>
}

/**
 * Cache adapter for outlet scrapes.
 *
 * CLI default: in-memory (single process lifetime).
 * TAP: Supabase-backed (shared across workspaces).
 */
export interface CacheAdapter {
  get(outletDomain: string): Promise<SteepResult | null>
  set(outletDomain: string, result: SteepResult): Promise<void>
  /** Optional: list cached domains, useful for admin tooling */
  list?(): Promise<string[]>
  /** Optional: invalidate a single domain */
  invalidate?(outletDomain: string): Promise<void>
}

/** Configuration */
export interface SinkConfig {
  scrub: {
    typoMap?: string
    rolePrefixes?: string[]
    catchAllDomains?: string[]
    musicTLDs?: string[]
    mxCacheTTL?: number
    smtpTimeout?: number
    smtp?: boolean
  }
  rinse: {
    fuzzyThreshold?: number
    strategies?: ('exact-email' | 'fuzzy-name' | 'cross-field')[]
  }
  soak: {
    provider: string
    rateLimit?: number
    maxRetries?: number
    [providerName: string]: unknown
  }
  steep: {
    /** Scraper provider name (currently 'firecrawl') */
    scraper: string
    /** LLM provider for grounded extraction (reuses soak's anthropic / openai) */
    extractor: string
    /** Optional cache adapter; defaults to in-memory if omitted */
    cache?: CacheAdapter
    /** How long a cached outlet scrape is considered fresh (ms). Default 30 days. */
    cacheTtl?: number
    /** Min ms between Firecrawl requests. Default 250. */
    rateLimit?: number
    /** Max retries on transient failures. Default 2. */
    maxRetries?: number
    /** Provider-specific settings (apiKey, model, etc.) */
    [providerName: string]: unknown
  }
  output: {
    format: 'csv' | 'json' | 'jsonl'
    locale: string
  }
}
