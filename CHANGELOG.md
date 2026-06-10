# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **SMTP verification was a no-op in 0.1.0–0.2.0.** `scrub.smtpTimeout` is
  documented in seconds but was passed to the validator as milliseconds, so the
  default of 10 became a 10ms timeout — every `--smtp` check timed out and
  silently fell back to a "valid / medium confidence" verdict. The timeout is
  now converted correctly; results from `--smtp` runs on earlier versions
  should not be trusted.
- Config loading no longer swallows errors. An explicit `--config <path>` that
  is missing or fails to parse now exits with code 3; an auto-discovered config
  that fails to load warns and falls back to defaults (previously all failures
  were silent). Config files now load on Windows (`pathToFileURL`).
- `sink -v` and the URL-fetch User-Agent now report the real package version
  (was hardcoded to `0.1.0` while the package shipped as `0.2.0`).
- Demo images in the README now resolve (assets committed to `docs/demos/`).
- `pnpm build` cleans `dist/` first, so orphaned modules no longer ship to npm.

### Changed

- **`sink steep` now runs `scrub → rinse → steep`** instead of
  `scrub → soak → steep`. Steep does per-outlet channel discovery and never
  consumed soak's per-contact enrichment, so the implicit soak was wasted LLM
  cost. Use `sink wash` for the full pipeline including soak.
- Config: recommend `sink.config.mjs` / `.json`; `.ts` config requires Node
  >= 23.6. Removed the never-implemented `domain-cluster` dedup strategy from
  the example config.

### Internal

- CI now enforces `lint` and `format:check`; the publish workflow verifies the
  git tag matches `package.json` and runs the same gates.
- e2e tests no longer hit live DNS; added a test suite for the steep phase and
  for config loading (network-free, deterministic).

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
