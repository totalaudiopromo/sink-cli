#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { program } from 'commander';
import chalk from 'chalk';
import { nanoid } from 'nanoid';
import { loadConfig } from './config.js';
import { runPipeline } from './pipeline.js';
import { generateCSV } from './output/csv.js';
import { generateJSON, generateJSONL } from './output/json.js';
import type { SinkRecord, SinkConfig, Phase, SinkStats } from './types.js';

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(filePath: string): string {
  try {
    return readFileSync(resolve(filePath), 'utf-8');
  } catch {
    console.error(chalk.red(`  Error: cannot read file: ${filePath}`));
    process.exit(1);
  }
}

function deriveOutputPath(
  inputPath: string,
  suffix: string,
  format: string
): string {
  const ext = format === 'csv' ? '.csv' : format === 'jsonl' ? '.jsonl' : '.json';
  const base = basename(inputPath, extname(inputPath));
  const dir = inputPath.includes('/')
    ? inputPath.replace(/\/[^/]+$/, '')
    : '.';
  return `${dir}/${base}${suffix}${ext}`;
}

async function parseInputFile(filePath: string): Promise<SinkRecord[]> {
  const { parseCSV } = await import('./phases/scrub/parse.js');
  const text = readFile(filePath);
  const { contacts, errors } = parseCSV(text);

  if (errors.length > 0 && contacts.length === 0) {
    console.error(chalk.red('  Parse error: ' + errors[0]));
    process.exit(1);
  }

  return contacts.map((raw) => ({
    id: nanoid(),
    raw,
    phases: [] as Phase[],
    timestamp: new Date().toISOString(),
  }));
}

function writeOutput(
  records: SinkRecord[],
  outputPath: string,
  format: string
): void {
  let content: string;
  switch (format) {
    case 'json':
      content = generateJSON(records);
      break;
    case 'jsonl':
      content = generateJSONL(records);
      break;
    default:
      content = generateCSV(records);
  }
  writeFileSync(resolve(outputPath), content, 'utf-8');
}

function printStats(stats: SinkStats): void {
  const { intro, blank, validationRow, divider, summary, outro } = await_format();
  // Inline summary for non-TUI output
  const parts = [
    chalk.green(`${stats.scrub.valid} valid`),
    chalk.red(`${stats.scrub.invalid} invalid`),
    chalk.yellow(`${stats.scrub.risky} risky`),
  ];
  console.log(`  ${parts.join(chalk.dim('  ·  '))}`);

  const secondary = [
    `${stats.scrub.typos} typos fixed`,
    `${stats.scrub.domains} domains`,
    `${stats.rinse.duplicates} duplicates`,
    `${stats.soak.enriched} enriched`,
  ];
  console.log(`  ${chalk.dim(secondary.join('  ·  '))}`);
}

