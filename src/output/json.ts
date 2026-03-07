import type { SinkRecord } from '../types.js';

/**
 * Generate JSON output from SinkRecords.
 */
export function generateJSON(records: SinkRecord[]): string {
  const outputRecords = records.filter((r) => !r.rinse?.duplicate);
  return JSON.stringify(outputRecords, null, 2);
}

/**
 * Generate JSONL (one JSON object per line) from SinkRecords.
 */
export function generateJSONL(records: SinkRecord[]): string {
  const outputRecords = records.filter((r) => !r.rinse?.duplicate);
  return outputRecords.map((r) => JSON.stringify(r)).join('\n');
}
