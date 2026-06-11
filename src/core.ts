/**
 * Browser-safe entry point ("datasink/core").
 *
 * Everything exported here is free of top-level Node imports. Two modules
 * have Node/browser twins swapped by the package.json "browser" field:
 *   - phases/scrub/net.ts        -> net.browser.ts (MX via DNS-over-HTTPS)
 *   - phases/scrub/typo-map.ts   -> typo-map.browser.ts (no custom map files)
 *
 * Node-only APIs (loadConfig, drain, VERSION, the CLI) stay on the root
 * entry; soak and steep are excluded because they require provider API keys.
 */

// Parse
export { parseCSV, parseRows } from './phases/scrub/parse.js'

// Scrub
export { validateEmail, validateEmailBatch } from './phases/scrub/validate.js'
export { scrub } from './phases/scrub/index.js'
export { correctDomain, getTypoMap, DEFAULT_TYPO_MAP } from './phases/scrub/typo-map-data.js'
export { isDisposableDomain } from './phases/scrub/disposable.js'

// Rinse
export { rinse } from './phases/rinse/index.js'
export { exactDedup } from './phases/rinse/exact-dedup.js'
export { fuzzyMatch, jaroWinkler } from './phases/rinse/fuzzy-match.js'
export { crossFieldMatch } from './phases/rinse/identity.js'

// Note: runPipeline stays on the root entry only — its lazy phase loading
// pulls soak/steep (and their Node-flavoured deps) into browser bundles.
// Browser consumers compose scrub() and rinse() directly.

// Output
export { generateCSV } from './output/csv.js'
export { generateJSON, generateJSONL } from './output/json.js'

// Utilities
export { MxCache } from './utils/mx-cache.js'
export { InMemoryCache } from './phases/steep/cache/in-memory.js'
export { outletToDomain } from './phases/steep/provider.js'

// Demo data
export { DEMO_CSV } from './demo-data.js'

// Types
export type {
  SinkRecord,
  RawRecord,
  ScrubResult,
  RinseResult,
  SinkStats,
  SinkConfig,
  Phase,
  PhaseProgress,
  CacheAdapter,
} from './types.js'
