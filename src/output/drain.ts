import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { nanoid } from 'nanoid';
import type { SinkRecord, Phase } from '../types.js';
import { parseCSV } from '../phases/scrub/parse.js';
import { generateCSV } from './csv.js';
import { generateJSON, generateJSONL } from './json.js';

type Format = 'csv' | 'json' | 'jsonl';

function detectFormat(filePath: string): Format {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';
  return 'csv';
}

function parseInput(filePath: string): SinkRecord[] {
  const text = readFileSync(resolve(filePath), 'utf-8');
  const format = detectFormat(filePath);

  if (format === 'json') {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      // Check if it's already SinkRecord[]
      if (data[0]?.id && data[0]?.raw) return data as SinkRecord[];
      // Assume RawRecord-like objects
      return data.map((raw) => ({
        id: nanoid(),
        raw: { name: raw.name ?? '', ...raw },
        phases: [] as Phase[],
        timestamp: new Date().toISOString(),
      }));
    }
    throw new Error('JSON input must be an array');
  }

  if (format === 'jsonl') {
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const data = JSON.parse(line);
        if (data.id && data.raw) return data as SinkRecord;
        return {
          id: nanoid(),
          raw: { name: data.name ?? '', ...data },
          phases: [] as Phase[],
          timestamp: new Date().toISOString(),
        };
      });
  }

  // CSV
  const { contacts } = parseCSV(text);
  return contacts.map((raw) => ({
    id: nanoid(),
    raw,
    phases: [] as Phase[],
    timestamp: new Date().toISOString(),
  }));
}

function formatOutput(records: SinkRecord[], format: Format): string {
  switch (format) {
    case 'csv':
      return generateCSV(records);
    case 'json':
      return generateJSON(records);
    case 'jsonl':
      return generateJSONL(records);
  }
}

/**
 * Convert a file between formats.
 */
export function drain(
  inputPath: string,
  outputPath: string,
  targetFormat?: Format
): { records: number; format: Format } {
  const records = parseInput(inputPath);
  const format = targetFormat ?? detectFormat(outputPath);
  const output = formatOutput(records, format);
  writeFileSync(resolve(outputPath), output, 'utf-8');
  return { records: records.length, format };
}

export { parseInput, formatOutput, detectFormat };
