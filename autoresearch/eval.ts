/**
 * Autoresearch eval runner for sink-cli.
 *
 * Runs each benchmark CSV through the pipeline and checks binary evals.
 * Usage: npx tsx autoresearch/eval.ts
 */

import { runPipeline, loadConfig, parseCSV } from '../src/index.js'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { nanoid } from 'nanoid'
import type { SinkRecord, Phase } from '../src/types.js'

interface EvalResult {
  benchmark: string
  eval: string
  pass: boolean
  detail: string
}

function loadBenchmark(path: string): SinkRecord[] {
  const text = readFileSync(resolve(path), 'utf-8')
  const { contacts, errors } = parseCSV(text)
  if (errors.length > 0 && contacts.length === 0) {
    return []
  }
  return contacts.map((raw) => ({
    id: nanoid(),
    raw,
    phases: [] as Phase[],
    timestamp: new Date().toISOString(),
  }))
}

// ── Eval functions ──────────────────────────────────────────────

function evalTypos(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  // Known typos that should be corrected
  const expectedCorrections: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmail.co.k': 'hotmail.co.uk',
    'outlok.com': 'outlook.com',
    'yaho.com': 'yahoo.com',
    'bbc.com': 'bbc.co.uk',
    'sky.con': 'sky.com',
  }

  for (const record of records) {
    const email = record.raw.email ?? ''
    const domain = email.split('@')[1] ?? ''

    if (expectedCorrections[domain]) {
      const corrected = record.scrub?.email.corrected ?? false
      const normalised = record.scrub?.email.normalised ?? ''
      const expectedDomain = expectedCorrections[domain]

      results.push({
        benchmark: '01-typos',
        eval: `corrects ${domain}`,
        pass: corrected && normalised.endsWith(`@${expectedDomain}`),
        detail: corrected
          ? `${domain} → ${normalised.split('@')[1]}`
          : `NOT corrected (stayed as ${domain})`,
      })
    }
  }

  // Non-typo emails should NOT be "corrected"
  for (const record of records) {
    const email = record.raw.email ?? ''
    const domain = email.split('@')[1] ?? ''
    if (!expectedCorrections[domain] && domain) {
      const corrected = record.scrub?.email.corrected ?? false
      results.push({
        benchmark: '01-typos',
        eval: `no false positive on ${domain}`,
        pass: !corrected,
        detail: corrected ? `FALSELY corrected ${domain}` : 'correctly left alone',
      })
    }
  }

  return results
}

function evalInvalid(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  const shouldBeInvalid = [
    'No At Sign', 'Just At', 'No Domain', 'No Local',
    'Double At', 'Spaces', 'Trailing Dot', 'Leading Dot',
    'Script Injection', 'SQL Injection',
  ]
  const shouldBeValid = ['Valid Email', 'Valid Gmail']
  const emptyEmail = ['Empty Email']

  for (const record of records) {
    const name = record.raw.name
    if (shouldBeInvalid.includes(name)) {
      const valid = record.scrub?.email.valid ?? true
      results.push({
        benchmark: '02-invalid',
        eval: `${name} is invalid`,
        pass: !valid,
        detail: valid ? `WRONGLY marked valid` : 'correctly invalid',
      })
    }
    if (shouldBeValid.includes(name)) {
      const valid = record.scrub?.email.valid ?? false
      results.push({
        benchmark: '02-invalid',
        eval: `${name} is valid`,
        pass: valid,
        detail: valid ? 'correctly valid' : 'WRONGLY marked invalid',
      })
    }
    if (emptyEmail.includes(name)) {
      // Empty emails should either be invalid or have no scrub result
      const valid = record.scrub?.email.valid ?? false
      results.push({
        benchmark: '02-invalid',
        eval: `${name} handled`,
        pass: !valid,
        detail: valid ? 'WRONGLY marked valid' : 'correctly handled',
      })
    }
  }

  return results
}

