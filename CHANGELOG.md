# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
