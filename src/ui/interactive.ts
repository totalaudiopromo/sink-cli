/**
 * Interactive mode -- Mole-inspired CLI menu.
 * Launches when user runs bare `sink` with no args.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';

const LOGO_LINES = [
  '     ___ (_)__  / /__',
  "    (_-</ / _ \\/  '_/",
  '   /___/_/_//_/_/\\_\\',
];

function getLogo(): string {
  return [
    '',
    chalk.cyan(LOGO_LINES[0]),
    `${chalk.cyan(LOGO_LINES[1])}   ${chalk.dim('github.com/totalaudiopromo/sink-cli')}`,
    `${chalk.cyan(LOGO_LINES[2])}   ${chalk.dim('Data hygiene for music PR.')}`,
    '',
  ].join('\n');
}

const VERSION = '0.1.0';

export async function runInteractive(): Promise<{
  command: string;
  file?: string;
  options?: Record<string, unknown>;
}> {
  console.log(getLogo());

  const command = await p.select({
    message: chalk.bold('What would you like to do?'),
    options: [
      { value: 'wash',    label: `${chalk.bold('Wash')}       ${chalk.dim('Full pipeline (scrub > rinse > soak)')}` },
      { value: 'scrub',   label: `${chalk.bold('Scrub')}      ${chalk.dim('Clean & validate emails')}` },
      { value: 'rinse',   label: `${chalk.bold('Rinse')}      ${chalk.dim('De-duplicate contacts')}` },
      { value: 'soak',    label: `${chalk.bold('Soak')}       ${chalk.dim('Enrich with AI')}` },
      { value: 'drain',   label: `${chalk.bold('Drain')}      ${chalk.dim('Export / convert formats')}` },
      { value: 'inspect', label: `${chalk.bold('Inspect')}    ${chalk.dim('Data quality score')}` },
      { value: 'spot',    label: `${chalk.bold('Spot')}       ${chalk.dim('Check a single email')}` },
    ],
  });

  if (p.isCancel(command)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  // Spot check doesn't need a file -- prompt for email instead
  if (command === 'spot') {
    const email = await p.text({
      message: 'Email address to check:',
      placeholder: 'sarah@bbc.co.uk',
    });
    if (p.isCancel(email)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    return { command: 'spot', options: { email } };
  }

  // File picker
  const { readdirSync } = await import('node:fs');
  let csvFiles: string[] = [];
  try {
    csvFiles = readdirSync('.').filter(f => f.endsWith('.csv')).sort();
  } catch {
    // No CSV files found, fall through to manual entry
  }

  let filePath: string;
  if (csvFiles.length > 0) {
    const options = csvFiles.map(f => ({ value: f, label: f }));
    options.push({ value: '__custom__', label: chalk.dim('Enter path manually...') });

    const selected = await p.select({
      message: 'Which CSV file?',
      options,
    });
    if (p.isCancel(selected)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    if (selected === '__custom__') {
      const custom = await p.text({
        message: 'Path to CSV file:',
        placeholder: './contacts.csv',
      });
      if (p.isCancel(custom)) {
        p.cancel('Cancelled.');
        process.exit(0);
      }
      filePath = custom;
    } else {
      filePath = selected;
    }
  } else {
    const custom = await p.text({
      message: 'Path to CSV file:',
      placeholder: './contacts.csv',
    });
    if (p.isCancel(custom)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    filePath = custom;
  }

  // Options for the selected command
  const opts: Record<string, unknown> = {};

  if (command === 'wash' || command === 'scrub') {
    const selected = await p.multiselect({
      message: 'Options',
      options: [
        { value: 'smtp', label: 'SMTP verification', hint: 'slower but more accurate' },
        { value: 'verbose', label: 'Verbose output' },
      ],
      required: false,
    });
    if (!p.isCancel(selected)) {
      opts.smtp = (selected as string[]).includes('smtp');
      opts.verbose = (selected as string[]).includes('verbose');
    }
  }

  if (command === 'wash' || command === 'soak') {
    const provider = await p.select({
      message: 'AI enrichment provider',
      options: [
        { value: 'anthropic', label: 'Anthropic (Claude Haiku)', hint: 'recommended' },
        { value: 'openai', label: 'OpenAI (GPT-4o-mini)' },
        { value: 'skip', label: 'Skip enrichment' },
      ],
    });
    if (!p.isCancel(provider)) {
      opts.provider = provider === 'skip' ? undefined : provider;
    }
  }

  console.log('');
  console.log(chalk.dim(`  v${VERSION}  |  Enter  |  Ctrl+C Quit`));
  console.log('');

  return { command: command as string, file: filePath, options: opts };
}
