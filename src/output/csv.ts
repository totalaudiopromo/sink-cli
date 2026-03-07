import type { SinkRecord } from '../types.js';

/**
 * Escape a CSV field per RFC 4180.
 */
function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a clean CSV from SinkRecords.
 * Outputs raw fields plus phase results as additional columns.
 */
export function generateCSV(
  records: SinkRecord[],
  options?: { includePhaseData?: boolean }
): string {
  const includePhase = options?.includePhaseData ?? false;

  // Filter to non-duplicate records by default
  const outputRecords = records.filter(
    (r) => !r.rinse?.duplicate
  );

  if (outputRecords.length === 0) return '';

  // Determine which columns have at least one value
  const hasOutlet = outputRecords.some((r) => r.raw.outlet);
  const hasEmail = outputRecords.some((r) => r.raw.email);
  const hasRole = outputRecords.some((r) => r.raw.role);
  const hasPhone = outputRecords.some((r) => r.raw.phone);
  const hasWebsite = outputRecords.some((r) => r.raw.website);
  const hasNotes = outputRecords.some((r) => r.raw.notes);
  const hasTags = outputRecords.some(
    (r) => r.raw.tags && r.raw.tags.length > 0
  );

  const columns: Array<{ header: string; get: (r: SinkRecord) => string }> = [
    { header: 'name', get: (r) => r.raw.name },
  ];

  if (hasEmail) {
    columns.push({
      header: 'email',
      get: (r) => r.scrub?.email.normalised || r.raw.email || '',
    });
  }
  if (hasOutlet) columns.push({ header: 'outlet', get: (r) => r.raw.outlet ?? '' });
  if (hasRole) columns.push({ header: 'role', get: (r) => r.raw.role ?? '' });
  if (hasPhone) columns.push({ header: 'phone', get: (r) => r.raw.phone ?? '' });
  if (hasWebsite) columns.push({ header: 'website', get: (r) => r.raw.website ?? '' });
  if (hasNotes) columns.push({ header: 'notes', get: (r) => r.raw.notes ?? '' });
  if (hasTags) columns.push({ header: 'tags', get: (r) => r.raw.tags?.join(', ') ?? '' });

  // Collect all extras keys
  const extrasKeys: string[] = [];
  const seenKeys = new Set<string>();
  for (const r of outputRecords) {
    if (r.raw.extras) {
      for (const key of Object.keys(r.raw.extras)) {
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          extrasKeys.push(key);
        }
      }
    }
  }
  for (const key of extrasKeys) {
    columns.push({ header: key, get: (r) => r.raw.extras?.[key] ?? '' });
  }

  // Phase data columns
  if (includePhase) {
    columns.push({ header: 'email_valid', get: (r) => r.scrub ? String(r.scrub.email.valid) : '' });
    columns.push({ header: 'email_confidence', get: (r) => r.scrub?.email.confidence ?? '' });
    columns.push({ header: 'duplicate', get: (r) => r.rinse ? String(r.rinse.duplicate) : '' });
    columns.push({ header: 'platform_type', get: (r) => r.soak?.platformType ?? '' });
    columns.push({ header: 'genres', get: (r) => r.soak?.genres?.join('; ') ?? '' });
    columns.push({ header: 'enrichment_confidence', get: (r) => r.soak?.confidence ?? '' });
  }

  const header = columns.map((col) => col.header).join(',');
  const rows = outputRecords.map((record) =>
    columns.map((col) => escapeField(col.get(record))).join(',')
  );

  return [header, ...rows].join('\n');
}
