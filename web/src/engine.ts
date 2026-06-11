/**
 * Runs the real datasink engine (scrub + rinse) client-side and narrates the
 * run as TerminalLine events that mirror the CLI's output, line for line.
 */

import { parseCSV, scrub, rinse, generateCSV } from 'datasink/core'
import type { SinkConfig, SinkRecord } from 'datasink/core'
import type { TerminalLine, TerminalLineKind, WebStats } from './types'

export type OnLine = (line: TerminalLine) => void

export interface EngineResult {
  stats: WebStats
  cleanCsv: string
  parseError?: string
}

const WEB_CONFIG: SinkConfig = {
  scrub: {},
  rinse: {
    fuzzyThreshold: 0.92,
    strategies: ['exact-email', 'fuzzy-name', 'cross-field'],
  },
  soak: { provider: 'anthropic' },
  steep: { scraper: 'firecrawl', extractor: 'anthropic' },
  output: { format: 'csv', locale: 'en-GB' },
}

let lineCounter = 0
function line(
  kind: TerminalLineKind,
  data: TerminalLine['data'] = {},
  replace = false,
): TerminalLine {
  lineCounter += 1
  return { id: `L${lineCounter}`, kind, data, replace }
}

function reasonFor(record: SinkRecord): { tone: 'ok' | 'warn' | 'fail'; text: string } {
  const email = record.scrub?.email
  if (!email) return { tone: 'ok', text: '' }
  if (!email.valid) {
    const map: Record<string, string> = {
      invalid_format: 'invalid format',
      no_mx_record: 'no mail server',
      disposable_domain: 'disposable',
    }
    return { tone: 'fail', text: map[email.reason ?? ''] ?? 'invalid' }
  }
  if (email.confidence === 'medium') {
    if (email.catchAll) return { tone: 'warn', text: 'catch-all' }
    if (email.roleBased) return { tone: 'warn', text: 'role-based' }
    return { tone: 'warn', text: 'unverified' }
  }
  return { tone: 'ok', text: 'ok' }
}

export async function runEngine(csvText: string, onLine: OnLine): Promise<EngineResult> {
  const start = Date.now()

  const { contacts, errors } = parseCSV(csvText)
  if (contacts.length === 0) {
    return {
      stats: {
        total: 0,
        valid: 0,
        risky: 0,
        invalid: 0,
        typos: 0,
        duplicates: 0,
        quality: 0,
        durationMs: 0,
        cleanCount: 0,
      },
      cleanCsv: '',
      parseError: errors[0] ?? 'No usable rows found in that file.',
    }
  }

  let records: SinkRecord[] = contacts.map((raw) => ({
    id: crypto.randomUUID(),
    raw,
    phases: [],
    timestamp: new Date().toISOString(),
  }))

  onLine(line('step', { text: `Processing ${contacts.length} contacts through scrub → rinse` }))
  onLine(line('blank'))

  // ── Scrub ────────────────────────────────────────────────────────────────
  onLine(line('progress', { text: 'Scrubbing…' }))
  records = await scrub(records, WEB_CONFIG, (progress) => {
    onLine(
      line('progress', { text: `Scrubbing… ${progress.current}/${progress.total} emails` }, true),
    )
  })
  onLine(line('step-complete', { text: 'Scrub complete' }, true))

  let valid = 0
  let risky = 0
  let invalid = 0
  let typos = 0
  for (const r of records) {
    const email = r.scrub?.email
    if (!email || !email.valid) invalid += 1
    else if (email.confidence === 'medium') risky += 1
    else valid += 1
    if (email?.corrected) typos += 1
  }

  onLine(line('validation-row', { icon: 'ok', label: 'Valid', count: valid, unit: 'emails' }))
  onLine(
    line('validation-row', {
      icon: risky > 0 ? 'warn' : 'ok',
      label: 'Risky',
      count: risky,
      unit: 'emails',
    }),
  )
  onLine(
    line('validation-row', {
      icon: invalid > 0 ? 'fail' : 'ok',
      label: 'Invalid',
      count: invalid,
      unit: 'emails',
    }),
  )
  if (typos > 0) {
    onLine(line('validation-row', { icon: 'warn', label: 'Typos', count: typos, unit: 'fixed' }))
  }
  onLine(line('blank'))

  // ── Rinse ────────────────────────────────────────────────────────────────
  onLine(line('progress', { text: 'Rinsing…' }))
  records = await rinse(records, WEB_CONFIG)
  const duplicates = records.filter((r) => r.rinse?.duplicate).length
  onLine(line('step-complete', { text: 'Rinse complete' }, true))
  onLine(
    line('validation-row', {
      icon: duplicates > 0 ? 'warn' : 'ok',
      label: 'Duplicates',
      count: duplicates,
      unit: 'merged',
    }),
  )
  onLine(line('blank'))
  onLine(line('divider'))
  onLine(line('blank'))

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = records.length
  const quality = total > 0 ? Math.round(((valid + risky * 0.5) / total) * 100) : 0
  onLine(line('quality', { quality }))
  onLine(line('blank'))
  onLine(line('transform-summary', { total, valid, risky, invalid }))
  if (typos > 0 || duplicates > 0) {
    onLine(line('transform-detail', { typos, duplicates }))
  }
  onLine(line('blank'))

  // ── Contact table (first 15, like the CLI) ───────────────────────────────
  const MAX_ROWS = 15
  let shown = 0
  for (const r of records) {
    if (shown >= MAX_ROWS) break
    if (r.rinse?.duplicate) {
      onLine(
        line('contact-dupe', {
          name: r.raw.name,
          matchType: r.rinse.matchType ?? 'exact-email',
          mergedWith: r.rinse.mergedWith ?? '',
        }),
      )
      shown += 1
      continue
    }
    const { tone, text } = reasonFor(r)
    onLine(
      line('contact-row', {
        tone,
        name: r.raw.name,
        email: r.scrub?.email.normalised || r.raw.email || '',
        reason: text,
      }),
    )
    shown += 1
  }
  if (records.length > MAX_ROWS) {
    onLine(line('plain', { text: `…and ${records.length - MAX_ROWS} more`, dim: true }))
  }
  onLine(line('blank'))

  // ── Output ───────────────────────────────────────────────────────────────
  const cleanCsv = generateCSV(records)
  const cleanCount = records.filter((r) => !r.rinse?.duplicate).length
  onLine(line('output-path', { path: 'contacts-clean.csv' }))
  onLine(line('blank'))

  const durationMs = Date.now() - start
  onLine(line('outro', { seconds: (durationMs / 1000).toFixed(1) }))

  return {
    stats: { total, valid, risky, invalid, typos, duplicates, quality, durationMs, cleanCount },
    cleanCsv,
  }
}
