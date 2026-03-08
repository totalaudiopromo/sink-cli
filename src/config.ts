import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SinkConfig } from './types.js';

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
  output: {
    format: 'csv',
    locale: 'en-GB',
  },
};

/**
 * Deep merge two objects. Arrays are replaced, not concatenated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (
      val !== undefined &&
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Try to load a config file from disk.
 * Supports .ts, .js, and .json extensions.
 */
async function loadConfigFile(
  configPath?: string
): Promise<Partial<SinkConfig>> {
  const candidates = configPath
    ? [configPath]
    : ['sink.config.ts', 'sink.config.js', 'sink.config.json'];

  for (const candidate of candidates) {
    const fullPath = resolve(candidate);
    try {
      if (candidate.endsWith('.json')) {
        const text = readFileSync(fullPath, 'utf-8');
        return JSON.parse(text) as Partial<SinkConfig>;
      }
      // Dynamic import for .ts/.js
      const mod = await import(fullPath);
      return (mod.default ?? mod) as Partial<SinkConfig>;
    } catch {
      // File not found or import failed -- try next
    }
  }

  return {};
}

/**
 * Load config with merge order: defaults -> config file -> CLI overrides.
 */
export async function loadConfig(options?: {
  configPath?: string;
  overrides?: Partial<SinkConfig>;
}): Promise<SinkConfig> {
  const fileConfig = await loadConfigFile(options?.configPath);
  let config = deepMerge(DEFAULT_CONFIG, fileConfig);
  if (options?.overrides) {
    config = deepMerge(config, options.overrides);
  }
  return config;
}

export { DEFAULT_CONFIG };
