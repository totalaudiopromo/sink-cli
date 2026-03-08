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

/** The record that flows through the pipeline */
export interface SinkRecord {
  id: string
  raw: RawRecord
  scrub?: ScrubResult
  rinse?: RinseResult
  soak?: SoakResult
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
  duration: number
}

/** Phase names */
export type Phase = 'scrub' | 'rinse' | 'soak'

/** Progress callback for phases */
export interface PhaseProgress {
  phase: Phase
  current: number
  total: number
  record?: SinkRecord
  message?: string
}

/** Soak provider interface */
export interface SoakProvider {
  name: string
  init(config: Record<string, unknown>): Promise<void>
  enrich(record: SinkRecord): Promise<SoakResult>
  dispose?(): Promise<void>
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
  output: {
    format: 'csv' | 'json' | 'jsonl'
    locale: string
  }
}
