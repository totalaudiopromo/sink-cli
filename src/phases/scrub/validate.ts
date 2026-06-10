/**
 * Email validation engine
 *
 * Native implementation with music-industry extras:
 * - RFC 5322 format validation (pure)
 * - Configurable domain typo correction (pure)
 * - Role-based email detection (press@, info@, etc.) (pure)
 * - Disposable domain detection via a vendored list (pure)
 * - Catch-all domain flagging (pure)
 * - MX record verification with a cache layer (Node-only, see net.ts)
 * - Domain-grouped batch validation for efficiency
 *
 * The pure checks have no Node dependencies; everything network-bound is
 * isolated in net.ts so this module can back a browser build with the MX
 * check stubbed out.
 */

import { MxCache } from '../../utils/mx-cache.js'
import { correctDomain } from './typo-map.js'
import { isDisposableDomain } from './disposable.js'
import { hasMxRecord } from './net.js'
import type { ScrubResult } from '../../types.js'

type EmailResult = ScrubResult['email']

const DEFAULT_ROLE_PREFIXES = [
  'info',
  'admin',
  'support',
  'contact',
  'hello',
  'enquiries',
  'press',
  'music',
  'submissions',
  'playlist',
  'programming',
  'studio',
  'news',
  'editorial',
  'general',
  'office',
  'reception',
]

const DEFAULT_MUSIC_TLDS = [
  '.org.uk',
  '.org.au',
  '.co.uk',
  '.co.nz',
  '.co.za',
  '.ac.uk',
  '.fm',
  '.radio',
  '.media',
  '.press',
  '.music',
  '.band',
  '.community',
  '.org',
]

const DEFAULT_CATCH_ALL = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'bbc.co.uk',
  'aol.com',
  'protonmail.com',
  'hotmail.co.uk',
  'yahoo.co.uk',
  'live.co.uk',
  'btinternet.com',
]

export interface ValidateConfig {
  /**
   * Accepted for backwards compatibility; SMTP verification was removed in
   * 0.3.0 (see net.ts). MX-level checks always run.
   */
  smtp?: boolean
  /** Accepted for backwards compatibility; unused since SMTP removal. */
  smtpTimeout?: number
  rolePrefixes?: string[]
  catchAllDomains?: string[]
  musicTLDs?: string[]
  mxCacheTTL?: number
  onProgress?: (email: string, result: EmailResult, index: number, total: number) => void
}

function isValidEmailFormat(email: string): boolean {
  // RFC 5322 compliant local part (no quoted strings) + standard domain
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
    email,
  )
}

function isAllowlistedTLD(domain: string, musicTLDs: string[]): boolean {
  return musicTLDs.some((tld) => domain.endsWith(tld))
}

export async function validateEmail(
  email: string,
  config: ValidateConfig & { mxCache: MxCache },
): Promise<EmailResult> {
  const { mxCache } = config
  const rolePrefixes = new Set(config.rolePrefixes ?? DEFAULT_ROLE_PREFIXES)
  const musicTLDs = config.musicTLDs ?? DEFAULT_MUSIC_TLDS
  const catchAllDomains = new Set(config.catchAllDomains ?? DEFAULT_CATCH_ALL)

  const normalised = email.toLowerCase().trim()

  const atIndex = normalised.indexOf('@')
  if (atIndex === -1) {
    return { valid: false, normalised, reason: 'invalid_format', confidence: 'none' }
  }

  const localPart = normalised.slice(0, atIndex)
  let domain = normalised.slice(atIndex + 1)
  let workingEmail = normalised
  let corrected = false
  let original: string | undefined
  let suggested: string | undefined

  const isRoleBased = rolePrefixes.has(localPart)

  // Domain typo correction
  const typoResult = correctDomain(localPart, domain)
  if (typoResult) {
    original = normalised
    suggested = typoResult.correctedEmail
    workingEmail = typoResult.correctedEmail
    domain = typoResult.correctedDomain
    corrected = true
  }

  // Format check
  if (!isValidEmailFormat(workingEmail)) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'invalid_format',
      confidence: 'none',
      corrected: corrected || undefined,
      original,
      suggested,
    }
  }

  // Disposable check (allowlisted music TLDs are never treated as disposable)
  if (isDisposableDomain(domain) && !isAllowlistedTLD(domain, musicTLDs)) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'disposable_domain',
      confidence: 'low',
      disposable: true,
      roleBased: isRoleBased || undefined,
      corrected: corrected || undefined,
      original,
      suggested,
      checks: { regex: true, typo: !corrected, disposable: false, mx: false },
    }
  }

  // MX check (cached per domain)
  const cachedMx = mxCache.get(domain)
  let mxOk: boolean
  if (cachedMx !== null) {
    mxOk = cachedMx.hasMx
  } else {
    mxOk = await hasMxRecord(domain)
    mxCache.set(domain, mxOk)
  }

  if (!mxOk) {
    return {
      valid: false,
      normalised: workingEmail,
      reason: 'no_mx_record',
      confidence: 'low',
      roleBased: isRoleBased || undefined,
      corrected: corrected || undefined,
      original,
      suggested,
      checks: { regex: true, typo: !corrected, disposable: true, mx: false },
    }
  }

  const isCatchAll = catchAllDomains.has(domain)
  const confidence: EmailResult['confidence'] = isRoleBased || isCatchAll ? 'medium' : 'high'

  return {
    valid: true,
    normalised: workingEmail,
    confidence,
    corrected: corrected || undefined,
    original,
    suggested,
    catchAll: isCatchAll || undefined,
    roleBased: isRoleBased || undefined,
    disposable: false,
    checks: { regex: true, typo: !corrected, disposable: true, mx: true },
  }
}

/**
 * Validate a batch of emails efficiently.
 * Groups emails by domain so each domain's MX lookup happens once and is
 * served from cache for every other address at that domain.
 */
export async function validateEmailBatch(
  emails: string[],
  config: ValidateConfig = {},
): Promise<Map<string, EmailResult>> {
  const { onProgress } = config
  const concurrency = 10
  const mxCache = new MxCache(config.mxCacheTTL)
  const results = new Map<string, EmailResult>()
  let completed = 0

  // Group by (typo-corrected) domain
  const byDomain = new Map<string, string[]>()
  for (const email of emails) {
    const normalised = email.toLowerCase().trim()
    const atIndex = normalised.indexOf('@')
    if (atIndex === -1) {
      const bucket = byDomain.get('') ?? []
      bucket.push(email)
      byDomain.set('', bucket)
      continue
    }
    let domain = normalised.slice(atIndex + 1)
    const localPart = normalised.slice(0, atIndex)
    const typo = correctDomain(localPart, domain)
    if (typo) domain = typo.correctedDomain

    const bucket = byDomain.get(domain) ?? []
    bucket.push(email)
    byDomain.set(domain, bucket)
  }

  // Process the first email per domain before the remainder so the MX cache
  // is primed once per domain rather than racing duplicate lookups.
  const firstPerDomain: string[] = []
  const remainder: string[] = []
  for (const bucket of byDomain.values()) {
    const [first, ...rest] = bucket
    firstPerDomain.push(first)
    remainder.push(...rest)
  }

  const ordered = [...firstPerDomain, ...remainder]
  const queue = [...ordered]

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const email = queue.shift()!
      const result = await validateEmail(email, { ...config, mxCache })
      results.set(email, result)
      completed++
      onProgress?.(email, result, completed, ordered.length)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ordered.length) }, () => processNext())
  await Promise.allSettled(workers)

  return results
}
