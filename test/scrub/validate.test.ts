import { describe, it, expect, vi } from 'vitest';
import { MxCache } from '../../src/utils/mx-cache.js';

// Mock deep-email-validator to avoid real DNS/SMTP calls in tests
vi.mock('deep-email-validator', () => ({
  validate: vi.fn(async ({ email }: { email: string }) => {
    const domain = email.split('@')[1];
    const isDisposable = domain === 'tempmail.com';
    const hasMx = domain !== 'nxdomain.invalid';

    return {
      valid: hasMx && !isDisposable,
      validators: {
        regex: { valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) },
        typo: { valid: true },
        disposable: { valid: !isDisposable },
        mx: { valid: hasMx },
        smtp: { valid: true },
      },
    };
  }),
}));

// Import after mock is set up
const { validateEmail, validateEmailBatch } = await import(
  '../../src/phases/scrub/validate.js'
);

function makeMxCache(): MxCache {
  return new MxCache(1800);
}

describe('validateEmail', () => {
  it('validates a well-formed email', async () => {
    const result = await validateEmail('alice@gmail.com', { mxCache: makeMxCache() });

    expect(result.valid).toBe(true);
    expect(result.normalised).toBe('alice@gmail.com');
    // gmail.com is catch-all so confidence is medium
    expect(result.confidence).toBe('medium');
  });

  it('rejects an email without @', async () => {
    const result = await validateEmail('notanemail', { mxCache: makeMxCache() });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_format');
    expect(result.confidence).toBe('none');
  });

  it('rejects an email with invalid format', async () => {
    const result = await validateEmail('bad@@two.com', { mxCache: makeMxCache() });

    expect(result.valid).toBe(false);
  });

  it('corrects gmial.com typo', async () => {
    const result = await validateEmail('alice@gmial.com', { mxCache: makeMxCache() });

    expect(result.corrected).toBe(true);
    expect(result.original).toBe('alice@gmial.com');
    expect(result.suggested).toBe('alice@gmail.com');
    expect(result.normalised).toBe('alice@gmail.com');
  });

  it('detects role-based email prefixes', async () => {
    const result = await validateEmail('press@example.com', { mxCache: makeMxCache() });

    expect(result.valid).toBe(true);
    expect(result.roleBased).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('detects disposable domains', async () => {
    const result = await validateEmail('test@tempmail.com', { mxCache: makeMxCache() });

    expect(result.valid).toBe(false);
    expect(result.disposable).toBe(true);
    expect(result.reason).toBe('disposable_domain');
  });

  it('normalises email to lowercase', async () => {
    const result = await validateEmail('Alice@Gmail.COM', { mxCache: makeMxCache() });

    expect(result.normalised).toBe('alice@gmail.com');
  });

  it('accepts custom role prefixes', async () => {
    const result = await validateEmail('custom@example.com', {
      mxCache: makeMxCache(),
      rolePrefixes: ['custom'],
    });

    expect(result.roleBased).toBe(true);
  });

  it('rejects placeholder domain', async () => {
    const result = await validateEmail('test@placeholder.tap', { mxCache: makeMxCache() });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('placeholder');
  });
});

describe('validateEmailBatch', () => {
  it('validates a batch of emails', async () => {
    const emails = ['alice@gmail.com', 'bob@example.com', 'notanemail'];
    const results = await validateEmailBatch(emails);

    expect(results.size).toBe(3);
    expect(results.get('alice@gmail.com')?.valid).toBe(true);
    expect(results.get('notanemail')?.valid).toBe(false);
  });

  it('calls onProgress for each email', async () => {
    const emails = ['alice@gmail.com', 'bob@example.com'];
    const progress: number[] = [];

    await validateEmailBatch(emails, {
      onProgress: (_email, _result, index) => {
        progress.push(index);
      },
    });

    expect(progress).toEqual([1, 2]);
  });
});
