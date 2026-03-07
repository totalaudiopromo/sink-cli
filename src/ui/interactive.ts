/**
 * Interactive mode using @clack/prompts.
 * Mole-style guided flow when user runs bare `sink` with no args.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';

export async function runInteractive(): Promise<{
  command: string;
  file?: string;
  options?: Record<string, unknown>;
}> {
  // Box-drawn header
  console.log('');
  console.log(chalk.cyan('  \u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E'));
  console.log(chalk.cyan('  \u2502') + '                                     ' + chalk.cyan('\u2502'));
  console.log(chalk.cyan('  \u2502') + chalk.bold('   sink') + chalk.dim('  data hygiene for music PR') + '   ' + chalk.cyan('\u2502'));
  console.log(chalk.cyan('  \u2502') + '                                     ' + chalk.cyan('\u2502'));
  console.log(chalk.cyan('  \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F'));
  console.log('');

  const command = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'wash', label: 'Wash', hint: 'Full pipeline (scrub \u2192 rinse \u2192 soak)' },
      { value: 'scrub', label: 'Scrub', hint: 'Clean & validate emails' },
      { value: 'rinse', label: 'Rinse', hint: 'De-duplicate contacts' },
      { value: 'soak', label: 'Soak', hint: 'Enrich with AI' },
      { value: 'drain', label: 'Drain', hint: 'Export / convert formats' },
      { value: 'stats', label: 'Stats', hint: 'Data quality score' },
      { value: 'about', label: 'About', hint: 'Version & credits' },
    ],
  });

  if (p.isCancel(command)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }

  if (command === 'about') {
    p.note(
      'sink-cli v0.1.0\nMIT License\nhttps://github.com/totalaudiopromo/sink-cli',
      'About',
    );
    process.exit(0);
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
    options.push({ value: '__custom__', label: 'Enter path manually...' });

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

  return { command: command as string, file: filePath, options: opts };
}
