import chalk from 'chalk'
import ora from 'ora'
import { truncate } from './theme.js'
import type { SinkStats } from '../types.js'

// ── Glyphs ──────────────────────────────────────────────────────────
const DIAMOND = chalk.cyan('\u25C7')

export const LOGO_LINES = [
  '     ___ (_)__  / /__',
  "    (_-</ / _ \\/  '_/",
  '   /___/_/_//_/_/\\_\\',
]
const CHECK = chalk.green('\u2713')
const CROSS = chalk.red('\u2717')
const TILDE = chalk.yellow('~')

function num(n: number): string {
  return n.toLocaleString('en-GB')
}

// ── Exports ──────────────────────────────────────────────────────────

export function intro(version: string): void {
  console.log('')
  console.log(chalk.cyan(LOGO_LINES[0]))
  console.log(`${chalk.cyan(LOGO_LINES[1])}   ${chalk.dim(`v${version}`)}`)
  console.log(chalk.cyan(LOGO_LINES[2]))
  console.log('')
}

export function step(message: string): void {
  console.log(`  ${message}`)
}

export function stepComplete(message: string): void {
  console.log(`  ${DIAMOND} ${message}`)
}

export function blank(): void {
  console.log('')
}

export function validationRow(
  status: 'ok' | 'fail' | 'warn',
  label: string,
  count: number,
  unit: string,
): void {
  const icon = status === 'ok' ? CHECK : status === 'fail' ? CROSS : TILDE
  const countStr = num(count).padStart(6)
  console.log(`  ${icon} ${label.padEnd(18)}${chalk.dim(countStr)} ${chalk.dim(unit)}`)
}

export function divider(): void {
  console.log(chalk.dim(`  ${'\u2500'.repeat(44)}`))
}

export function summary(stats: SinkStats): void {
  const parts = [
    chalk.green(`${num(stats.scrub.valid)} valid`),
    chalk.red(`${num(stats.scrub.invalid)} invalid`),
    chalk.yellow(`${num(stats.scrub.risky)} risky`),
  ]
  console.log(`  ${parts.join(chalk.dim('  \u00B7  '))}`)

  const secondary = [
    `${num(stats.scrub.typos)} typos fixed`,
    `${num(stats.rinse.duplicates)} dupes merged`,
    `${num(stats.soak.enriched)} enriched`,
  ]
  console.log(`  ${chalk.dim(secondary.join('  \u00B7  '))}`)
}

export function outputPath(path: string): void {
  console.log(`  ${chalk.dim('\u2192')} ${chalk.cyan(path)}`)
}

export function outro(elapsedMs: number): void {
  const secs = (elapsedMs / 1000).toFixed(1)
  console.log(`  ${chalk.dim(`Done in ${secs}s`)}`)
  console.log('')
}

// ── Rich output functions ───────────────────────────────────────

export function computeQualityScore(stats: SinkStats): number {
  const total = stats.scrub.valid + stats.scrub.invalid + stats.scrub.risky
  if (total === 0) return 0
  return Math.round(((stats.scrub.valid + stats.scrub.risky * 0.5) / total) * 100)
}

export function qualityScore(stats: SinkStats): void {
  const score = computeQualityScore(stats)
  const colour = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red
  console.log(`  Quality: ${colour(score + '%')}`)
}

export function transformSummary(inputCount: number, stats: SinkStats): void {
  const parts = [
    chalk.green(`${num(stats.scrub.valid)} verified`),
    chalk.yellow(`${num(stats.scrub.risky)} unverified`),
    chalk.red(`${num(stats.scrub.invalid)} invalid`),
  ]
  console.log(`  ${num(inputCount)} contacts ${chalk.dim('\u2192')} ${parts.join(chalk.dim(', '))}`)

  const actions: string[] = []
  if (stats.scrub.typos > 0) actions.push(`Fixed ${num(stats.scrub.typos)} typos`)
  if (stats.rinse.duplicates > 0) actions.push(`Merged ${num(stats.rinse.duplicates)} dupes`)
  if (stats.soak.enriched > 0) actions.push(`Enriched ${num(stats.soak.enriched)}`)
  if (actions.length > 0) {
    console.log(`  ${chalk.dim(actions.join(' \u00B7 '))}`)
  }
}

