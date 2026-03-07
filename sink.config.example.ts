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
    provider: 'anthropic',

    // Anthropic config
    anthropic: {
      model: 'claude-haiku-4-5-20251001',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },

    // OpenAI config
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
