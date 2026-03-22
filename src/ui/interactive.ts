/**
 * Interactive mode -- Mole-inspired CLI menu.
 * Launches when user runs bare `sink` with no args.
 */

import * as p from '@clack/prompts'
import chalk from 'chalk'
import { LOGO_LINES } from './format.js'

function getLogo(): string {
  return [
    '',
    chalk.cyan(LOGO_LINES[0]),
    `${chalk.cyan(LOGO_LINES[1])}   ${chalk.dim('github.com/totalaudiopromo/sink-cli')}`,
    `${chalk.cyan(LOGO_LINES[2])}   ${chalk.dim('Data hygiene for music PR.')}`,
    '',
  ].join('\n')
}

export async function runInteractive(): Promise<{
  command: string
  file?: string
  text?: string
  options?: Record<string, unknown>
}> {
  console.log(getLogo())

  const command = await p.select({
    message: chalk.bold('What would you like to do?'),
    options: [
      {
        value: 'wash',
        label: `${chalk.bold('Wash')}       ${chalk.dim('Full pipeline (scrub > rinse > soak)')}`,
      },
      {
        value: 'scrub',
        label: `${chalk.bold('Scrub')}      ${chalk.dim('Clean & validate emails')}`,
      },
      {
        value: 'rinse',
        label: `${chalk.bold('Rinse')}      ${chalk.dim('De-duplicate contacts')}`,
      },
      { value: 'soak', label: `${chalk.bold('Soak')}       ${chalk.dim('Enrich with AI')}` },
      {
        value: 'drain',
        label: `${chalk.bold('Drain')}      ${chalk.dim('Export / convert formats')}`,
      },
      { value: 'inspect', label: `${chalk.bold('Inspect')}    ${chalk.dim('Data quality score')}` },
      { value: 'spot', label: `${chalk.bold('Spot')}       ${chalk.dim('Check a single email')}` },
    ],
  })

  if (p.isCancel(command)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  // Spot check doesn't need a file -- prompt for email instead
  if (command === 'spot') {
    const email = await p.text({
      message: 'Email address to check:',
      placeholder: 'sarah@bbc.co.uk',
    })
    if (p.isCancel(email)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    return { command: 'spot', options: { email } }
  }

  // File / input picker -- scan up to 2 levels deep
  const { readdirSync, statSync } = await import('node:fs')
  const { join, relative } = await import('node:path')

  function findCsvFiles(
    dir: string,
    maxDepth = 2,
    currentDepth = 0,
  ): Array<{ path: string; size: number }> {
    const results: Array<{ path: string; size: number }> = []
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isFile() && entry.name.endsWith('.csv')) {
          const stat = statSync(fullPath)
          results.push({ path: relative('.', fullPath), size: stat.size })
        } else if (
          entry.isDirectory() &&
          currentDepth < maxDepth &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist'
        ) {
          results.push(...findCsvFiles(fullPath, maxDepth, currentDepth + 1))
        }
      }
    } catch {
      /* permission denied etc */
    }
    return results
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const csvFiles = findCsvFiles('.')

  let filePath: string | undefined
  let pastedText: string | undefined
  let useDemo = false

  const inputOptions: { value: string; label: string }[] = []

  // Demo option always available
  inputOptions.push({
    value: '__demo__',
    label: `${chalk.green('\u25B6')} ${chalk.bold('Use demo data')}  ${chalk.dim('(built-in sample -- great for trying it out)')}`,
  })

  // CSV files found in CWD (2 levels deep)
  for (const f of csvFiles) {
    inputOptions.push({
      value: f.path,
      label: `${f.path}  ${chalk.dim(formatSize(f.size))}`,
    })
  }

  // Paste, URL & manual entry
  inputOptions.push({
    value: '__paste__',
    label: `${chalk.yellow('\u270E')} ${chalk.bold('Paste CSV data')}  ${chalk.dim('(paste rows directly)')}`,
  })
  inputOptions.push({ value: '__url__', label: chalk.dim('Paste a URL (Google Sheets, Dropbox, etc.)') })
  inputOptions.push({
    value: '__custom__',
    label: chalk.dim('Enter path manually...'),
  })

  const selected = await p.select({
    message: 'Where is your data?',
    options: inputOptions,
  })
  if (p.isCancel(selected)) {
    p.cancel('Cancelled.')
    process.exit(0)
  }

  if (selected === '__demo__') {
    useDemo = true
  } else if (selected === '__paste__') {
    const pasted = await p.text({
      message: 'Paste your CSV data (header row + data rows):',
      placeholder: 'name,email,outlet,role\nSarah Jones,sarah@bbc.co.uk,BBC Radio 1,Producer',
      validate: (value) => {
        if (!value?.trim()) return 'Please paste some CSV data.'
        if (!value.includes(',') && !value.includes('\t')) {
          return 'That doesn\'t look like CSV. Include commas between fields.'
        }
      },
    })
    if (p.isCancel(pasted)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    pastedText = pasted
  } else if (selected === '__url__') {
    const url = await p.text({
      message: 'URL to CSV:',
      placeholder: 'https://docs.google.com/spreadsheets/d/.../edit',
      validate: (value = '') => {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'Must be an HTTP or HTTPS URL'
        }
      },
    })
    if (p.isCancel(url)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    filePath = url
  } else if (selected === '__custom__') {
    const custom = await p.text({
      message: 'Path or URL:',
      placeholder: './contacts.csv or https://...',
    })
    if (p.isCancel(custom)) {
      p.cancel('Cancelled.')
      process.exit(0)
    }
    filePath = custom
  } else {
    filePath = selected
  }

  // Options for the selected command
  const opts: Record<string, unknown> = {}
  if (useDemo) opts.demo = true

  if (command === 'wash' || command === 'scrub') {
    const selected = await p.multiselect({
      message: 'Options',
      options: [
        { value: 'smtp', label: 'SMTP verification', hint: 'slower but more accurate' },
        { value: 'verbose', label: 'Verbose output' },
      ],
      required: false,
    })
    if (!p.isCancel(selected)) {
      opts.smtp = (selected as string[]).includes('smtp')
      opts.verbose = (selected as string[]).includes('verbose')
    }
  }

  if (command === 'wash' || command === 'soak') {
    // Check for API keys to guide the user
    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY)
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY)

    const providerOptions: { value: string; label: string; hint?: string }[] = [
      {
        value: 'haiku',
        label: 'Anthropic Haiku',
        hint: `fast & cheap${hasAnthropicKey ? '' : chalk.red(' — ANTHROPIC_API_KEY not set')}`,
      },
      {
        value: 'sonnet',
        label: 'Anthropic Sonnet',
        hint: `balanced${hasAnthropicKey ? '' : chalk.red(' — ANTHROPIC_API_KEY not set')}`,
      },
      {
        value: 'opus',
        label: 'Anthropic Opus',
        hint: `most capable${hasAnthropicKey ? '' : chalk.red(' — ANTHROPIC_API_KEY not set')}`,
      },
      {
        value: 'gpt-4o-mini',
        label: 'OpenAI GPT-4o-mini',
        hint: hasOpenAIKey ? undefined : chalk.red('OPENAI_API_KEY not set'),
      },
      {
        value: 'codex',
        label: 'OpenAI Codex',
        hint: hasOpenAIKey ? undefined : chalk.red('OPENAI_API_KEY not set'),
      },
      { value: 'skip', label: 'Skip enrichment' },
    ]

    const provider = await p.select({
      message: 'AI enrichment provider',
      options: providerOptions,
    })

    if (!p.isCancel(provider)) {
      if (provider === 'skip') {
        opts.provider = undefined
      } else {
        opts.provider = provider

        // If API key is missing, offer to enter it inline
        const needsAnthropic =
          (provider === 'haiku' || provider === 'sonnet' || provider === 'opus') &&
          !hasAnthropicKey
        const needsOpenAI =
          (provider === 'gpt-4o-mini' || provider === 'codex') && !hasOpenAIKey

        if (needsAnthropic || needsOpenAI) {
          const envVar = needsAnthropic ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
          const apiKey = await p.text({
            message: `${envVar} not set. Enter it now (for this session only):`,
            placeholder: 'sk-...',
            validate: (value) => {
              if (!value?.trim()) return `${envVar} is required for ${provider as string}.`
            },
          })
          if (!p.isCancel(apiKey)) {
            process.env[envVar] = apiKey
          } else {
            // Cancelled — skip enrichment
            opts.provider = undefined
          }
        }
      }
    }
  }

  return {
    command: command as string,
    file: filePath,
    text: pastedText,
    options: opts,
  }
}
