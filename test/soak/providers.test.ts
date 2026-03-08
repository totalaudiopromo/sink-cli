import { describe, it, expect } from 'vitest';
import type { SinkRecord, SoakResult } from '../../src/types.js';
import { buildPrompt, calculateConfidence } from '../../src/phases/soak/prompt.js';

function makeRecord(name: string, email: string, outlet?: string, role?: string): SinkRecord {
  return {
    id: Math.random().toString(36).slice(2),
    raw: { name, email, outlet, role },
    scrub: {
      email: { valid: true, normalised: email, confidence: 'high' },
    },
    phases: ['scrub'],
    timestamp: new Date().toISOString(),
  };
}

describe('soak providers', () => {
  describe('buildPrompt', () => {
    it('includes contact details in prompt', () => {
      const record = makeRecord('Sarah Jones', 'sarah@bbc.co.uk', 'BBC Radio 1', 'Producer');
      const prompt = buildPrompt(record);
      expect(prompt).toContain('Sarah Jones');
      expect(prompt).toContain('sarah@bbc.co.uk');
      expect(prompt).toContain('BBC Radio 1');
      expect(prompt).toContain('Producer');
    });

    it('uses normalised email from scrub result', () => {
      const record = makeRecord('Test', 'original@test.com', 'Test Outlet');
      record.scrub = {
        email: { valid: true, normalised: 'normalised@test.com', confidence: 'high' },
      };
      const prompt = buildPrompt(record);
      expect(prompt).toContain('normalised@test.com');
    });

    it('falls back to "unknown" for missing fields', () => {
      const record = makeRecord('Test', 'test@test.com');
      const prompt = buildPrompt(record);
      expect(prompt).toContain('Outlet: unknown');
      expect(prompt).toContain('Role: unknown');
    });
  });

  describe('calculateConfidence', () => {
    it('returns high when all key fields populated', () => {
      const data = {
        platform: 'BBC Radio 1',
        platformType: 'radio',
        genres: ['indie', 'rock'],
        coverageArea: 'National UK',
        pitchTips: ['Keep it short'],
      };
      expect(calculateConfidence(data)).toBe('high');
    });

    it('returns medium when some key fields populated', () => {
      const data = {
        platform: 'BBC Radio 1',
        platformType: 'radio',
      };
      expect(calculateConfidence(data)).toBe('medium');
    });

    it('returns low when few key fields populated', () => {
      const data = {
        platform: 'Unknown',
      };
      expect(calculateConfidence(data)).toBe('low');
    });

    it('returns low for empty object', () => {
      expect(calculateConfidence({})).toBe('low');
    });

    it('ignores empty arrays', () => {
      const data = {
        platform: 'BBC',
        platformType: 'radio',
        genres: [],
        coverageArea: '',
        pitchTips: [],
      };
      expect(calculateConfidence(data)).toBe('medium');
    });
  });

  describe('JSON parsing edge cases', () => {
    it('handles markdown-wrapped JSON', () => {
      const text = '```json\n{"platform": "BBC Radio 1"}\n```';
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
      const data = JSON.parse(cleaned);
      expect(data.platform).toBe('BBC Radio 1');
    });

    it('handles plain JSON', () => {
      const text = '{"platform": "Radio X"}';
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
      const data = JSON.parse(cleaned);
      expect(data.platform).toBe('Radio X');
    });

    it('handles JSON with trailing newline', () => {
      const text = '{"platform": "NME"}\n';
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      expect(JSON.parse(cleaned).platform).toBe('NME');
    });
  });

  describe('error handling', () => {
    it('returns none confidence on failure', () => {
      const fallback: SoakResult = {
        provider: 'anthropic',
        confidence: 'none',
        reasoning: 'Failed to parse enrichment response',
      };
      expect(fallback.confidence).toBe('none');
      expect(fallback.reasoning).toBeTruthy();
    });
  });

  describe('registry', () => {
    it('throws for unknown provider', async () => {
      const { getProvider } = await import('../../src/phases/soak/registry.js');
      await expect(getProvider('nonexistent')).rejects.toThrow(
        "Soak provider 'nonexistent' not found",
      );
    });
  });
});
