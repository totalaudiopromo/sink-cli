import type { SinkConfig } from './src/types.js';

const config: Partial<SinkConfig> = {
  scrub: {
    // Path to custom domain typo correction map (JSON)
    // typoMap: './data/custom-typos.json',

    // Override role-based email prefixes
    // rolePrefixes: ['info', 'admin', 'press', 'submissions'],

    // Override catch-all domain list
    // catchAllDomains: ['gmail.com', 'yahoo.com'],

    // MX cache TTL in seconds (default: 1800)
    // mxCacheTTL: 1800,

    // SMTP verification timeout in seconds (default: 10)
    // smtpTimeout: 10,

    // Enable SMTP verification (default: false)
    // smtp: false,
  },

  rinse: {
    // Jaro-Winkler similarity threshold for fuzzy name matching (default: 0.92)
    // fuzzyThreshold: 0.92,

    // Dedup strategies to run, in order
    // strategies: ['exact-email', 'fuzzy-name', 'domain-cluster', 'cross-field'],
  },

  soak: {
    // Which AI provider to use for enrichment
    // Can also use shortcuts via CLI: --provider haiku|sonnet|opus|codex|gpt-4o-mini
    provider: 'anthropic',

    // Anthropic config
    // Models: 'claude-haiku-4-5-20251001' (fast/cheap), 'claude-sonnet-4-5-20250514' (balanced), 'claude-opus-4-0-20250514' (most capable)
    // Or use aliases: 'haiku', 'sonnet', 'opus'
    anthropic: {
      model: 'claude-haiku-4-5-20251001',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },

    // OpenAI config
    // Models: 'gpt-4o-mini', 'codex-mini-latest' (or alias: 'codex')
    // openai: {
    //   model: 'gpt-4o-mini',
    //   apiKey: process.env.OPENAI_API_KEY,
    // },
  },

  output: {
    format: 'csv',
    locale: 'en-GB',
  },
};

export default config;
