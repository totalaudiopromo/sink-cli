import type { SinkRecord } from '../../types.js';

/**
 * Count populated fields on a record's raw data.
 */
function populatedFieldCount(record: SinkRecord): number {
  const r = record.raw;
  let count = 0;
  if (r.name) count++;
  if (r.email) count++;
  if (r.outlet) count++;
  if (r.role) count++;
  if (r.phone) count++;
  if (r.website) count++;
  if (r.notes) count++;
  if (r.tags && r.tags.length > 0) count++;
  if (r.extras) count += Object.keys(r.extras).length;
  return count;
}

/**
 * Deduplicate by exact email match (case-insensitive).
 * Keeps the record with more populated fields as canonical.
 */
export function exactDedup(records: SinkRecord[]): SinkRecord[] {
  const seen = new Map<string, number>(); // email -> index of canonical record
  const result: SinkRecord[] = [...records];

  for (let i = 0; i < result.length; i++) {
    const email = result[i].raw.email?.toLowerCase().trim();
    // Also check scrub normalised email if available
    const normEmail = result[i].scrub?.email.normalised?.toLowerCase().trim();
    const key = normEmail || email;

    if (!key) {
      // No email -- mark as canonical, not duplicate
      result[i] = {
        ...result[i],
        rinse: {
          ...(result[i].rinse ?? {}),
          duplicate: false,
          canonical: true,
        },
      };
      continue;
    }

    const existingIdx = seen.get(key);
    if (existingIdx === undefined) {
      seen.set(key, i);
      result[i] = {
        ...result[i],
        rinse: {
          ...(result[i].rinse ?? {}),
          duplicate: false,
          canonical: true,
        },
      };
    } else {
      // Duplicate found -- keep the one with more fields
      const existingCount = populatedFieldCount(result[existingIdx]);
      const currentCount = populatedFieldCount(result[i]);

      if (currentCount > existingCount) {
        // Current record is richer -- it becomes canonical
        result[existingIdx] = {
          ...result[existingIdx],
          rinse: {
            duplicate: true,
            mergedWith: key,
            matchType: 'exact-email',
            matchConfidence: 1.0,
            canonical: false,
          },
        };
        result[i] = {
          ...result[i],
          rinse: {
            duplicate: false,
            canonical: true,
          },
        };
        seen.set(key, i);
      } else {
        // Existing record stays canonical
        result[i] = {
          ...result[i],
          rinse: {
            duplicate: true,
            mergedWith: key,
            matchType: 'exact-email',
            matchConfidence: 1.0,
            canonical: false,
          },
        };
      }
    }
  }

  return result;
}
