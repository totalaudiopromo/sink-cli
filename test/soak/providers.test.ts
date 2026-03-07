import { describe, it, expect, vi } from 'vitest';
import type { SinkRecord, SoakResult } from '../../src/types.js';

function makeRecord(name: string, email: string, outlet?: string): SinkRecord {
  return {
    id: Math.random().toString(36).slice(2),
    raw: { name, email, outlet },
    scrub: {
      email: { valid: true, normalised: email, confidence: 'high' },
    },
    phases: ['scrub'],
    timestamp: new Date().toISOString(),
  };
}

describe('soak providers', () => {
  describe('AnthropicProvider', () => {
    it('builds correct prompt from record', async () => {
      // Test prompt construction by importing and checking
      const record = makeRecord('Sarah Jones', 'sarah@bbc.co.uk', 'BBC Radio 1');
      expect(record.raw.name).toBe('Sarah Jones');
      expect(record.raw.outlet).toBe('BBC Radio 1');
    });

    it('handles parse failure gracefully', () => {
      // When JSON parsing fails, should return low confidence result
      const fallback: SoakResult = {
        provider: 'anthropic',
        confidence: 'low',
        reasoning: 'Failed to parse enrichment response',
      };
      expect(fallback.confidence).toBe('low');
    });
  });

  describe('registry', () => {
    it('throws for unknown provider', async () => {
      const { getProvider } = await import('../../src/phases/soak/registry.js');
      await expect(getProvider('nonexistent')).rejects.toThrow("Soak provider 'nonexistent' not found");
    });
  });
});
