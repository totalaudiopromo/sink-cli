import { describe, it, expect } from 'vitest'
import { generateCSV } from '../src/output/csv.js'
import { generateJSON, generateJSONL } from '../src/output/json.js'
import type { SinkRecord } from '../src/types.js'

function record(overrides: Partial<SinkRecord['raw']>, extra?: Partial<SinkRecord>): SinkRecord {
  return {
    id: 'id-' + (overrides.name ?? 'x'),
    raw: { name: 'Unknown', ...overrides },
    phases: [],
    timestamp: '2026-06-11T00:00:00.000Z',
    ...extra,
  }
}

const records: SinkRecord[] = [
  record(
    { name: 'Sarah Jones', email: 'sarah@bbc.co.uk', outlet: 'BBC Radio 1' },
    { scrub: { email: { valid: true, normalised: 'sarah@bbc.co.uk', confidence: 'medium' } } },
  ),
  record({ name: 'Comma, Name', email: 'comma@example.com', notes: 'says "hi"\nand more' }),
  record(
    { name: 'Dupe Person', email: 'sarah@bbc.co.uk' },
    { rinse: { duplicate: true, canonical: false, mergedWith: 'sarah@bbc.co.uk' } },
  ),
]

describe('generateCSV', () => {
  it('excludes duplicates and emits only populated columns', () => {
    const csv = generateCSV(records)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('name,email,outlet,notes')
    // header + 2 non-duplicate rows, one of which spans 2 raw lines because
    // its quoted notes field contains a literal newline (RFC 4180)
    expect(lines.length).toBe(4)
    expect(csv).not.toContain('Dupe Person')
  })

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const csv = generateCSV(records)
    expect(csv).toContain('"Comma, Name"')
    expect(csv).toContain('"says ""hi""\nand more"')
  })

  it('prefers the scrub-normalised email over the raw value', () => {
    const fixed = record(
      { name: 'Typo Fix', email: 'dan@gmial.com' },
      { scrub: { email: { valid: true, normalised: 'dan@gmail.com', confidence: 'high' } } },
    )
    expect(generateCSV([fixed])).toContain('dan@gmail.com')
  })

  it('returns an empty string when every record is a duplicate', () => {
    expect(generateCSV([records[2]])).toBe('')
  })
})

describe('generateJSON / generateJSONL', () => {
  it('emits parseable JSON without duplicate records', () => {
    const parsed = JSON.parse(generateJSON(records)) as SinkRecord[]
    expect(parsed.length).toBe(2)
    expect(parsed[0].raw.name).toBe('Sarah Jones')
  })

  it('emits one JSON object per line', () => {
    const lines = generateJSONL(records).split('\n')
    expect(lines.length).toBe(2)
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
  })
})
