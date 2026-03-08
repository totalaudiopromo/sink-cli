# Contributing to sink-cli

Thanks for your interest in contributing. This guide covers what you need to get started.

## Dev Setup

```bash
git clone https://github.com/totalaudiopromo/sink-cli.git
cd sink-cli
pnpm install
pnpm build
```

## Scripts

| Command | What it does |
|---------|-------------|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm dev` | Watch mode |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm typecheck` | Type-check without emitting |

## Running locally

After building, you can run the CLI directly:

```bash
node dist/cli.js scrub test/fixtures/sample.csv --dry-run
```

## Tests

Tests live in `test/` and mirror `src/` structure. Run them before pushing:

```bash
pnpm test
```

All tests should pass. If you're adding a new feature, add tests for it. If you're fixing a bug, add a test that reproduces it.

## Code Style

- TypeScript strict mode
- UK spelling in user-facing text (colour, normalise, licence)
- No emojis in code or output
- Commits use `feat:` / `fix:` / `docs:` / `test:` / `chore:` prefixes

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pnpm typecheck && pnpm test` -- both must pass
4. Open a PR with a clear description of what changed and why

Keep PRs focused. One feature or fix per PR is ideal.

## Project Structure

```
src/
  cli.ts              CLI entry point (Commander)
  pipeline.ts         Pipeline orchestrator
  config.ts           Config loader
  types.ts            Shared types
  phases/
    scrub/            Email validation, parsing, typo correction
    rinse/            Deduplication strategies
    soak/             AI enrichment providers
  output/             CSV/JSON/JSONL formatters
  ui/                 Terminal UI (format helpers, TUI, interactive)
  utils/              MX cache, helpers
test/
  fixtures/           Sample CSV files
  scrub/              Scrub phase tests
  rinse/              Rinse phase tests
  soak/               Provider tests
  pipeline.test.ts    Integration tests
```

## Questions?

Open an issue. We're happy to help.
