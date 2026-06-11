/**
 * Runs the real datasink engine client-side and narrates each run as
 * TerminalLine events that mirror the CLI's output, line for line.
 *
 * The deterministic phases (scrub + rinse) run locally with no key. The AI
 * phases (soak + steep) live in soak-browser.ts / steep-browser.ts and are
 * invoked separately by the hook once the user supplies a key — so the run
 * pauses between rinse and soak rather than running straight through.
 */

import { parseCSV, scrub, rinse, validateEmail, MxCache } from 'datasink/core'
import type { SinkConfig, SinkRecord } from 'datasink/core'
import type { TerminalLine, TerminalLineKind, WebStats, RunMode } from './types'

export type OnLine = (line: TerminalLine) => void

export interface CleanResult {
  records: SinkRecord[]
  stats: WebStats
  parseError?: string
  /** True when scrub+rinse ran and the run can now offer AI enrichment. */
  needsKeys: boolean
}

export const WEB_CONFIG: SinkConfig = {
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
export function line(
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

function emptyStats(): WebStats {
  return {
    total: 0,
    valid: 0,
    risky: 0,
    invalid: 0,
    typos: 0,
    duplicates: 0,
    quality: 0,
    durationMs: 0,
    cleanCount: 0,
  }
}

/**
 * Runs scrub, then rinse (full mode only), narrating each step. Does NOT narrate
 * the closing summary — the caller calls narrateSummary() after the AI phases
 * (or immediately, when the user skips them). Inspect mode runs scrub only.
 */
export async function runClean(
  csvText: string,
  onLine: OnLine,
  mode: RunMode = 'full',
): Promise<CleanResult> {
  const { contacts, errors } = parseCSV(csvText)
  if (contacts.length === 0) {
    return {
      records: [],
      stats: emptyStats(),
      parseError: errors[0] ?? 'No usable rows found in that file.',
      needsKeys: false,
    }
  }

  let records: SinkRecord[] = contacts.map((raw) => ({
    id: crypto.randomUUID(),
    raw,
    phases: [],
    timestamp: new Date().toISOString(),
  }))

  const flow = mode === 'inspect' ? 'scrub' : 'scrub → rinse'
  onLine(line('step', { text: `Processing ${contacts.length} contacts through ${flow}` }))
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

  // ── Rinse (full mode only) ────────────────────────────────────────────────
  let duplicates = 0
  if (mode !== 'inspect') {
    onLine(line('progress', { text: 'Rinsing…' }))
    records = await rinse(records, WEB_CONFIG)
    duplicates = records.filter((r) => r.rinse?.duplicate).length
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
  }

  const total = records.length
  const quality = total > 0 ? Math.round(((valid + risky * 0.5) / total) * 100) : 0
  const cleanCount = records.filter((r) => !r.rinse?.duplicate).length

  const stats: WebStats = {
    total,
    valid,
    risky,
    invalid,
    typos,
    duplicates,
    quality,
    durationMs: 0,
    cleanCount,
  }

  return { records, stats, needsKeys: mode === 'full' }
}

/**
 * Narrates the closing summary: quality score, transform line, contact table,
 * output path, outro. Shared by the skip path and the post-AI path. In
 * reportOnly mode (inspect) no output path is shown.
 */
export function narrateSummary(
  records: SinkRecord[],
  stats: WebStats,
  onLine: OnLine,
  opts: { durationMs: number; reportOnly?: boolean },
): void {
  onLine(line('divider'))
  onLine(line('blank'))

  onLine(line('quality', { quality: stats.quality }))
  onLine(line('blank'))
  onLine(
    line('transform-summary', {
      total: stats.total,
      valid: stats.valid,
      risky: stats.risky,
      invalid: stats.invalid,
    }),
  )
  if (stats.typos > 0 || stats.duplicates > 0) {
    onLine(line('transform-detail', { typos: stats.typos, duplicates: stats.duplicates }))
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

  if (opts.reportOnly) {
    onLine(line('plain', { text: 'Report only — no file written.', dim: true }))
  } else {
    onLine(line('output-path', { path: 'contacts-clean.csv' }))
  }
  onLine(line('blank'))
  onLine(line('outro', { seconds: (opts.durationMs / 1000).toFixed(1) }))
}

/**
 * Spot-checks a single email address — mirrors the CLI's `sink spot`.
 * Validates format, typo correction, role/catch-all flags, and MX record.
 */
export async function runSpot(email: string, onLine: OnLine): Promise<void> {
  const trimmed = email.trim()
  onLine(line('step', { text: `Spot-checking ${trimmed}` }))
  onLine(line('blank'))
  onLine(line('progress', { text: 'Checking format and mail server…' }))

  const result = await validateEmail(trimmed, { mxCache: new MxCache() })
  const e = result

  onLine(line('step-complete', { text: 'Check complete' }, true))
  onLine(line('blank'))

  const row = (label: string, ok: boolean | 'warn', value: string) =>
    line('validation-row', {
      icon: ok === 'warn' ? 'warn' : ok ? 'ok' : 'fail',
      label,
      count: '' as unknown as number,
      unit: value,
    })

  // Format
  onLine(row('Format', e.checks?.regex ?? e.valid, e.checks?.regex ?? e.valid ? 'valid' : 'invalid'))
  // Typo correction
  if (e.corrected) {
    onLine(
      line('plain', {
        text: `Typo corrected: ${e.original} → ${e.suggested ?? e.normalised}`,
        dim: false,
      }),
    )
  }
  // Disposable
  onLine(row('Disposable', e.disposable ? false : true, e.disposable ? 'yes' : 'no'))
  // Role-based
  onLine(row('Role-based', e.roleBased ? 'warn' : true, e.roleBased ? 'yes' : 'no'))
  // Catch-all
  onLine(row('Catch-all', e.catchAll ? 'warn' : true, e.catchAll ? 'yes' : 'no'))
  // MX
  onLine(row('Mail server', e.checks?.mx ?? false, e.checks?.mx ? 'present' : 'none'))
  onLine(line('blank'))

  const verdict = e.valid
    ? e.confidence === 'high'
      ? { tone: 'ok', text: 'Looks good — high confidence' }
      : { tone: 'warn', text: 'Deliverable but unverified' }
    : { tone: 'fail', text: 'Not deliverable' }
  onLine(
    line('contact-row', {
      tone: verdict.tone,
      name: e.normalised || trimmed,
      email: '',
      reason: verdict.text,
    }),
  )
  onLine(line('blank'))
}
