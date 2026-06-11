import { describe, it, expect } from 'vitest'
import * as core from '../src/core.js'

/**
 * Smoke test for the browser-safe entry: every advertised export exists, and
 * the pure paths work without any Node API. (Bundler-level proof that no
 * node: builtins leak into the graph happens in the web app's vite build.)
 */
describe('datasink/core entry', () => {
  it('exposes the full browser-safe surface', () => {
    const expected = [
      'parseCSV',
      'parseRows',
      'validateEmail',
      'validateEmailBatch',
      'scrub',
      'correctDomain',
      'getTypoMap',
      'DEFAULT_TYPO_MAP',
      'isDisposableDomain',
      'rinse',
      'exactDedup',
      'fuzzyMatch',
      'jaroWinkler',
      'crossFieldMatch',
      'generateCSV',
      'generateJSON',
      'generateJSONL',
      'MxCache',
      'InMemoryCache',
      'outletToDomain',
      'DEMO_CSV',
    ]
    for (const name of expected) {
      expect(core, `core export missing: ${name}`).toHaveProperty(name)
    }
  })

  it('parses the demo CSV and corrects a typo end-to-end (pure path)', () => {
    const { contacts } = core.parseCSV(core.DEMO_CSV)
    expect(contacts.length).toBe(12)

    const corrected = core.correctDomain('dan.foster', 'gmial.com')
    expect(corrected?.correctedDomain).toBe('gmail.com')

    expect(core.isDisposableDomain('tempmail.com')).toBe(true)
    expect(core.isDisposableDomain('bbc.co.uk')).toBe(false)
  })
})
