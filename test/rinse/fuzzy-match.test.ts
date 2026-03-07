import { describe, it, expect } from 'vitest';
import { jaroWinkler } from '../../src/phases/rinse/fuzzy-match.js';

describe('jaroWinkler', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });

  it('returns high similarity for similar names', () => {
    const sim = jaroWinkler('sarah jones', 'sarah j');
    expect(sim).toBeGreaterThan(0.8);
  });

  it('returns high similarity for name variations', () => {
    const sim = jaroWinkler('tom richards', 'thomas richards');
    expect(sim).toBeGreaterThan(0.78);
  });

  it('returns low similarity for different names', () => {
    const sim = jaroWinkler('sarah jones', 'tom richards');
    expect(sim).toBeLessThan(0.7);
  });

  it('handles empty strings', () => {
    expect(jaroWinkler('', 'hello')).toBe(0);
    expect(jaroWinkler('hello', '')).toBe(0);
    expect(jaroWinkler('', '')).toBe(1);
  });
});
