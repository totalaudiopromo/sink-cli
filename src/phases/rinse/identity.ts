import type { SinkRecord } from '../../types.js';

/**
 * Cross-field matching: find records with matching phone or website
 * across different email addresses.
 */
export function crossFieldMatch(records: SinkRecord[]): SinkRecord[] {
  const result = [...records];

  // Build phone index
  const byPhone = new Map<string, number>();
  for (let i = 0; i < result.length; i++) {
    if (result[i].rinse?.duplicate) continue;
    const phone = result[i].raw.phone?.replace(/[\s\-()]/g, '');
    if (!phone || phone.length < 6) continue;

    const existing = byPhone.get(phone);
    if (existing !== undefined) {
      // Same phone, different email -- potential cross-field match
      const existingEmail =
        result[existing].scrub?.email.normalised ||
        result[existing].raw.email;
      const currentEmail =
        result[i].scrub?.email.normalised || result[i].raw.email;
      if (existingEmail !== currentEmail) {
        // Mark the one with fewer fields as duplicate
        const countExisting = Object.values(
          result[existing].raw,
        ).filter(Boolean).length;
        const countCurrent = Object.values(result[i].raw).filter(
          Boolean,
        ).length;
        if (countCurrent <= countExisting) {
          result[i] = {
            ...result[i],
            rinse: {
              duplicate: true,
              mergedWith: existingEmail || '',
              matchType: 'cross-field',
              matchConfidence: 0.85,
              canonical: false,
            },
          };
        } else {
          result[existing] = {
            ...result[existing],
            rinse: {
              duplicate: true,
              mergedWith: currentEmail || '',
              matchType: 'cross-field',
              matchConfidence: 0.85,
              canonical: false,
            },
          };
          byPhone.set(phone, i);
        }
      }
    } else {
      byPhone.set(phone, i);
    }
  }

  return result;
}