function contactReason(record: import('../types.js').SinkRecord): { icon: string; reason: string } {
  const scrub = record.scrub
  if (!scrub) return { icon: TILDE, reason: chalk.dim('no email') }

  const { email } = scrub
  if (!email.valid) {
    const reason = email.reason ?? 'invalid'
    const label =
      reason === 'invalid_format'
        ? 'invalid format'
        : reason === 'no_mx_record'
          ? 'no MX record'
          : reason === 'disposable_domain'
            ? 'disposable'
            : reason === 'smtp_rejected'
              ? 'SMTP rejected'
              : reason
    return { icon: CROSS, reason: chalk.red(label) }
  }

  if (email.roleBased) return { icon: TILDE, reason: chalk.yellow('role-based') }
  if (email.catchAll) return { icon: TILDE, reason: chalk.yellow('catch-all') }
  if (email.disposable) return { icon: CROSS, reason: chalk.red('disposable') }

  if (email.corrected) {
    return { icon: CHECK, reason: chalk.yellow(`typo fixed (${email.original ?? ''})`) }
  }

  if (email.confidence === 'medium') {
    return { icon: TILDE, reason: chalk.dim('unverified') }
  }

  return { icon: CHECK, reason: chalk.dim('ok') }
}

export function contactTable(
  records: import('../types.js').SinkRecord[],
  opts?: { verbose?: boolean; maxRows?: number },
): void {
  const max = opts?.verbose ? Infinity : (opts?.maxRows ?? 15)
  let shown = 0
  let nonDupeTotal = 0
  const dupeLines: string[] = []

  for (const record of records) {
    if (record.rinse?.duplicate) {
      if (opts?.verbose) {
        const mergedWith = record.rinse.mergedWith ?? 'unknown'
        const matchType = record.rinse.matchType ?? 'exact'
        dupeLines.push(
          `    ${chalk.dim('\u21B3')} ${chalk.dim(truncate(record.raw.name || '', 20))} merged (${matchType}) with ${mergedWith}`,
        )
      }
      continue
    }

    nonDupeTotal++
    if (shown < max) {
      const name = truncate(record.raw.name || '(unnamed)', 22).padEnd(22)
      const email = truncate(record.scrub?.email.normalised || record.raw.email || '', 26).padEnd(26)
      const { icon, reason } = contactReason(record)
      console.log(`  ${icon} ${name} ${chalk.dim(email)} ${reason}`)
      shown++
    }
  }

  for (const line of dupeLines) console.log(line)

  const remaining = nonDupeTotal - shown
  if (remaining > 0) {
    console.log(chalk.dim(`  ...and ${num(remaining)} more (use --verbose to show all)`))
  }
}

export function soakSkipWarning(): void {
  console.log(`  ${chalk.yellow('\u26A0')} ${chalk.yellow('Soak skipped')} ${chalk.dim('-- ANTHROPIC_API_KEY not set')}`)
  console.log(chalk.dim(`    Add to .env:    ANTHROPIC_API_KEY=sk-ant-...`))
  console.log(chalk.dim(`    Or run with:    --provider openai`))
}

export function nextSteps(
  outPath: string,
  stats: SinkStats,
  phases: string[],
  soakSkipped: boolean,
): void {
  const suggestions: Array<{ cmd: string; desc: string }> = []

  suggestions.push({ cmd: `sink inspect ${outPath}`, desc: 'Check data quality' })

  if (soakSkipped) {
    suggestions.push({ cmd: 'export ANTHROPIC_API_KEY=...', desc: 'Enable AI enrichment' })
  }

  if (stats.scrub.risky > 0 && !phases.includes('soak')) {
    suggestions.push({ cmd: `sink soak ${outPath}`, desc: 'Enrich with AI' })
  }

  if (suggestions.length === 0) return

  console.log(chalk.dim('  Next steps'))
  for (const s of suggestions.slice(0, 3)) {
    console.log(`    ${chalk.cyan(s.cmd.padEnd(42))} ${chalk.dim(s.desc)}`)
  }
}

/**
 * Spinner that sits inside the rail.
 * Call .succeed(text) to replace with a diamond checkpoint.
 */
export function createRailSpinner(text: string) {
  const spinner = ora({
    text,
    prefixText: ' ',
    spinner: 'dots',
  })
  return {
    start() {
      spinner.start()
      return this
    },
    succeed(msg: string) {
      spinner.stop()
      stepComplete(msg)
    },
    stop() {
      spinner.stop()
    },
  }
}
