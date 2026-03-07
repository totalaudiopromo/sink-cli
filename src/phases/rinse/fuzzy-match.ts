/**
 * Jaro-Winkler distance between two strings.
 * Returns a value between 0 (no match) and 1 (exact match).
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler modification: boost for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

import type { SinkRecord } from '../../types.js';

/**
 * Find fuzzy name matches within the same email domain.
 * Only compares records not already marked as duplicates.
 */
export function fuzzyMatch(
  records: SinkRecord[],
  threshold = 0.92,
): SinkRecord[] {
  const result = [...records];

  // Group non-duplicate records by email domain
  const byDomain = new Map<string, number[]>();
  for (let i = 0; i < result.length; i++) {
    if (result[i].rinse?.duplicate) continue;
    const email =
      result[i].scrub?.email.normalised || result[i].raw.email;
    if (!email) continue;
    const atIdx = email.indexOf('@');
    if (atIdx === -1) continue;
    const domain = email.slice(atIdx + 1).toLowerCase();
    const indices = byDomain.get(domain) ?? [];
    indices.push(i);
    byDomain.set(domain, indices);
  }

  // Compare names within each domain
  for (const indices of byDomain.values()) {
    if (indices.length < 2) continue;
    for (let a = 0; a < indices.length; a++) {
      if (result[indices[a]].rinse?.duplicate) continue;
      for (let b = a + 1; b < indices.length; b++) {
        if (result[indices[b]].rinse?.duplicate) continue;
        const nameA = result[indices[a]].raw.name.toLowerCase();
        const nameB = result[indices[b]].raw.name.toLowerCase();
        const similarity = jaroWinkler(nameA, nameB);
        if (similarity >= threshold) {
          // Mark the one with fewer fields as duplicate
          const countA = Object.values(result[indices[a]].raw).filter(
            Boolean,
          ).length;
          const countB = Object.values(result[indices[b]].raw).filter(
            Boolean,
          ).length;
          const dupIdx = countB >= countA ? indices[a] : indices[b];
          const canonIdx =
            dupIdx === indices[a] ? indices[b] : indices[a];
          const canonEmail =
            result[canonIdx].scrub?.email.normalised ||
            result[canonIdx].raw.email ||
            '';
          result[dupIdx] = {
            ...result[dupIdx],
            rinse: {
              duplicate: true,
              mergedWith: canonEmail,
              matchType: 'fuzzy-name',
              matchConfidence: similarity,
              canonical: false,
            },
          };
        }
      }
    }
  }

  return result;
}
