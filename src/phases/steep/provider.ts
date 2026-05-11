export type { SteepScraper, CacheAdapter, SteepResult } from '../../types.js'

export class SteepConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SteepConfigError'
  }
}

/**
 * Normalise a free-text outlet name into a stable domain key.
 *
 * "BBC Radio 1"           -> "bbc.co.uk"
 * "https://amazingradio.com/about" -> "amazingradio.com"
 * "Pluggin' Baby"         -> "plugginbaby"   (no domain found, fall back to slug)
 *
 * Heuristic only -- the steep phase prefers SinkRecord.raw.website if present,
 * and falls back to this slug otherwise.
 */
export function outletToDomain(input: string): string {
  if (!input) return ''
  const trimmed = input.trim().toLowerCase()

  // URL form
  const urlMatch = trimmed.match(/^https?:\/\/([^/]+)/)
  if (urlMatch) {
    return urlMatch[1].replace(/^www\./, '')
  }

  // Domain-like token
  const domainMatch = trimmed.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/)
  if (domainMatch) {
    return domainMatch[1].replace(/^www\./, '')
  }

  // Fall back to a slug (will not collide with real domains because no dot)
  return trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
