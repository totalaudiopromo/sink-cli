import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline } from '../src/pipeline.js';
import { loadConfig } from '../src/config.js';
import { parseCSV } from '../src/phases/scrub/parse.js';
import { nanoid } from 'nanoid';
import type { SinkRecord } from '../src/types.js';

function csvToRecords(csv: string): SinkRecord[] {
  const { contacts } = parseCSV(csv);
  return contacts.map((raw) => ({
    id: nanoid(),
    raw,
    phases: [],
    timestamp: new Date().toISOString(),
  }));
}

describe('pipeline e2e', () => {
  it('runs scrub + rinse on sample CSV', async () => {
    const csv = readFileSync(resolve('test/fixtures/sample.csv'), 'utf-8');
    const records = csvToRecords(csv);
    const config = await loadConfig();

    const { records: result, stats } = await runPipeline(records, {
      phases: ['scrub', 'rinse'],
      config,
    });

    expect(result.length).toBe(records.length);
    expect(stats.total).toBe(records.length);

    // All records should have scrub and rinse phases
    for (const r of result) {
      expect(r.phases).toContain('scrub');
      expect(r.phases).toContain('rinse');
    }

    // Should have some valid and some invalid emails
    expect(stats.scrub.valid).toBeGreaterThan(0);
    expect(stats.scrub.invalid).toBeGreaterThan(0);

    // Typo domain (gmial.com) should be corrected
    const typoRecord = result.find((r) => r.raw.email === 'user@gmial.com');
    expect(typoRecord?.scrub?.email.corrected).toBe(true);
    expect(typoRecord?.scrub?.email.normalised).toBe('user@gmail.com');

    // Duration should be captured
    expect(stats.duration).toBeGreaterThan(0);
  });

  it('runs scrub + rinse on duplicates fixture', async () => {
    const csv = readFileSync(resolve('test/fixtures/duplicates.csv'), 'utf-8');
    const records = csvToRecords(csv);
    const config = await loadConfig();

    const { records: result, stats } = await runPipeline(records, {
      phases: ['scrub', 'rinse'],
      config,
    });

    // Should detect at least one duplicate
    expect(stats.rinse.duplicates).toBeGreaterThan(0);

    // Duplicate records should be marked
    const dupes = result.filter((r) => r.rinse?.duplicate);
    expect(dupes.length).toBeGreaterThan(0);
  });

  it('skips soak when no API key is set', async () => {
    const csv = readFileSync(resolve('test/fixtures/enrichable.csv'), 'utf-8');
    const records = csvToRecords(csv);
    const config = await loadConfig();

    // Ensure no API key
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const { records: result } = await runPipeline(records, {
        phases: ['scrub', 'soak'],
        config,
      });

      // Soak should be skipped gracefully -- records still have scrub
      for (const r of result) {
        expect(r.phases).toContain('scrub');
      }
    } finally {
      if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
    }
  });

  it('preserves record IDs through pipeline', async () => {
    const csv = readFileSync(resolve('test/fixtures/sample.csv'), 'utf-8');
    const records = csvToRecords(csv);
    const originalIds = records.map((r) => r.id);
    const config = await loadConfig();

    const { records: result } = await runPipeline(records, {
      phases: ['scrub', 'rinse'],
      config,
    });

    const resultIds = result.map((r) => r.id);
    expect(resultIds).toEqual(originalIds);
  });

  it('computes correct stats shape', async () => {
    const csv = readFileSync(resolve('test/fixtures/sample.csv'), 'utf-8');
    const records = csvToRecords(csv);
    const config = await loadConfig();

    const { stats } = await runPipeline(records, {
      phases: ['scrub'],
      config,
    });

    expect(stats).toMatchObject({
      total: expect.any(Number),
      scrub: {
        valid: expect.any(Number),
        invalid: expect.any(Number),
        risky: expect.any(Number),
        typos: expect.any(Number),
        domains: expect.any(Number),
      },
      rinse: {
        duplicates: expect.any(Number),
        merged: expect.any(Number),
        fuzzyMatches: expect.any(Number),
      },
      soak: {
        enriched: expect.any(Number),
        failed: expect.any(Number),
        skipped: expect.any(Number),
      },
      duration: expect.any(Number),
    });
  });
});
