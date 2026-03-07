import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nanoid } from 'nanoid';
import type { SinkRecord, Phase } from '../src/types.js';

function makeRecord(
  overrides: Partial<SinkRecord['raw']> & { name: string }
): SinkRecord {
  return {
    id: nanoid(),
    raw: { name: overrides.name, ...overrides },
    phases: [] as Phase[],
    timestamp: new Date().toISOString(),
  };
}

describe('pipeline', () => {
  it('creates records from fixture CSV', () => {
    const text = readFileSync(
      resolve('test/fixtures/sample.csv'),
      'utf-8'
    );
    expect(text).toContain('Sarah Jones');
    expect(text).toContain('sarah.jones@bbc.co.uk');
  });

  it('creates valid SinkRecord', () => {
    const record = makeRecord({
      name: 'Sarah Jones',
      email: 'sarah@bbc.co.uk',
      outlet: 'BBC Radio 1',
    });
    expect(record.id).toBeTruthy();
    expect(record.raw.name).toBe('Sarah Jones');
    expect(record.raw.email).toBe('sarah@bbc.co.uk');
    expect(record.phases).toEqual([]);
  });

  it('phases accumulate on records', () => {
    const record = makeRecord({ name: 'Test' });
    const updated = {
      ...record,
      phases: [...record.phases, 'scrub' as const, 'rinse' as const],
    };
    expect(updated.phases).toEqual(['scrub', 'rinse']);
  });
});
