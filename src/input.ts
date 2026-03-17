/**
 * Centralised input resolution for sink CLI.
 * Supports: --demo, stdin pipe, --url, and file paths.
 */

import { readFileSync } from 'node:fs'
import { resolve, basename, extname } from 'node:path'
import { nanoid } from 'nanoid'
import chalk from 'chalk'
import { parseCSV } from './phases/scrub/parse.js'
import type { SinkRecord, Phase } from './types.js'

// ---------------------------------------------------------------------------
// Embedded demo data (video/contacts.csv)
// ---------------------------------------------------------------------------

export const DEMO_CSV = `name,email,outlet,role
James Hartley,james.hartley@bbc.co.uk,BBC Radio 1,Producer
Sophie Chen,sophie@radiox.co.uk,Radio X,Presenter
Dan Foster,dan.foster@gmial.com,Kerrang Radio,Producer
Rachel Torres,rachel@absoluteradio.co.uk,Absolute Radio,DJ
Priya Kapoor,priya@diymagazine.com,DIY Magazine,Reviews Editor
Alex Murray,alex@clash-magazine.com,Clash Magazine,Music Editor
Liam O'Brien,liam@hotmial.com,Radio Wigwam,Presenter
Tom Barrett,tom.barrett@radiox.co.uk,Radio X,Evening Show
Ryan Davis,ryan@gigslutz.co.uk,GigSlutz,Editor
Dan Foster,dan.foster@gmail.com,Kerrang Radio,Producer
Beth Carpenter,beth@,Loud and Quiet,Reviews
Nina Patel,nina@thelineofbestfit.com,The Line of Best Fit,Staff Writer`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function readFile(filePath: string): string {
  try {
    return readFileSync(resolve(filePath), 'utf-8')
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      console.error(chalk.red(`\n  File not found: ${filePath}`))
      console.error('')
      console.error(chalk.dim('  Try one of:'))
      console.error(chalk.dim('    sink scrub --demo          Use built-in sample data'))
      console.error(chalk.dim('    sink scrub --url <url>     Fetch from a URL'))
      console.error(chalk.dim('    pbpaste | sink scrub -     Pipe from clipboard'))
      console.error('')
    } else if (code === 'EISDIR') {
      console.error(chalk.red(`\n  That's a directory, not a file: ${filePath}`))
      console.error(chalk.dim('  Pass a CSV file path instead.\n'))
    } else {
      console.error(chalk.red(`\n  Cannot read file: ${filePath}`))
    }
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export interface InputSource {
  text: string
  label: string
}

export async function resolveInput(opts: {
  file?: string
  demo?: boolean
  url?: string
}): Promise<InputSource> {
  // 1. Demo mode
  if (opts.demo) {
    return { text: DEMO_CSV, label: 'demo data' }
  }

  // 2. Stdin (explicit `-` or piped input with no file)
  if (opts.file === '-' || (!opts.file && !opts.url && !process.stdin.isTTY)) {
    const text = await readStdin()
    if (!text.trim()) {
      console.error(chalk.red('\n  No data received on stdin.'))
      console.error(chalk.dim('  Pipe CSV data or use --demo for sample data.\n'))
      process.exit(1)
    }
    return { text, label: 'stdin' }
  }

  // 3. URL fetch
  if (opts.url) {
    try {
      const response = await fetch(opts.url)
      if (!response.ok) {
        console.error(chalk.red(`\n  Failed to fetch URL: ${response.status} ${response.statusText}`))
        console.error(chalk.dim(`  ${opts.url}\n`))
        process.exit(1)
      }
      const text = await response.text()
      if (!text.trim()) {
        console.error(chalk.red('\n  URL returned empty response.'))
        console.error(chalk.dim(`  ${opts.url}\n`))
        process.exit(1)
      }
      const urlLabel = basename(new URL(opts.url).pathname) || opts.url
      return { text, label: urlLabel }
    } catch (err) {
      console.error(chalk.red(`\n  Cannot fetch URL: ${opts.url}`))
      if (err instanceof Error) {
        console.error(chalk.dim(`  ${err.message}\n`))
      }
      process.exit(1)
    }
  }

  // 4. File path
  if (opts.file) {
    const cleaned = opts.file.trim().replace(/^["']|["']$/g, '')
    const text = readFile(cleaned)
    return { text, label: basename(cleaned) }
  }

  // 5. Nothing provided
  console.error(chalk.red('\n  No input provided.'))
  console.error('')
  console.error(chalk.dim('  Pass a file, or try:'))
  console.error(chalk.dim('    sink scrub --demo          Built-in sample data'))
  console.error(chalk.dim('    sink scrub --url <url>     Fetch from a URL'))
  console.error(chalk.dim('    pbpaste | sink scrub -     Pipe from clipboard'))
  console.error(chalk.dim('    sink demo                  Full demo pipeline'))
  console.error('')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Parse resolved text into SinkRecords
// ---------------------------------------------------------------------------

export function parseInputText(text: string): SinkRecord[] {
  const { contacts, errors } = parseCSV(text)

  if (errors.length > 0 && contacts.length === 0) {
    console.error(chalk.red('  Parse error: ' + errors[0]))
    process.exit(2)
  }

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

// ---------------------------------------------------------------------------
// Output path derivation when no input file exists
// ---------------------------------------------------------------------------

export function deriveOutputPath(
  inputLabel: string,
  inputFile: string | undefined,
  suffix: string,
  format: string,
): string {
  const ext = format === 'csv' ? '.csv' : format === 'jsonl' ? '.jsonl' : '.json'

  if (inputFile && inputFile !== '-') {
    const cleaned = inputFile.trim().replace(/^["']|["']$/g, '')
    const base = basename(cleaned, extname(cleaned))
    const dir = cleaned.includes('/') ? cleaned.replace(/\/[^/]+$/, '') : '.'
    return `${dir}/${base}${suffix}${ext}`
  }

  // No file — use label-based fallback
  const base = inputLabel.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-')
  return `./${base}${suffix}${ext}`
}