// Lazy format import
let _format: typeof import('./ui/format.js') | null = null;
function await_format() {
  // We'll use inline formatting since format.ts may not exist yet
  return {
    intro: (v: string) => {
      console.log(`${chalk.cyan('╭')}  ${chalk.bold(`sink v${v}`)}`);
      console.log(chalk.cyan('│'));
    },
    step: (msg: string) => console.log(`${chalk.cyan('│')}  ${msg}`),
    stepComplete: (msg: string) => console.log(`${chalk.cyan('◇')}  ${msg}`),
    blank: () => console.log(chalk.cyan('│')),
    divider: () => console.log(`${chalk.cyan('├')}${'─'.repeat(44)}`),
    outro: (ms: number) => {
      const secs = (ms / 1000).toFixed(1);
      console.log(`${chalk.cyan('╰')}  ${chalk.dim(`Done in ${secs}s`)}`);
    },
    validationRow: (
      status: 'ok' | 'fail' | 'warn',
      label: string,
      count: number,
      unit: string
    ) => {
      const icon =
        status === 'ok'
          ? chalk.green('✓')
          : status === 'fail'
            ? chalk.red('✗')
            : chalk.yellow('~');
      const countStr = count.toLocaleString('en-GB').padStart(6);
      console.log(
        `${chalk.cyan('│')}  ${icon} ${label.padEnd(18)}${chalk.dim(countStr)} ${chalk.dim(unit)}`
      );
    },
    outputPath: (path: string) =>
      console.log(`${chalk.cyan('│')}  ${chalk.dim('→')} ${chalk.cyan(path)}`),
    summary: printStats,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function runPhases(
  filePath: string,
  phases: Phase[],
  opts: {
    output?: string;
    format?: string;
    config?: string;
    dryRun?: boolean;
    verbose?: boolean;
    json?: boolean;
    noColour?: boolean;
    smtp?: boolean;
    provider?: string;
  }
): Promise<void> {
  const startTime = Date.now();
  const fmt = await_format();

  const config = await loadConfig({
    configPath: opts.config,
    overrides: {
      scrub: { smtp: opts.smtp },
      soak: opts.provider
        ? { provider: opts.provider }
        : undefined,
      output: {
        format: (opts.format as SinkConfig['output']['format']) ?? 'csv',
        locale: 'en-GB',
      },
    } as Partial<SinkConfig>,
  });

  if (opts.noColour) {
    chalk.level = 0;
  }

  if (!opts.json) {
    fmt.intro(VERSION);
    fmt.step(
      `Processing ${chalk.bold(basename(filePath))} through ${phases.join(chalk.dim(' → '))}`
    );
    fmt.blank();
  }

  // Parse
  const records = await parseInputFile(filePath);

  if (!opts.json) {
    fmt.stepComplete(
      `${records.length.toLocaleString('en-GB')} contacts parsed`
    );
    fmt.blank();
  }

  // Run pipeline
  const { records: processed, stats } = await runPipeline(records, {
    phases,
    config,
    onProgress: (phase, progress) => {
      if (!opts.json && opts.verbose) {
        fmt.step(
          chalk.dim(
            `${phase}: ${progress.current}/${progress.total} ${progress.message ?? ''}`
          )
        );
      }
    },
  });

  if (opts.json) {
    console.log(JSON.stringify({ stats, records: processed }, null, 2));
    return;
  }

  // Summary
  fmt.divider();
  fmt.blank();

  const parts = [
    chalk.green(`${stats.scrub.valid} valid`),
    chalk.red(`${stats.scrub.invalid} invalid`),
    chalk.yellow(`${stats.scrub.risky} risky`),
  ];
  fmt.step(parts.join(chalk.dim('  ·  ')));

  const secondary = [
    `${stats.scrub.typos} typos fixed`,
    `${stats.scrub.domains} domains`,
  ];
  if (phases.includes('rinse')) {
    secondary.push(`${stats.rinse.duplicates} duplicates`);
  }
  if (phases.includes('soak')) {
    secondary.push(`${stats.soak.enriched} enriched`);
  }
  fmt.step(chalk.dim(secondary.join('  ·  ')));
  fmt.blank();

  // Output
  const format = opts.format ?? 'csv';
  const outPath =
    opts.output ?? deriveOutputPath(filePath, '-clean', format);

  if (!opts.dryRun) {
    writeOutput(processed, outPath, format);
    fmt.outputPath(outPath);
  } else {
    fmt.step(chalk.dim('Dry run — no files written.'));
  }

  fmt.blank();
  fmt.outro(Date.now() - startTime);
}

async function runVerify(email: string): Promise<void> {
  const fmt = await_format();
  fmt.intro(VERSION);
  fmt.step(`Verifying ${chalk.bold(email)}...`);
  fmt.blank();

  const { validateEmail } = await import('./phases/scrub/validate.js');
  const { MxCache } = await import('./utils/mx-cache.js');
  const result = await validateEmail(email, { smtp: true, mxCache: new MxCache() });

  const validLabel = result.valid ? chalk.green('yes') : chalk.red('no');
  fmt.step(`Valid:       ${validLabel}`);
  fmt.step(`Normalised:  ${result.normalised}`);
  fmt.step(`Confidence:  ${result.confidence}`);

  if (result.reason) fmt.step(`Reason:      ${chalk.dim(result.reason)}`);
  if (result.corrected) {
    fmt.step(
      `Corrected:   ${chalk.yellow(result.original ?? '')} ${chalk.dim('→')} ${chalk.green(result.suggested ?? '')}`
    );
  }
  if (result.roleBased) fmt.step(`Role-based:  ${chalk.yellow('yes')}`);
  if (result.catchAll) fmt.step(`Catch-all:   ${chalk.yellow('yes')}`);
  if (result.disposable) fmt.step(`Disposable:  ${chalk.red('yes')}`);
  if (result.smtpVerified !== undefined) {
    fmt.step(
      `SMTP:        ${result.smtpVerified ? chalk.green('verified') : chalk.red('rejected')}`
    );
  }

  fmt.blank();
  fmt.outro(0);
}

async function runFileStats(filePath: string): Promise<void> {
  const fmt = await_format();
  fmt.intro(VERSION);

  const records = await parseInputFile(filePath);
  fmt.stepComplete(`${records.length.toLocaleString('en-GB')} contacts loaded`);
  fmt.blank();

  const config = await loadConfig();

  const { records: processed, stats } = await runPipeline(records, {
    phases: ['scrub'],
    config,
  });

  const total = stats.scrub.valid + stats.scrub.invalid + stats.scrub.risky;
  const score =
    total > 0
      ? Math.round(
          ((stats.scrub.valid + stats.scrub.risky * 0.5) / total) * 100
        )
      : 0;
  const scoreColour =
    score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

  fmt.step(
    `${records.length.toLocaleString('en-GB')} contacts, ${total.toLocaleString('en-GB')} with email`
  );
  fmt.blank();
  fmt.step(`Quality score: ${scoreColour(score + '%')}`);
  fmt.blank();
  fmt.validationRow('ok', 'Valid', stats.scrub.valid, '');
  fmt.validationRow(
    stats.scrub.risky > 0 ? 'warn' : 'ok',
    'Risky',
    stats.scrub.risky,
    '(role/catch-all)'
  );
  fmt.validationRow(
    stats.scrub.invalid > 0 ? 'fail' : 'ok',
    'Invalid',
    stats.scrub.invalid,
    ''
  );
  fmt.validationRow('warn', 'Typos', stats.scrub.typos, 'detected');
  fmt.validationRow('ok', 'Domains', stats.scrub.domains, 'unique');
  fmt.blank();
  fmt.outro(0);
}

async function runTui(
  filePath: string,
  opts: { smtp?: boolean; provider?: string; config?: string }
): Promise<void> {
  const config = await loadConfig({ configPath: opts.config });
  if (opts.smtp) config.scrub.smtp = true;
  if (opts.provider) config.soak.provider = opts.provider;

  const { render } = await import('ink');
  const { App } = await import('./ui/tui/app.js');
  const React = await import('react');
  render(
    React.createElement(App, {
      filePath: resolve(filePath),
      config,
    })
  );
}

async function runDrain(
  filePath: string,
  opts: { output?: string; format?: string }
): Promise<void> {
  const fmt = await_format();
  const { drain } = await import('./output/drain.js');

  const format = opts.format ?? 'csv';
  const outPath =
    opts.output ??
    deriveOutputPath(filePath, '-converted', format);

  const result = drain(filePath, outPath, format as 'csv' | 'json' | 'jsonl');

  fmt.intro(VERSION);
  fmt.stepComplete(
    `Converted ${result.records} records to ${result.format}`
  );
  fmt.outputPath(outPath);
  fmt.blank();
  fmt.outro(0);
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

program
  .name('sink')
  .version(VERSION)
  .description(
    'Data hygiene for music PR.\nScrub. Rinse. Soak. Clean contact lists.'
  );

// Global options
const globalOpts = (cmd: typeof program) =>
  cmd
    .option('-o, --output <path>', 'output file path')
    .option('--format <format>', 'output format (csv|json|jsonl)', 'csv')
    .option('--config <path>', 'config file path')
    .option('--dry-run', 'preview without writing files')
    .option('--verbose', 'detailed output')
    .option('--json', 'JSON stdout (for piping)')
    .option('--no-colour', 'disable colours')
    .option('--smtp', 'enable SMTP verification')
    .option('--provider <name>', 'soak enrichment provider (anthropic|openai)');

// wash — full pipeline
globalOpts(
  program
    .command('wash <file>')
    .description('Full pipeline: scrub → rinse → soak')
).action((file: string, opts: Record<string, unknown>) => {
  runPhases(file, ['scrub', 'rinse', 'soak'], opts as Parameters<typeof runPhases>[2]);
});

// scrub — phase 1 only
globalOpts(
  program.command('scrub <file>').description('Clean & validate emails')
).action((file: string, opts: Record<string, unknown>) => {
  runPhases(file, ['scrub'], opts as Parameters<typeof runPhases>[2]);
});

// rinse — phase 2 only
globalOpts(
  program.command('rinse <file>').description('De-duplicate contacts')
).action((file: string, opts: Record<string, unknown>) => {
  runPhases(file, ['scrub', 'rinse'], opts as Parameters<typeof runPhases>[2]);
});

// soak — phase 3 only
globalOpts(
  program.command('soak <file>').description('Enrich contacts with AI')
).action((file: string, opts: Record<string, unknown>) => {
  runPhases(file, ['scrub', 'soak'], opts as Parameters<typeof runPhases>[2]);
});

// drain — format converter
program
  .command('drain <file>')
  .description('Export / convert between formats')
  .option('-o, --output <path>', 'output file path')
  .option('--format <format>', 'target format (csv|json|jsonl)', 'csv')
  .action(runDrain);

// verify — single email check
program
  .command('verify <email>')
  .description('Verify a single email address (with SMTP check)')
  .action(runVerify);

// stats — data quality score
program
  .command('stats <file>')
  .description('Show data quality score without cleaning')
  .action(runFileStats);

// tui — full dashboard
program
  .command('tui <file>')
  .description('Launch the full TUI dashboard')
  .option('--smtp', 'enable SMTP verification')
  .option('--provider <name>', 'enrichment provider')
  .option('--config <path>', 'config file path')
  .action(runTui);

// Default action (no subcommand) — interactive menu
program.action(async () => {
  try {
    const { runInteractive } = await import('./ui/interactive.js');
    const result = await runInteractive();

    if (result.file) {
      const phases: Phase[] = [];
      switch (result.command) {
        case 'wash':
          phases.push('scrub', 'rinse', 'soak');
          break;
        case 'scrub':
          phases.push('scrub');
          break;
        case 'rinse':
          phases.push('scrub', 'rinse');
          break;
        case 'soak':
          phases.push('scrub', 'soak');
          break;
        case 'drain':
          await runDrain(result.file, {
            format: (result.options?.format as string) ?? 'csv',
          });
          return;
        case 'stats':
          await runFileStats(result.file);
          return;
      }

      if (phases.length > 0) {
        await runPhases(result.file, phases, {
          smtp: result.options?.smtp as boolean,
          provider: result.options?.provider as string,
        });
      }
    }
  } catch {
    // Interactive mode not available, show help
    program.help();
  }
});

program.parse();
