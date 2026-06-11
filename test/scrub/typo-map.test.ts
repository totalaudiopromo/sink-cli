import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadTypoMap,
  getTypoMap,
  correctDomain,
  DEFAULT_TYPO_MAP,
} from '../../src/phases/scrub/typo-map.js'
import { loadTypoMap as loadTypoMapBrowser } from '../../src/phases/scrub/typo-map.browser.js'

const tmpDirs: string[] = []

afterEach(() => {
  loadTypoMap() // reset active map to defaults between tests
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('typo-map (Node entry)', () => {
  it('serves the embedded default map with no custom path', () => {
    const map = loadTypoMap()
    expect(map['gmial.com']).toBe('gmail.com')
    expect(map).toEqual(DEFAULT_TYPO_MAP)
    expect(getTypoMap()['bbc.com']).toBe('bbc.co.uk')
  })

  it('merges a custom JSON map over the defaults', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sink-typo-'))
    tmpDirs.push(dir)
    const path = join(dir, 'custom.json')
    writeFileSync(path, JSON.stringify({ 'radoix.co.uk': 'radiox.co.uk' }), 'utf-8')

    const map = loadTypoMap(path)
    expect(map['radoix.co.uk']).toBe('radiox.co.uk')
    // Defaults survive the merge
    expect(map['gmial.com']).toBe('gmail.com')
    // correctDomain consults the merged active map
    expect(correctDomain('tom', 'radoix.co.uk')?.correctedDomain).toBe('radiox.co.uk')
  })

  it('returns null from correctDomain for unknown domains', () => {
    expect(correctDomain('tom', 'radiox.co.uk')).toBeNull()
  })
})

describe('typo-map.browser (browser twin)', () => {
  it('ignores custom paths and always serves the default map', () => {
    const map = loadTypoMapBrowser('/some/custom/path.json')
    expect(map).toEqual(DEFAULT_TYPO_MAP)
  })
})
