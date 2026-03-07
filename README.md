# sink

Data hygiene for music PR. Scrub, rinse, and soak your contact lists.

```
sink wash contacts.csv
```

Three-phase pipeline for cleaning, deduplicating, and enriching music industry contact data.

## Install

```bash
npm install -g sink-cli
```

Or use without installing:

```bash
npx sink-cli wash contacts.csv
```

## Quick Start

```bash
# Full pipeline: clean, dedup, enrich
sink wash contacts.csv

# Just validate emails
sink scrub contacts.csv

# Deduplicate contacts
sink rinse contacts.csv

# Enrich with AI
sink soak contacts.csv --provider anthropic

# Check a single email
sink verify sarah@bbc.co.uk

# Data quality score
sink stats contacts.csv

# Interactive mode
sink
```

## Commands

| Command | Description |
|---------|-------------|
| `sink` | Interactive menu (no args) |
| `sink wash <file>` | Full pipeline: scrub, rinse, soak |
| `sink scrub <file>` | Phase 1: syntax cleaning + email validation |
| `sink rinse <file>` | Phase 2: dedup + identity resolution |
| `sink soak <file>` | Phase 3: enrichment + metadata hydration |
| `sink drain <file>` | Export / convert between formats |
| `sink verify <email>` | Single email check with SMTP |
| `sink stats <file>` | Data quality score |
| `sink tui <file>` | Full TUI dashboard |

## Global Flags

```
--output, -o <path>      Output path
--format <csv|json|jsonl> Output format (default: csv)
--config <path>          Config file path
--dry-run                Preview without writing
--verbose                Detailed output
--json                   JSON stdout (for piping)
--no-colour              Disable colours
--smtp                   Enable SMTP verification (scrub phase)
--provider <name>        Soak enrichment provider (anthropic|openai)
```

## Phases

### Scrub

Validates and cleans email addresses:

- RFC 5322 format validation
- UK domain typo correction (bbc.com -> bbc.co.uk, gmial.com -> gmail.com)
- Disposable domain detection
- MX record verification
- Role-based email flagging (press@, info@)
- Catch-all domain detection
- Optional SMTP verification

### Rinse

Deduplicates and resolves identities:

- **Exact email** -- case-insensitive email dedup, keeps richer record
- **Fuzzy name** -- Jaro-Winkler similarity within same domain (threshold: 0.92)
- **Domain cluster** -- groups contacts by email domain
- **Cross-field** -- matches by phone or website across different emails

### Soak

Enriches contacts with AI:

- Platform type detection (radio, press, playlist, blog, podcast)
- Genre identification
- Geographic scope
- Submission guidelines
- Pitch tips

Supports **Anthropic** (Claude Haiku) and **OpenAI** (GPT-4o-mini) out of the box.

## Configuration

Create a `sink.config.ts` in your project root:

```typescript
export default {
  scrub: {
    smtp: false,
    mxCacheTTL: 1800,
    smtpTimeout: 10,
  },
  rinse: {
    fuzzyThreshold: 0.92,
    strategies: ['exact-email', 'fuzzy-name', 'domain-cluster', 'cross-field'],
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
};
```

See `sink.config.example.ts` for all options.

## Programmatic API

```typescript
import { runPipeline, loadConfig } from 'sink-cli';

const config = await loadConfig();
const records = [
  {
    id: '1',
    raw: { name: 'Sarah Jones', email: 'sarah@bbc.co.uk', outlet: 'BBC Radio 1' },
    phases: [],
    timestamp: new Date().toISOString(),
  },
];

const { records: processed, stats } = await runPipeline(records, {
  phases: ['scrub', 'rinse'],
  config,
});

console.log(stats);
```

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

## Custom Typo Map

Add your own domain corrections:

```json
{
  "radiox.co.k": "radiox.co.uk",
  "amazingrdio.com": "amazingradio.com"
}
```

```typescript
// sink.config.ts
export default {
  scrub: {
    typoMap: './data/custom-typos.json',
  },
};
```

## Input Format

Accepts CSV files with flexible column names:

| Field | Accepted Headers |
|-------|-----------------|
| Name | name, contact, full name, person |
| Email | email, e mail, email address |
| Outlet | outlet, publication, media, company, station |
| Role | role, title, position, job title |
| Phone | phone, telephone, mobile |
| Website | website, url, web |
| Notes | notes, comments, description |
| Tags | tags, categories, labels |

First/last name columns are automatically joined. Unmapped columns are preserved in `extras`.

## Licence

MIT
