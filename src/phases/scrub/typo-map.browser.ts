/**
 * Browser twin of typo-map.ts (swapped in via the package.json "browser"
 * field). Custom typo-map files are a filesystem concept, so loadTypoMap
 * ignores the path and always serves the embedded default map.
 */

import { setTypoMap } from './typo-map-data.js'

export { getTypoMap, correctDomain, DEFAULT_TYPO_MAP } from './typo-map-data.js'

export function loadTypoMap(_customPath?: string): Record<string, string> {
  return setTypoMap()
}
