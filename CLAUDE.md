# sink-cli

Data hygiene CLI for music PR contact lists. Scrub, rinse, soak, and steep your CSV contacts.
Part of the Total Audio Promo agent-native suite — TAP (`totalaudiopromo.com`) is the flagship;
sink-cli is a public tool published separately on npm.

**Directory name vs npm name**: the directory is `sink-cli` but the npm package is published as
`datasink` (the `sink` name was taken). The CLI binary is still called `sink`. Always refer to
the npm package as `datasink`, not `sink-cli`.

## Stack

TypeScript + ESM, built with `tsc` directly (not tsup), Node >= 20. Single package. Web demo
lives in the `web/` subdirectory (Vite + React) and deploys to datasink.dev.

## Commands that matter

```bash
pnpm build        # clean → tsc → dist/
pnpm dev          # tsc --watch (incremental)
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm test:coverage  # vitest run --coverage
pnpm lint         # eslint src/ test/
```

The `prepublishOnly` hook runs `pnpm test && pnpm build` automatically before `npm publish`.

## Pipeline phases

`scrub` → `rinse` → `soak` → `steep`

Browser-safe variants exist for some phases (see `browser` field in package.json for the
module remapping). The `datasink/core` export exposes `buildPrompt`, `buildSteepPrompt`, etc.
for library consumers.

## Publish flow (npm)

Published as `datasink` (no scope). Current version 0.4.0 is not yet published to npm
(the web demo was the focus; CLI behaviour is unchanged from 0.3.x).

**2FA gotcha**: interactive `npm publish` hits the 2FA wall in non-interactive environments.
Use a granular **automation token** (npm account → Access Tokens → Generate New Token →
Automation) set in `~/.npmrc` as `//registry.npmjs.org/:_authToken=<automation-token>`.
Check the token type before any publish attempt.

## Web demo

`web/` is a Vite + React app. Deploy: `cd web && vercel build --prod && vercel deploy --prebuilt --prod`
(auto-deploy requires Root Directory = `web` in the Vercel `sink-web` project settings — see NEXT_SESSION.md).

## House standards

UK spelling, GBP currency, `feat:`/`fix:` commit prefixes. Calm professional tone.

## PR watching

Subscribe to PR events + arm exactly ONE fallback check-in 2-4 hours out. Never chain
hourly re-arms — an hourly send_later loop re-reads the whole session context every fire
to learn "still green" (22 Jul 2026 audit found these chains burning in this repo). On
merge/close: unsubscribe and delete any pending trigger. Full rule:
total-audio-platform/.claude/rules/pr-watching.md.

## Writing rule (anti-slop, standing)

Any prose written in this repo (docs, README, marketing copy, UI text) follows the voice
rules in total-audio-platform/.claude/skills/brand-voice-guide/voice-dna.md. The short
version: no em dashes, no negation-assertion ("this is not X, it is Y"), no staccato
fragment runs, no tricolons, no delve/leverage/seamless/ecosystem AI vocabulary,
first-person specific over third-person hypothetical, UK spelling. Public-facing copy
additionally passes commodity-gate + brand-voice-guide before publishing. If it reads
like a language model wrote it, rewrite it before committing.