function evalDedup(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  // Exact email dupes: sarah@bbc.co.uk appears 4 times, should have 3 dupes
  const sarahRecords = records.filter(
    (r) => r.scrub?.email.normalised === 'sarah@bbc.co.uk' || r.raw.email?.toLowerCase() === 'sarah@bbc.co.uk',
  )
  const sarahDupes = sarahRecords.filter((r) => r.rinse?.duplicate)
  results.push({
    benchmark: '03-dedup',
    eval: 'exact email dedup (sarah@bbc)',
    pass: sarahDupes.length >= 2, // at least 2 of 4 should be dupes
    detail: `${sarahDupes.length} of ${sarahRecords.length} marked as dupes`,
  })

  // Tom exact email dupe
  const tomRecords = records.filter(
    (r) => r.scrub?.email.normalised === 'tom@radiox.co.uk' || r.raw.email?.toLowerCase() === 'tom@radiox.co.uk',
  )
  const tomDupes = tomRecords.filter((r) => r.rinse?.duplicate)
  results.push({
    benchmark: '03-dedup',
    eval: 'exact email dedup (tom@radiox)',
    pass: tomDupes.length >= 1,
    detail: `${tomDupes.length} of ${tomRecords.length} marked as dupes`,
  })

  // Unique contacts should NOT be duped
  const uniqueRecords = records.filter(
    (r) => r.raw.name === 'Unique Contact' || r.raw.name === 'Another Unique',
  )
  const uniqueDupes = uniqueRecords.filter((r) => r.rinse?.duplicate)
  results.push({
    benchmark: '03-dedup',
    eval: 'no false positive dedup',
    pass: uniqueDupes.length === 0,
    detail: uniqueDupes.length > 0 ? 'FALSELY deduped unique contacts' : 'correctly kept unique',
  })

  return results
}

function evalRoleBased(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  const shouldBeRoleBased = [
    'Press Office', 'Info Account', 'Submissions', 'Studio Line',
    'Editorial', 'Programming', 'Playlist', 'Reception',
  ]
  const shouldNotBeRoleBased = ['Personal Contact', 'Named Gmail']

  for (const record of records) {
    const name = record.raw.name
    if (shouldBeRoleBased.includes(name)) {
      const roleBased = record.scrub?.email.roleBased ?? false
      results.push({
        benchmark: '04-role-based',
        eval: `${name} is role-based`,
        pass: roleBased,
        detail: roleBased ? 'correctly flagged' : 'MISSED role-based',
      })
    }
    if (shouldNotBeRoleBased.includes(name)) {
      const roleBased = record.scrub?.email.roleBased ?? false
      results.push({
        benchmark: '04-role-based',
        eval: `${name} is not role-based`,
        pass: !roleBased,
        detail: roleBased ? 'FALSELY flagged as role-based' : 'correctly personal',
      })
    }
  }

  return results
}

function evalHeaders(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  // Non-standard headers should be mapped correctly
  results.push({
    benchmark: '05-headers',
    eval: 'parsed correct count',
    pass: records.length === 3,
    detail: `${records.length} records parsed (expected 3)`,
  })

  // "Contact Name" should map to name
  const hasNames = records.every((r) => r.raw.name && r.raw.name.length > 0)
  results.push({
    benchmark: '05-headers',
    eval: '"Contact Name" maps to name',
    pass: hasNames,
    detail: hasNames ? 'all names parsed' : 'names missing',
  })

  // "E-Mail" should map to email
  const hasEmails = records.every((r) => r.raw.email && r.raw.email.includes('@'))
  results.push({
    benchmark: '05-headers',
    eval: '"E-Mail" maps to email',
    pass: hasEmails,
    detail: hasEmails ? 'all emails parsed' : 'emails missing',
  })

  // "Publication" should map to outlet
  const hasOutlets = records.every((r) => r.raw.outlet && r.raw.outlet.length > 0)
  results.push({
    benchmark: '05-headers',
    eval: '"Publication" maps to outlet',
    pass: hasOutlets,
    detail: hasOutlets ? 'all outlets parsed' : 'outlets missing',
  })

  return results
}

function evalMessy(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  // Should handle whitespace-padded names
  const sarah = records.find((r) => r.raw.name.includes('Sarah'))
  results.push({
    benchmark: '06-messy',
    eval: 'trims whitespace in names',
    pass: sarah?.raw.name === 'Sarah Jones',
    detail: sarah ? `name="${sarah.raw.name}"` : 'Sarah not found',
  })

  // Should handle whitespace-padded emails
  const tom = records.find((r) => r.raw.name.includes('Tom'))
  const tomEmail = tom?.scrub?.email.normalised ?? tom?.raw.email ?? ''
  results.push({
    benchmark: '06-messy',
    eval: 'trims whitespace in emails',
    pass: tomEmail === 'tom@radiox.co.uk',
    detail: `email="${tomEmail}"`,
  })

  // Should handle escaped quotes in CSV
  const emily = records.find((r) => r.raw.name.includes('Em'))
  results.push({
    benchmark: '06-messy',
    eval: 'handles escaped quotes',
    pass: emily != null && emily.raw.name.includes('"Em"'),
    detail: emily ? `name="${emily.raw.name}"` : 'Emily not found',
  })

  // Should skip blank rows
  results.push({
    benchmark: '06-messy',
    eval: 'skips blank rows',
    pass: records.length <= 4, // 3-4 real records, not 6
    detail: `${records.length} records (expected 3-4, not 6)`,
  })

  return results
}

