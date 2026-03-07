import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TYPO_MAP: Record<string, string> = {
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
};

let activeMap: Record<string, string> = { ...DEFAULT_TYPO_MAP };

export function loadTypoMap(customPath?: string): Record<string, string> {
  if (customPath) {
    const text = readFileSync(resolve(customPath), 'utf-8');
    const custom = JSON.parse(text) as Record<string, string>;
    activeMap = { ...DEFAULT_TYPO_MAP, ...custom };
  } else {
    activeMap = { ...DEFAULT_TYPO_MAP };
  }
  return activeMap;
}

export function getTypoMap(): Record<string, string> {
  return activeMap;
}

export function correctDomain(
  localPart: string,
  domain: string
): { correctedEmail: string; correctedDomain: string } | null {
  const corrected = activeMap[domain];
  if (!corrected) return null;
  return { correctedEmail: `${localPart}@${corrected}`, correctedDomain: corrected };
}
