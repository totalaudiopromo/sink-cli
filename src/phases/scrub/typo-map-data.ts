/**
 * UK-centric domain typo map: data + pure lookup logic.
 *
 * No Node imports — this module is browser-safe. The fs-backed custom-map
 * loader lives in typo-map.ts (Node) with a no-op twin in typo-map.browser.ts.
 */

export const DEFAULT_TYPO_MAP: Record<string, string> = {
  'bbc.co.k': 'bbc.co.uk',
  'bbc.co.u': 'bbc.co.uk',
  'bbc.com': 'bbc.co.uk',
  'hotmail.co.k': 'hotmail.co.uk',
  'hotmail.co.u': 'hotmail.co.uk',
  'yahoo.co.k': 'yahoo.co.uk',
  'yahoo.co.u': 'yahoo.co.uk',
  'btinternet.con': 'btinternet.com',
  'sky.con': 'sky.com',
  'virginmedia.con': 'virginmedia.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
}

let activeMap: Record<string, string> = { ...DEFAULT_TYPO_MAP }

/** Replace the active map (defaults merged with any custom entries). */
export function setTypoMap(custom?: Record<string, string>): Record<string, string> {
  activeMap = custom ? { ...DEFAULT_TYPO_MAP, ...custom } : { ...DEFAULT_TYPO_MAP }
  return activeMap
}

export function getTypoMap(): Record<string, string> {
  return activeMap
}

export function correctDomain(
  localPart: string,
  domain: string,
): { correctedEmail: string; correctedDomain: string } | null {
  const corrected = activeMap[domain]
  if (!corrected) return null
  return { correctedEmail: `${localPart}@${corrected}`, correctedDomain: corrected }
}
