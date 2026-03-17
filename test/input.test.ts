import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEMO_CSV, parseInputText, deriveOutputPath } from '../src/input.js'

describe('DEMO_CSV', () => {
  it('contains valid CSV with header row', () => {
    const lines = DEMO_CSV.trim().split('\n')
    expect(lines[0]).toBe('name,email,outlet,role')
    expect(lines.length).toBeGreaterThan(5)
  })

  it('contains example data with typos, dupes, and edge cases', () => {
    expect(DEMO_CSV).toContain('gmial.com') // typo
    expect(DEMO_CSV).toContain('hotmial.com') // typo
    expect(DEMO_CSV).toContain('Dan Foster') // duplicate name
    expect(DEMO_CSV).toContain('beth@,') // missing domain
  })
})

describe('parseInputText', () => {
  // Suppress process.exit in tests
  let exitSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('parses valid CSV text into SinkRecords', () => {
    const records = parseInputText('name,email\nAlice,alice@test.com\nBob,bob@test.com')
    expect(records).toHaveLength(2)
    expect(records[0].raw.name).toBe('Alice')
    expect(records[0].raw.email).toBe('alice@test.com')
    expect(records[0].id).toBeDefined()
    expect(records[0].timestamp).toBeDefined()
    expect(records[0].phases).toEqual([])
  })

  it('parses the embedded demo CSV', () => {
    const records = parseInputText(DEMO_CSV)
    expect(records.length).toBeGreaterThan(5)
    // Should have names and emails
    const names = records.map((r) => r.raw.name)
    expect(names).toContain('James Hartley')
    expect(names).toContain('Sophie Chen')
  })

  it('exits on completely invalid CSV', () => {
    expect(() => parseInputText('')).toThrow('process.exit called')
  })

  it('generates unique IDs for each record', () => {
    const records = parseInputText('name,email\nA,a@t.com\nB,b@t.com')
    const ids = records.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('deriveOutputPath', () => {
  it('derives from file path when present', () => {
    const result = deriveOutputPath('contacts.csv', './contacts.csv', '-clean', 'csv')
    expect(result).toBe('./contacts-clean.csv')
  })

  it('uses label-based fallback when no file', () => {
    const result = deriveOutputPath('demo data', undefined, '-clean', 'csv')
    expect(result).toBe('./demo-data-clean.csv')
  })

  it('uses label-based fallback for stdin', () => {
    const result = deriveOutputPath('stdin', '-', '-clean', 'csv')
    expect(result).toBe('./stdin-clean.csv')
  })

  it('handles json format extension', () => {
    const result = deriveOutputPath('demo data', undefined, '-clean', 'json')
    expect(result).toBe('./demo-data-clean.json')
  })

  it('handles jsonl format extension', () => {
    const result = deriveOutputPath('demo data', undefined, '-clean', 'jsonl')
    expect(result).toBe('./demo-data-clean.jsonl')
  })

  it('preserves directory from file path', () => {
    const result = deriveOutputPath('contacts.csv', 'data/contacts.csv', '-clean', 'csv')
    expect(result).toBe('data/contacts-clean.csv')
  })
})
