```
     ___ (_)__  / /__
    (_-</ / _ \/  '_/
   /___/_/_//_/_/\_\
```

[![npm version](https://img.shields.io/npm/v/sink-cli.svg)](https://www.npmjs.com/package/sink-cli)
[![CI](https://github.com/totalaudiopromo/sink-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/totalaudiopromo/sink-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**Data hygiene for music PR.** Scrub, rinse, and soak your contact lists.

<p align="center">
  <img src="video/out/sink-quick.gif" alt="sink-cli demo" width="720" />
</p>

---

## Quick Start

```bash
npx sink-cli scrub contacts.csv          # validate emails
npx sink-cli rinse contacts.csv          # deduplicate
npx sink-cli wash contacts.csv           # full pipeline
```

Or install globally:

```bash
npm install -g sink-cli
sink scrub contacts.csv
```

## Commands

| Command               | Description                           |
| --------------------- | ------------------------------------- |
| `sink`                | Interactive menu (no args)            |
| `sink wash <file>`    | Full pipeline: scrub + rinse + soak   |
| `sink scrub <file>`   | Validate & clean emails               |
| `sink rinse <file>`   | Deduplicate contacts                  |
| `sink soak <file>`    | Enrich contacts with AI               |
| `sink spot <email>`   | Spot-check a single email (with SMTP) |
| `sink inspect <file>` | Data quality score                    |
| `sink drain <file>`   | Convert between formats               |
| `sink tui <file>`     | Full TUI dashboard                    |

## Why sink?

- **Built for music PR.** Knows BBC Radio 1 from Radio X, catches `bbc.com` → `bbc.co.uk` typos, flags role-based emails like `press@`. Not a generic email validator -- it understands your industry.
- **Zero config.** Point it at a CSV and go. Flexible header matching means it works with whatever your spreadsheet exports. No mapping files, no setup wizard.
- **Three phases, one metaphor.** Scrub cleans. Rinse deduplicates. Soak enriches. Run them individually or all at once with `wash`. Like doing the washing up, but for data.

## Phases

### Scrub

Validates and cleans email addresses:

- RFC 5322 format validation
- UK domain typo correction (`bbc.com` → `bbc.co.uk`, `gmial.com` → `gmail.com`)
- Disposable domain detection
- MX record verification
- Role-based email flagging (`press@`, `info@`)
- Catch-all domain detection
- Optional SMTP verification (`--smtp`)

### Rinse

Deduplicates and resolves identities:

- **Exact email** -- case-insensitive dedup, keeps the richer record
- **Fuzzy name** -- Jaro-Winkler similarity within same domain (threshold: 0.92)
- **Cross-field** -- matches by phone or website across different emails

### Soak

Enriches contacts with AI:

- Platform type detection (radio, press, playlist, blog, podcast)
- Genre identification
- Geographic scope
- Submission guidelines
- Pitch tips

Supports **Anthropic** (Claude Haiku) and **OpenAI** (GPT-4o-mini).

## Global Flags

```
-o, --output <path>       Output file path
--format <csv|json|jsonl>  Output format (default: csv)
--config <path>            Config file path
--dry-run                  Preview without writing files
--verbose                  Detailed output
-q, --quiet                Suppress all output except errors
--json                     JSON stdout (for piping)
--no-colour                Disable colours
--smtp                     Enable SMTP verification (scrub phase)
--provider <name>          Enrichment provider (anthropic|openai)
```

## Exit Codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| `0`  | Success                                                   |
| `1`  | File error (not found, permission denied, is a directory) |
| `2`  | Parse error (invalid CSV, no usable data)                 |
| `3`  | Config error (invalid config file)                        |
| `4`  | Pipeline error (enrichment failure, unexpected crash)     |

## Provider Setup

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
sink soak contacts.csv --provider anthropic
```

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
sink soak contacts.csv --provider openai
```

## Input Format

Accepts CSV files with flexible column names:

| Field   | Accepted Headers                             |
| ------- | -------------------------------------------- |
| Name    | name, contact, full name, person             |
| Email   | email, e mail, email address                 |
| Outlet  | outlet, publication, media, company, station |
| Role    | role, title, position, job title             |
| Phone   | phone, telephone, mobile                     |
| Website | website, url, web                            |
| Notes   | notes, comments, description                 |
| Tags    | tags, categories, labels                     |

First/last name columns are automatically joined. Unmapped columns are preserved in `extras`.

## Configuration

Create a `sink.config.ts` in your project root:

```typescript
export default {
  scrub: {
    smtp: false,
    mxCacheTTL: 1800,
    smtpTimeout: 10,
    typoMap: './data/custom-typos.json',
  },
  rinse: {
    fuzzyThreshold: 0.92,
    strategies: ['exact-email', 'fuzzy-name', 'cross-field'],
  },
  soak: {
    provider: 'anthropic',
    anthropic: {
      model: 'claude-haiku-4-5-20251001',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },
  output: {
    format: 'csv',
    locale: 'en-GB',
  },
}
```

## Programmatic API

```typescript
import { runPipeline, loadConfig } from 'sink-cli'

const config = await loadConfig()
const records = [
  {
    id: '1',
    raw: { name: 'Sarah Jones', email: 'sarah@bbc.co.uk', outlet: 'BBC Radio 1' },
    phases: [],
    timestamp: new Date().toISOString(),
  },
]

const { records: processed, stats } = await runPipeline(records, {
  phases: ['scrub', 'rinse'],
  config,
})

console.log(stats)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code style, and PR guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Licence

MIT
