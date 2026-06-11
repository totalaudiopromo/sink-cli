# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-06-11

### Added

- **Browser-safe `datasink/core` entry.** Parse, scrub (format, typo, role,
  disposable, MX), rinse, and output generation now run in the browser. The
  package `browser` field swaps the MX check to Cloudflare DNS-over-HTTPS
  (domains only — full addresses never leave the machine) and the typo-map
  loader to a no-fs twin.
- **Web demo** ([sink-web-indol.vercel.app](https://sink-web-indol.vercel.app),
  source in `web/`): a single-page app that runs the real engine client-side
  and renders the run as a live terminal session in the CLI's exact visual
  language. pnpm workspace package; fully static; no backend.

### Changed

- Naming made explicit everywhere: the product and binary are **sink**;
  `datasink` is the npm package name (the `sink` name is taken on npm, and
  `sink-cli` is blocked by npm's spelling-similarity rule). README, npm
  description/keywords, and the web page now all state this.

## [0.3.0] - 2026-06-10

### Security

- **Production dependencies now carry zero known vulnerabilities** (down from
  23 advisories, 10 high). Replaced `deep-email-validator` — which pinned a
  vulnerable axios 0.x — with a native implementation: RFC 5322 format, UK
  typo correction, role detection, catch-all flagging and a vendored
  disposable-domain list are pure functions; MX verification uses
  `node:dns/promises` with the existing per-domain cache. The pure/network
  split also clears the path for a future browser build.
- Overrode transitive `ws` to >= 8.20.1 (uninitialized memory disclosure
  advisory, pulled in via ink and openai).

### Removed

- **SMTP mailbox verification (`--smtp`) has been removed.** It never actually
  worked: `scrub.smtpTimeout` is documented in seconds but was consumed as
  milliseconds, so the default of 10 became a 10ms timeout — every `--smtp`
  check timed out and silently fell back to a "valid / medium confidence"
  verdict. Rather than fix probing that major providers (Gmail, Microsoft 365)
  deliberately mislead, and that requires outbound port 25, it has been
  removed. The `--smtp` flag is still accepted as a no-op with a warning so
  existing scripts don't break. MX-level domain verification always runs.
  Results from `--smtp` runs on earlier versions should not be trusted.

### Fixed

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

- CI now enforces `lint`, `format:check`, and coverage thresholds; the publish
  workflow verifies the git tag matches `package.json` and runs the same gates.
  CI pnpm bumped to 11 to match the lockfile.
- Tests no longer hit live DNS anywhere (the network layer is mocked); added
  test suites for the steep phase, config loading, and the new validator
  (83 tests).

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
