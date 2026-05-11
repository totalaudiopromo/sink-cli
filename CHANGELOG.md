# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-02

### Added

- `steep` phase: outlet-level channel discovery via Firecrawl. For each unique outlet in the input, scrapes homepage and standard sub-paths (`/about`, `/contact`, `/team`, `/presenters`, `/submit`, `/submissions`), then runs grounded extraction over the scraped text to pull structured channels (Instagram, LinkedIn, Twitter, Facebook), submission portal URL, submission email, submission format, recent presenters, recent coverage, and pitch hooks.
- `steep` CLI command: runs scrub → soak → steep on a CSV, emits enriched output with channel fields populated.
- `wash` now includes steep as the final phase: scrub → rinse → soak → steep.
- `CacheAdapter` interface and `InMemoryCache` default implementation. Consumers (e.g. TAP) can plug in their own (Supabase, Redis, file-system) for shared caching.
- Outlet scrapes are cached for 30 days by default. One scrape powers every contact at that outlet.
- Per-contact attribution: when a contact's name appears on a scraped team / presenter page, their personal handles are extracted and confidence is promoted to `high`.
- New `complete(prompt)` method on the LLM provider interface, used by steep for grounded extraction. Soak's `enrich` now delegates to `complete` internally.
- Programmatic exports for steep and the cache adapter (`import { steep, InMemoryCache, outletToDomain } from 'datasink'`).

### Requirements

- Steep requires `FIRECRAWL_API_KEY` and `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`). Phase is silently skipped if creds are missing.

## [0.1.0] - 2026-03-07

### Added

- Three-phase pipeline: scrub (validate), rinse (dedup), soak (enrich)
- `wash` command for full pipeline execution
- `scrub` command with RFC 5322 validation, UK domain typo correction, disposable detection, MX verification, role-based flagging, catch-all detection, and optional SMTP verification
- `rinse` command with exact email, fuzzy name (Jaro-Winkler), domain cluster, and cross-field deduplication strategies
- `soak` command with Anthropic (Claude Haiku) and OpenAI (GPT-4o-mini) enrichment providers
- `spot` command for single email checks
- `inspect` command for data quality scoring
- `drain` command for format conversion (CSV, JSON, JSONL)
- `tui` command for full terminal dashboard (Ink)
- Interactive mode when run with no arguments
- Resilient CSV parser with flexible header matching
- Configurable via `sink.config.ts`
- Programmatic API (`runPipeline`, `loadConfig`)
- `--quiet` flag to suppress all output except errors
- `--dry-run` flag for previewing without writing files
- `--json` flag for machine-readable output
- 39 unit tests
