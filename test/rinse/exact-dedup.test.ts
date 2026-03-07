import { describe, it, expect } from 'vitest';
import { exactDedup } from '../../src/phases/rinse/exact-dedup.js';
import type { SinkRecord } from '../../src/types.js';

function makeRecord(
  overrides: Partial<SinkRecord['raw']> & { name: string },
): SinkRecord {
  return {
    id: Math.random().toString(36).slice(2),
    raw: { name: overrides.name, ...overrides },
    phases: [],
    timestamp: new Date().toISOString(),
  };
}

describe('exactDedup', () => {
  it('marks exact email duplicates', () => {
    const records = [
      makeRecord({
        name: 'Sarah Jones',
        email: 'sarah@bbc.co.uk',
        outlet: 'BBC Radio 1',
      }),
      makeRecord({ name: 'Sarah J', email: 'sarah@bbc.co.uk' }),
    ];
    const result = exactDedup(records);
    expect(result[0].rinse?.duplicate).toBe(false);
    expect(result[0].rinse?.canonical).toBe(true);
    expect(result[1].rinse?.duplicate).toBe(true);
    expect(result[1].rinse?.matchType).toBe('exact-email');
  });

  it('keeps record with more fields as canonical', () => {
    const records = [
      makeRecord({ name: 'Sarah J', email: 'sarah@bbc.co.uk' }),
      makeRecord({
        name: 'Sarah Jones',
        email: 'sarah@bbc.co.uk',
        outlet: 'BBC Radio 1',
        role: 'Producer',
      }),
    ];
    const result = exactDedup(records);
    expect(result[0].rinse?.duplicate).toBe(true);
    expect(result[1].rinse?.canonical).toBe(true);
  });

  it('preserves records without email', () => {
    const records = [makeRecord({ name: 'No Email Contact' })];
    const result = exactDedup(records);
    expect(result[0].rinse?.duplicate).toBe(false);
    expect(result[0].rinse?.canonical).toBe(true);
  });

  it('handles case-insensitive email matching', () => {
    const records = [
      makeRecord({ name: 'Sarah Jones', email: 'Sarah@BBC.co.uk' }),
      makeRecord({ name: 'Sarah J', email: 'sarah@bbc.co.uk' }),
    ];
    const result = exactDedup(records);
    expect(result[1].rinse?.duplicate).toBe(true);
  });
});
