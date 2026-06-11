/**
 * Node entry for the typo map: adds fs-backed custom map loading on top of
 * the pure data module. Browser builds swap this file for
 * typo-map.browser.ts via the package.json "browser" field.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTypoMap } from './typo-map-data.js'

export { getTypoMap, correctDomain, DEFAULT_TYPO_MAP } from './typo-map-data.js'

export function loadTypoMap(customPath?: string): Record<string, string> {
  if (customPath) {
    const text = readFileSync(resolve(customPath), 'utf-8')
    const custom = JSON.parse(text) as Record<string, string>
    return setTypoMap(custom)
  }
  return setTypoMap()
}