function evalRealWorld(records: SinkRecord[]): EvalResult[] {
  const results: EvalResult[] = []

  // First/last name columns should be joined
  const james = records.find((r) => r.raw.name.includes('James'))
  results.push({
    benchmark: '07-real-world',
    eval: 'joins first/last name',
    pass: james?.raw.name === 'James Hartley',
    detail: james ? `name="${james.raw.name}"` : 'James not found',
  })

  // Should handle apostrophes in names
  const liam = records.find((r) => r.raw.name.includes('Liam'))
  results.push({
    benchmark: '07-real-world',
    eval: "handles apostrophe in name",
    pass: liam?.raw.name === "Liam O'Brien",
    detail: liam ? `name="${liam.raw.name}"` : 'Liam not found',
  })

  // Total contacts parsed
  results.push({
    benchmark: '07-real-world',
    eval: 'parses all rows',
    pass: records.length === 11,
    detail: `${records.length} records (expected 11)`,
  })

  // Beth's invalid email caught
  const beth = records.find((r) => r.raw.name.includes('Beth'))
  results.push({
    benchmark: '07-real-world',
    eval: 'catches incomplete email',
    pass: beth?.scrub?.email.valid === false,
    detail: beth?.scrub ? `valid=${beth.scrub.email.valid}` : 'no scrub result',
  })

  // Dan Foster duplicate caught (when rinse is run)
  const dans = records.filter((r) => r.raw.name.includes('Dan'))
  const danDupes = dans.filter((r) => r.rinse?.duplicate)
  results.push({
    benchmark: '07-real-world',
    eval: 'deduplicates Dan Foster',
    pass: danDupes.length >= 1,
    detail: `${danDupes.length} of ${dans.length} Dan records are dupes`,
  })

  // Press Office flagged as role-based
  const press = records.find((r) => r.raw.name.includes('Press'))
  results.push({
    benchmark: '07-real-world',
    eval: 'flags role-based email',
    pass: press?.scrub?.email.roleBased === true,
    detail: press?.scrub ? `roleBased=${press.scrub.email.roleBased}` : 'no scrub result',
  })

  return results
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const config = await loadConfig()
  const benchmarkDir = resolve('autoresearch/benchmarks')
  const files = readdirSync(benchmarkDir).filter((f) => f.endsWith('.csv')).sort()

  const allResults: EvalResult[] = []

  for (const file of files) {
    const path = `${benchmarkDir}/${file}`
    const records = loadBenchmark(path)

    if (records.length === 0) {
      console.log(`  SKIP  ${file} (no records)`)
      continue
    }

    // Determine which phases to run based on benchmark
    const phases: Phase[] = file.includes('dedup') || file.includes('real-world')
      ? ['scrub', 'rinse']
      : ['scrub']

    const { records: processed } = await runPipeline(records, { phases, config })

    // Run relevant evals
    const num = file.split('-')[0]
    switch (num) {
      case '01': allResults.push(...evalTypos(processed)); break
      case '02': allResults.push(...evalInvalid(processed)); break
      case '03': allResults.push(...evalDedup(processed)); break
      case '04': allResults.push(...evalRoleBased(processed)); break
      case '05': allResults.push(...evalHeaders(processed)); break
      case '06': allResults.push(...evalMessy(processed)); break
      case '07': allResults.push(...evalRealWorld(processed)); break
    }
  }

  // Print results
  console.log('')
  console.log('  SINK-CLI AUTORESEARCH — BASELINE EVAL')
  console.log('  ' + '─'.repeat(60))
  console.log('')

  let passed = 0
  let failed = 0
  let currentBenchmark = ''

  for (const r of allResults) {
    if (r.benchmark !== currentBenchmark) {
      if (currentBenchmark) console.log('')
      currentBenchmark = r.benchmark
      console.log(`  ${r.benchmark}`)
    }

    const icon = r.pass ? '  ✓' : '  ✗'
    const colour = r.pass ? '\x1b[32m' : '\x1b[31m'
    const reset = '\x1b[0m'
    console.log(`${colour}${icon} ${r.eval.padEnd(40)} ${r.detail}${reset}`)

    if (r.pass) passed++
    else failed++
  }

  const total = passed + failed
  const score = total > 0 ? Math.round((passed / total) * 100) : 0
  console.log('')
  console.log('  ' + '─'.repeat(60))
  console.log(`  Score: ${score}% (${passed}/${total} passed, ${failed} failed)`)
  console.log('')

  // Write results TSV
  const tsv = ['experiment\tmutation\tresult\tscore\tdetails']
  tsv.push(`0\t(baseline)\tbaseline\t${score}%\t${passed}/${total} passed`)
  const tsvContent = tsv.join('\n') + '\n'

  const { writeFileSync } = await import('node:fs')
  writeFileSync(resolve('autoresearch/results.tsv'), tsvContent)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
