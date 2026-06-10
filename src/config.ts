import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SinkConfig } from './types.js'

/** Thrown when a config file is present but cannot be loaded or parsed. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const DEFAULT_CONFIG: SinkConfig = {
  scrub: {
    mxCacheTTL: 1800,
    smtpTimeout: 10,
    smtp: false,
  },
  rinse: {
    fuzzyThreshold: 0.92,
    strategies: ['exact-email', 'fuzzy-name', 'cross-field'],
  },
  soak: {
    provider: 'anthropic',
    rateLimit: 200,
    maxRetries: 3,
  },
  steep: {
    scraper: 'firecrawl',
    extractor: 'anthropic',
    rateLimit: 250,
    maxRetries: 2,
    cacheTtl: 30 * 24 * 60 * 60 * 1000,
  },
  output: {
    format: 'csv',
    locale: 'en-GB',
  },
}

/**
 * Deep merge two objects. Arrays are replaced, not concatenated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const val = source[key]
    if (
      val !== undefined &&
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], val)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

/**
 * Load and parse a single config file. JSON is read directly; .mjs/.js/.ts are
 * dynamically imported (pathToFileURL keeps this working on Windows). Note that
 * .ts only loads on Node >= 23.6 (native type stripping); on older Node use
 * sink.config.mjs or sink.config.json.
 */
async function loadOne(fullPath: string): Promise<Partial<SinkConfig>> {
  if (fullPath.endsWith('.json')) {
    const text = readFileSync(fullPath, 'utf-8')
    return JSON.parse(text) as Partial<SinkConfig>
  }
  const mod = await import(pathToFileURL(fullPath).href)
  return (mod.default ?? mod) as Partial<SinkConfig>
}

/**
 * Resolve a config file from disk.
 *
 * - An explicit configPath that is missing or fails to load throws ConfigError
 *   (the user asked for that file by name -- silently ignoring it is wrong).
 * - During auto-discovery, absent candidates are skipped silently; a candidate
 *   that exists but fails to load emits a warning and falls back to defaults.
 */
async function loadConfigFile(configPath?: string): Promise<Partial<SinkConfig>> {
  if (configPath) {
    const fullPath = resolve(configPath)
    if (!existsSync(fullPath)) {
      throw new ConfigError(`Config file not found: ${configPath}`)
    }
    try {
      return await loadOne(fullPath)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new ConfigError(`Failed to load config ${configPath}: ${detail}`)
    }
  }

  const candidates = ['sink.config.mjs', 'sink.config.js', 'sink.config.ts', 'sink.config.json']
  for (const candidate of candidates) {
    const fullPath = resolve(candidate)
    if (!existsSync(fullPath)) continue
    try {
      return await loadOne(fullPath)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const hint = candidate.endsWith('.ts')
        ? ' (.ts config needs Node >= 23.6; use sink.config.mjs or .json on older Node)'
        : ''
      console.warn(`  Warning: found ${candidate} but could not load it${hint}. Using defaults.`)
      console.warn(`  ${detail}`)
      return {}
    }
  }

  return {}
}

/**
 * Load config with merge order: defaults -> config file -> CLI overrides.
 */
export async function loadConfig(options?: {
  configPath?: string
  overrides?: Partial<SinkConfig>
}): Promise<SinkConfig> {
  const fileConfig = await loadConfigFile(options?.configPath)
  let config = deepMerge(DEFAULT_CONFIG, fileConfig)
  if (options?.overrides) {
    config = deepMerge(config, options.overrides)
  }
  return config
}

export { DEFAULT_CONFIG }
