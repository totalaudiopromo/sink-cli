#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, basename, extname } from 'node:path'
import { program } from 'commander'
import chalk from 'chalk'
import { nanoid } from 'nanoid'
import { loadConfig } from './config.js'
import { runPipeline } from './pipeline.js'
import { generateCSV } from './output/csv.js'
import { generateJSON, generateJSONL } from './output/json.js'
import {
  intro,
  step,
  stepComplete,
  blank,
  validationRow,
  divider,
  summary,
  outputPath as showOutputPath,
  outro,
  LOGO_LINES,
} from './ui/format.js'
import type { SinkRecord, SinkConfig, Phase } from './types.js'

// Load .env if present (works on Node 20+, no dependencies)
try {
  const envContents = readFileSync(resolve('.env'), 'utf-8')
  for (const line of envContents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  /* .env file not found, using process.env */
}

const VERSION = '0.1.0'

// Exit codes
const EXIT = {
  FILE_ERROR: 1,
  PARSE_ERROR: 2,
  CONFIG_ERROR: 3,
  PIPELINE_ERROR: 4,
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip surrounding quotes and trailing whitespace (handles Finder drag-and-drop paths) */
function cleanPath(filePath: string): string {
  return filePath.trim().replace(/^["']|["']$/g, '')
}

function readFile(filePath: string): string {
  try {
    return readFileSync(resolve(filePath), 'utf-8')
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      console.error(chalk.red(`\n  File not found: ${filePath}`))
      console.error(chalk.dim('  Check the path and try again.\n'))
    } else if (code === 'EISDIR') {
      console.error(chalk.red(`\n  That's a directory, not a file: ${filePath}`))
      console.error(chalk.dim('  Pass a CSV file path instead.\n'))
    } else {
      console.error(chalk.red(`\n  Cannot read file: ${filePath}`))
    }
    process.exit(EXIT.FILE_ERROR)
  }
}

function deriveOutputPath(inputPath: string, suffix: string, format: string): string {
  const ext = format === 'csv' ? '.csv' : format === 'jsonl' ? '.jsonl' : '.json'
  const base = basename(inputPath, extname(inputPath))
  const dir = inputPath.includes('/') ? inputPath.replace(/\/[^/]+$/, '') : '.'
  return `${dir}/${base}${suffix}${ext}`
}

async function parseInputFile(filePath: string): Promise<SinkRecord[]> {
  const { parseCSV } = await import('./phases/scrub/parse.js')
  const text = readFile(filePath)
  const { contacts, errors } = parseCSV(text)

  if (errors.length > 0 && contacts.length === 0) {
    console.error(chalk.red('  Parse error: ' + errors[0]))
    process.exit(EXIT.PARSE_ERROR)
  }

  // Show non-fatal warnings
  for (const err of errors) {
    console.warn(chalk.yellow(`  ${err}`))
  }

  return contacts.map((raw) => ({
    id: nanoid(),
    raw,
    phases: [] as Phase[],
    timestamp: new Date().toISOString(),
  }))
}

function writeOutput(records: SinkRecord[], outPath: string, format: string): void {
  let content: string
  switch (format) {
    case 'json':
      content = generateJSON(records)
      break
    case 'jsonl':
      content = generateJSONL(records)
      break
    default:
      content = generateCSV(records)
  }
  writeFileSync(resolve(outPath), content, 'utf-8')
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function runPhases(
  rawPath: string,
  phases: Phase[],
  opts: {
    output?: string
    format?: string
    config?: string
    dryRun?: boolean
    verbose?: boolean
    quiet?: boolean
    json?: boolean
    noColour?: boolean
    smtp?: boolean
    provider?: string
  },
): Promise<void> {
  const filePath = cleanPath(rawPath)
  const startTime = Date.now()

  if (opts.noColour) chalk.level = 0

  const config = await loadConfig({
    configPath: opts.config,
    overrides: {
      scrub: { smtp: opts.smtp },
      soak: opts.provider ? { provider: opts.provider } : undefined,
      output: {
        format: (opts.format as SinkConfig['output']['format']) ?? 'csv',
        locale: 'en-GB',
      },
    } as Partial<SinkConfig>,
  })

  const silent = opts.json || opts.quiet

  if (!silent) {
    intro(VERSION)
    step(`Processing ${chalk.bold(basename(filePath))} through ${phases.join(chalk.dim(' → '))}`)
    blank()
  }

  const records = await parseInputFile(filePath)

  if (!silent) {
    stepComplete(`${records.length.toLocaleString('en-GB')} contacts parsed`)
    blank()
  }

  const { records: processed, stats } = await runPipeline(records, {
    phases,
    config,
    onProgress: (phase, progress) => {
      if (!silent && opts.verbose) {
        step(chalk.dim(`${phase}: ${progress.current}/${progress.total} ${progress.message ?? ''}`))
      }
    },
  })

  if (opts.json) {
    console.log(JSON.stringify({ stats, records: processed }, null, 2))
    return
  }

  if (!silent) {
    divider()
    blank()
    summary(stats)
    blank()
  }

  const format = opts.format ?? 'csv'
  const outPath = opts.output ?? deriveOutputPath(filePath, '-clean', format)

  if (!opts.dryRun) {
    writeOutput(processed, outPath, format)
    if (!silent) showOutputPath(outPath)
  } else if (!silent) {
    step(chalk.dim('Dry run — no files written.'))
  }

  if (!silent) {
    blank()
    outro(Date.now() - startTime)
  }
}

async function runSpot(email: string): Promise<void> {
  intro(VERSION)
  step(`Checking ${chalk.bold(email)}...`)
  blank()

  const { validateEmail } = await import('./phases/scrub/validate.js')
  const { MxCache } = await import('./utils/mx-cache.js')
  const result = await validateEmail(email, { smtp: true, mxCache: new MxCache() })

  step(`Valid:       ${result.valid ? chalk.green('yes') : chalk.red('no')}`)
  step(`Normalised:  ${result.normalised}`)
  step(`Confidence:  ${result.confidence}`)
  if (result.reason) step(`Reason:      ${chalk.dim(result.reason)}`)
  if (result.corrected) {
    step(
      `Corrected:   ${chalk.yellow(result.original ?? '')} ${chalk.dim('→')} ${chalk.green(result.suggested ?? '')}`,
    )
  }
  if (result.roleBased) step(`Role-based:  ${chalk.yellow('yes')}`)
  if (result.catchAll) step(`Catch-all:   ${chalk.yellow('yes')}`)
  if (result.disposable) step(`Disposable:  ${chalk.red('yes')}`)
  if (result.smtpVerified !== undefined) {
    step(`SMTP:        ${result.smtpVerified ? chalk.green('verified') : chalk.red('rejected')}`)
  }

  blank()
  outro(0)
}

async function runInspect(rawPath: string): Promise<void> {
  const filePath = cleanPath(rawPath)
  intro(VERSION)

  const records = await parseInputFile(filePath)
  stepComplete(`${records.length.toLocaleString('en-GB')} contacts loaded`)
  blank()

  const config = await loadConfig()
  const { stats } = await runPipeline(records, { phases: ['scrub'], config })

  const total = stats.scrub.valid + stats.scrub.invalid + stats.scrub.risky
  const score =
    total > 0 ? Math.round(((stats.scrub.valid + stats.scrub.risky * 0.5) / total) * 100) : 0
  const scoreColour = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red

  step(
    `${records.length.toLocaleString('en-GB')} contacts, ${total.toLocaleString('en-GB')} with email`,
  )
  blank()
  step(`Quality score: ${scoreColour(score + '%')}`)
  blank()
  validationRow('ok', 'Valid', stats.scrub.valid, '')
  validationRow(
    stats.scrub.risky > 0 ? 'warn' : 'ok',
    'Risky',
    stats.scrub.risky,
    '(role/catch-all)',
  )
  validationRow(stats.scrub.invalid > 0 ? 'fail' : 'ok', 'Invalid', stats.scrub.invalid, '')
  validationRow('warn', 'Typos', stats.scrub.typos, 'detected')
  validationRow('ok', 'Domains', stats.scrub.domains, 'unique')
  blank()
  outro(0)
}

async function runTui(
  rawPath: string,
  opts: { smtp?: boolean; provider?: string; config?: string },
): Promise<void> {
  const filePath = cleanPath(rawPath)
  const config = await loadConfig({ configPath: opts.config })
  if (opts.smtp) config.scrub.smtp = true
  if (opts.provider) config.soak.provider = opts.provider

  const { render } = await import('ink')
  const { App } = await import('./ui/tui/app.js')
  const React = await import('react')
  render(React.createElement(App, { filePath: resolve(filePath), config }))
}

async function runDrain(
  rawPath: string,
  opts: { output?: string; format?: string },
): Promise<void> {
  const filePath = cleanPath(rawPath)
  const { drain } = await import('./output/drain.js')
  const format = opts.format ?? 'csv'
  const outPath = opts.output ?? deriveOutputPath(filePath, '-converted', format)
  const result = drain(filePath, outPath, format as 'csv' | 'json' | 'jsonl')

  intro(VERSION)
  stepComplete(`Converted ${result.records} records to ${result.format}`)
  showOutputPath(outPath)
  blank()
  outro(0)
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

program
  .name('sink')
  .version(VERSION, '-v, --version')
  .configureOutput({
    writeOut: (str) => {
      if (str.trim() === VERSION) {
        console.log('')
        console.log(chalk.cyan(LOGO_LINES[0]))
        console.log(`${chalk.cyan(LOGO_LINES[1])}   ${chalk.dim(`v${VERSION}`)}`)
        console.log(chalk.cyan(LOGO_LINES[2]))
        console.log('')
      } else {
        process.stdout.write(str)
      }
    },
  })
  .description('Data hygiene for music PR.\nScrub. Rinse. Soak. Clean contact lists.')
  .addHelpText(
    'after',
    `
Examples:
  ${chalk.dim('$')} sink scrub contacts.csv              Validate emails
  ${chalk.dim('$')} sink scrub contacts.csv --smtp        Validate with SMTP check
  ${chalk.dim('$')} sink wash contacts.csv --dry-run      Full pipeline, preview only
  ${chalk.dim('$')} sink spot sarah@bbc.co.uk             Check a single email
  ${chalk.dim('$')} sink inspect contacts.csv             Data quality score
`,
  )

const globalOpts = (cmd: typeof program) =>
  cmd
    .option('-o, --output <path>', 'output file path')
    .option('--format <format>', 'output format (csv|json|jsonl)', 'csv')
    .option('--config <path>', 'config file path')
    .option('--dry-run', 'preview without writing files')
    .option('--verbose', 'detailed output')
    .option('-q, --quiet', 'suppress all output except errors')
    .option('--json', 'JSON stdout (for piping)')
    .option('--no-colour', 'disable colours')
    .option('--smtp', 'enable SMTP verification')
    .option('--provider <name>', 'soak enrichment provider (anthropic|openai)')

globalOpts(program.command('wash <file>').description('Full pipeline: scrub, rinse, soak')).action(
  (file: string, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub', 'rinse', 'soak'], opts as Parameters<typeof runPhases>[2])
  },
)

globalOpts(program.command('scrub <file>').description('Clean & validate emails')).action(
  (file: string, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub'], opts as Parameters<typeof runPhases>[2])
  },
)

globalOpts(program.command('rinse <file>').description('De-duplicate contacts')).action(
  (file: string, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub', 'rinse'], opts as Parameters<typeof runPhases>[2])
  },
)

globalOpts(program.command('soak <file>').description('Enrich contacts with AI')).action(
  (file: string, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub', 'soak'], opts as Parameters<typeof runPhases>[2])
  },
)

program
  .command('drain <file>')
  .description('Export / convert between formats')
  .option('-o, --output <path>', 'output file path')
  .option('--format <format>', 'target format (csv|json|jsonl)', 'csv')
  .action(runDrain)

program
  .command('spot <email>')
  .description('Spot-check a single email address (with SMTP check)')
  .action(runSpot)

program
  .command('inspect <file>')
  .description('Inspect data quality score without cleaning')
  .action(runInspect)

program
  .command('tui <file>')
  .description('Launch the full TUI dashboard')
  .option('--smtp', 'enable SMTP verification')
  .option('--provider <name>', 'enrichment provider')
  .option('--config <path>', 'config file path')
  .action(runTui)

program.action(async () => {
  try {
    const { runInteractive } = await import('./ui/interactive.js')
    const result = await runInteractive()

    if (result.command === 'spot') {
      await runSpot(result.options?.email as string)
      return
    }

    if (result.file) {
      const phases: Phase[] = []
      switch (result.command) {
        case 'wash':
          phases.push('scrub', 'rinse', 'soak')
          break
        case 'scrub':
          phases.push('scrub')
          break
        case 'rinse':
          phases.push('scrub', 'rinse')
          break
        case 'soak':
          phases.push('scrub', 'soak')
          break
        case 'drain':
          await runDrain(result.file, { format: (result.options?.format as string) ?? 'csv' })
          return
        case 'inspect':
          await runInspect(result.file)
          return
      }

      if (phases.length > 0) {
        await runPhases(result.file, phases, {
          smtp: result.options?.smtp as boolean,
          provider: result.options?.provider as string,
        })
      }
    }
  } catch {
    program.help()
  }
})

program.parseAsync().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error(chalk.red(`\n  ${err.message}\n`))
  } else {
    console.error(chalk.red('\n  An unexpected error occurred.\n'))
  }
  process.exit(EXIT.PIPELINE_ERROR)
})
