#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { program } from 'commander'
import chalk from 'chalk'
import { loadConfig } from './config.js'
import { runPipeline } from './pipeline.js'
import { generateCSV } from './output/csv.js'
import { generateJSON, generateJSONL } from './output/json.js'
import { resolveInput, parseInputText, deriveOutputPath } from './input.js'
import {
  intro,
  step,
  stepComplete,
  blank,
  validationRow,
  divider,
  outputPath as showOutputPath,
  outro,
  qualityScore,
  transformSummary,
  contactTable,
  soakSkipWarning,
  nextSteps,
  LOGO_LINES,
} from './ui/format.js'
import type { SinkRecord, SinkConfig, Phase } from './types.js'

// Load .env if present (works on Node 20+, no dependencies)
try {
  const { readFileSync } = await import('node:fs')
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
// Provider shortcuts — map friendly names to provider + model
// ---------------------------------------------------------------------------

const PROVIDER_SHORTCUTS: Record<string, { provider: string; model: string }> = {
  haiku: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  sonnet: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250514' },
  opus: { provider: 'anthropic', model: 'claude-opus-4-0-20250514' },
  codex: { provider: 'openai', model: 'codex-mini-latest' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
}

function resolveProvider(name?: string): { provider?: string; model?: string } {
  if (!name) return {}
  const shortcut = PROVIDER_SHORTCUTS[name]
  if (shortcut) return shortcut
  // Pass through as-is (e.g. "anthropic", "openai")
  return { provider: name }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  rawPath: string | undefined,
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
    demo?: boolean
    url?: string
    skipIntro?: boolean
  },
): Promise<void> {
  const startTime = Date.now()

  if (opts.noColour) chalk.level = 0

  const { provider: providerName, model: providerModel } = resolveProvider(opts.provider)

  const config = await loadConfig({
    configPath: opts.config,
    overrides: {
      scrub: { smtp: opts.smtp },
      soak: {
        ...(providerName ? { provider: providerName } : undefined),
        ...(providerName && providerModel
          ? { [providerName]: { model: providerModel } }
          : undefined),
      },
      output: {
        format: (opts.format as SinkConfig['output']['format']) ?? 'csv',
        locale: 'en-GB',
      },
    } as Partial<SinkConfig>,
  })

  const silent = opts.json || opts.quiet

  const { text, label } = await resolveInput({
    file: rawPath,
    demo: opts.demo,
    url: opts.url,
  })

  if (!silent) {
    if (!opts.skipIntro) intro(VERSION)
    step(`Processing ${chalk.bold(label)} through ${phases.join(chalk.dim(' → '))}`)
    blank()
  }

  const records = parseInputText(text)

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

  const soakSkipped = phases.includes('soak') && !processed.some((r) => r.phases.includes('soak'))

  if (!silent) {
    divider()
    blank()
    qualityScore(stats)
    blank()
    transformSummary(records.length, stats)
    blank()
    contactTable(processed, { verbose: opts.verbose })
    blank()

    if (soakSkipped) {
      soakSkipWarning()
      blank()
    }
  }

  const format = opts.format ?? 'csv'
  const outPath =
    opts.output ?? deriveOutputPath(label, rawPath, '-clean', format)

  if (!opts.dryRun) {
    writeOutput(processed, outPath, format)
    if (!silent) showOutputPath(outPath)
  } else if (!silent) {
    step(chalk.dim('Dry run -- no files written.'))
  }

  if (!silent) {
    blank()
    nextSteps(outPath, stats, phases, soakSkipped)
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

async function runInspect(
  rawPath: string | undefined,
  opts: { demo?: boolean; url?: string },
): Promise<void> {
  intro(VERSION)

  const { text } = await resolveInput({
    file: rawPath,
    demo: opts.demo,
    url: opts.url,
  })
  const records = parseInputText(text)
  stepComplete(`${records.length.toLocaleString('en-GB')} contacts loaded`)
  blank()

  const config = await loadConfig()
  const { stats } = await runPipeline(records, { phases: ['scrub'], config })

  const total = stats.scrub.valid + stats.scrub.invalid + stats.scrub.risky

  step(
    `${stats.total.toLocaleString('en-GB')} contacts, ${total.toLocaleString('en-GB')} with email`,
  )
  blank()
  qualityScore(stats)
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
  rawPath: string | undefined,
  opts: { smtp?: boolean; provider?: string; config?: string; demo?: boolean; url?: string },
): Promise<void> {
  // TUI currently requires a file path for its React component
  // For demo/url/stdin, write to a temp file
  const { text } = await resolveInput({
    file: rawPath,
    demo: opts.demo,
    url: opts.url,
  })

  const { writeFileSync: writeSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const tmpPath = join(tmpdir(), `sink-tui-${Date.now()}.csv`)
  writeSync(tmpPath, text, 'utf-8')

  const config = await loadConfig({ configPath: opts.config })
  if (opts.smtp) config.scrub.smtp = true

  const { provider: providerName, model: providerModel } = resolveProvider(opts.provider)
  if (providerName) config.soak.provider = providerName
  if (providerName && providerModel) {
    ;(config.soak as Record<string, unknown>)[providerName] = {
      ...((config.soak as Record<string, unknown>)[providerName] as Record<string, unknown> | undefined),
      model: providerModel,
    }
  }

  const { render } = await import('ink')
  const { App } = await import('./ui/tui/app.js')
  const React = await import('react')
  render(React.createElement(App, { filePath: resolve(tmpPath), config }))
}

async function runDrain(
  rawPath: string | undefined,
  opts: { output?: string; format?: string; demo?: boolean; url?: string },
): Promise<void> {
  const { text, label } = await resolveInput({
    file: rawPath,
    demo: opts.demo,
    url: opts.url,
  })

  const records = parseInputText(text)
  const format = opts.format ?? 'csv'
  const outPath =
    opts.output ?? deriveOutputPath(label, rawPath, '-converted', format)

  let content: string
  switch (format) {
    case 'json':
      content = generateJSON(records.map((r) => r))
      break
    case 'jsonl':
      content = generateJSONL(records.map((r) => r))
      break
    default:
      content = generateCSV(records.map((r) => r))
  }
  writeFileSync(resolve(outPath), content, 'utf-8')

  intro(VERSION)
  stepComplete(`Converted ${records.length} records to ${format}`)
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
  ${chalk.dim('$')} sink demo                              Full pipeline on sample data
  ${chalk.dim('$')} sink scrub contacts.csv                Validate emails
  ${chalk.dim('$')} sink scrub --demo                      Validate with built-in sample data
  ${chalk.dim('$')} sink scrub --url https://...           Fetch & validate from URL
  ${chalk.dim('$')} pbpaste | sink scrub -                 Pipe from clipboard
  ${chalk.dim('$')} sink wash contacts.csv --provider sonnet   Enrich with Claude Sonnet
  ${chalk.dim('$')} sink spot sarah@bbc.co.uk              Check a single email
  ${chalk.dim('$')} sink inspect contacts.csv              Data quality score

Providers:
  haiku, sonnet, opus (Anthropic) | gpt-4o-mini, codex (OpenAI)
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
    .option('--provider <name>', 'enrichment provider (haiku|sonnet|opus|codex|gpt-4o-mini)')
    .option('--demo', 'use built-in sample data (no file needed)')
    .option('--url <url>', 'fetch CSV from a URL')

globalOpts(program.command('wash [file]').description('Full pipeline: scrub, rinse, soak')).action(
  (file: string | undefined, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub', 'rinse', 'soak'], opts as Parameters<typeof runPhases>[2])
  },
)

globalOpts(program.command('scrub [file]').description('Clean & validate emails')).action(
  (file: string | undefined, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub'], opts as Parameters<typeof runPhases>[2])
  },
)

globalOpts(program.command('rinse [file]').description('De-duplicate contacts')).action(
  (file: string | undefined, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub', 'rinse'], opts as Parameters<typeof runPhases>[2])
  },
)

globalOpts(program.command('soak [file]').description('Enrich contacts with AI')).action(
  (file: string | undefined, opts: Record<string, unknown>) => {
    runPhases(file, ['scrub', 'soak'], opts as Parameters<typeof runPhases>[2])
  },
)

program
  .command('demo')
  .description('Run the full pipeline on sample data (no file needed)')
  .option('--provider <name>', 'enrichment provider (haiku|sonnet|opus|codex|gpt-4o-mini)')
  .option('--smtp', 'enable SMTP verification')
  .option('--verbose', 'detailed output')
  .option('--no-colour', 'disable colours')
  .action((opts: Record<string, unknown>) => {
    runPhases(undefined, ['scrub', 'rinse', 'soak'], {
      ...opts,
      demo: true,
      verbose: (opts.verbose as boolean) ?? true,
    } as Parameters<typeof runPhases>[2])
  })

program
  .command('drain [file]')
  .description('Export / convert between formats')
  .option('-o, --output <path>', 'output file path')
  .option('--format <format>', 'target format (csv|json|jsonl)', 'csv')
  .option('--demo', 'use built-in sample data')
  .option('--url <url>', 'fetch CSV from a URL')
  .action(runDrain)

program
  .command('spot <email>')
  .description('Spot-check a single email address (with SMTP check)')
  .action(runSpot)

program
  .command('inspect [file]')
  .description('Inspect data quality score without cleaning')
  .option('--demo', 'use built-in sample data')
  .option('--url <url>', 'fetch CSV from a URL')
  .action(runInspect)

program
  .command('tui [file]')
  .description('Launch the full TUI dashboard')
  .option('--smtp', 'enable SMTP verification')
  .option('--provider <name>', 'enrichment provider')
  .option('--config <path>', 'config file path')
  .option('--demo', 'use built-in sample data')
  .option('--url <url>', 'fetch CSV from a URL')
  .action(runTui)

program.action(async () => {
  try {
    const { runInteractive } = await import('./ui/interactive.js')
    const result = await runInteractive()

    if (result.command === 'spot') {
      await runSpot(result.options?.email as string)
      return
    }

    // Build opts from interactive result
    const interactiveOpts = {
      smtp: result.options?.smtp as boolean,
      provider: result.options?.provider as string,
      demo: result.options?.demo as boolean,
      verbose: result.options?.verbose as boolean,
    }

    // Handle raw text input (from paste)
    if (result.text) {
      const records = parseInputText(result.text)
      const config = await loadConfig()

      const { provider: providerName, model: providerModel } = resolveProvider(
        interactiveOpts.provider,
      )
      if (providerName) config.soak.provider = providerName
      if (providerName && providerModel) {
        ;(config.soak as Record<string, unknown>)[providerName] = {
          ...((config.soak as Record<string, unknown>)[providerName] as Record<string, unknown> | undefined),
          model: providerModel,
        }
      }

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
        case 'drain': {
          const { generateCSV: genCSV } = await import('./output/csv.js')
          const content = genCSV(records)
          const outPath = './pasted-converted.csv'
          writeFileSync(resolve(outPath), content, 'utf-8')
          intro(VERSION)
          stepComplete(`Converted ${records.length} records`)
          showOutputPath(outPath)
          blank()
          outro(0)
          return
        }
        case 'inspect': {
          intro(VERSION)
          stepComplete(`${records.length.toLocaleString('en-GB')} contacts loaded`)
          blank()
          const inspectConfig = await loadConfig()
          const { stats } = await runPipeline(records, { phases: ['scrub'], config: inspectConfig })
          qualityScore(stats)
          blank()
          outro(0)
          return
        }
      }

      if (phases.length > 0) {
        intro(VERSION)
        step(`Processing ${chalk.bold('pasted data')} through ${phases.join(chalk.dim(' → '))}`)
        blank()
        stepComplete(`${records.length.toLocaleString('en-GB')} contacts parsed`)
        blank()

        const { records: processed, stats } = await runPipeline(records, { phases, config })
        divider()
        blank()
        qualityScore(stats)
        blank()
        transformSummary(records.length, stats)
        blank()
        contactTable(processed)
        blank()

        const outPath = './pasted-clean.csv'
        const content = generateCSV(processed)
        writeFileSync(resolve(outPath), content, 'utf-8')
        showOutputPath(outPath)
        blank()
        outro(Date.now())
      }
      return
    }

    // Handle demo or file-based input
    if (result.file || interactiveOpts.demo) {
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
          await runDrain(result.file, {
            format: (result.options?.format as string) ?? 'csv',
            demo: interactiveOpts.demo,
          })
          return
        case 'inspect':
          await runInspect(result.file, { demo: interactiveOpts.demo })
          return
      }

      if (phases.length > 0) {
        await runPhases(result.file, phases, { ...interactiveOpts, skipIntro: true })
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
