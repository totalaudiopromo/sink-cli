/**
 * Shared TUI theme: glyphs, colours, and formatting helpers.
 */

// ── Status glyphs ───────────────────────────────────────────────────
export const GLYPH = {
  check: '\u2713',
  cross: '\u2717',
  tilde: '~',
  diamond: '\u25C7',
  bar: '\u2502',
  dot: '\u00B7',
  arrow: '\u2192',
  blockFull: '\u2588',
  blockLight: '\u2591',
} as const;

// ── Colour palette (hex) ────────────────────────────────────────────
export const COLOUR = {
  valid: '#22c55e', // green-500
  invalid: '#ef4444', // red-500
  risky: '#eab308', // yellow-500
  typo: '#f97316', // orange-500
  accent: '#06b6d4', // cyan-500
  muted: '#6b7280', // gray-500
  dimmed: '#374151', // gray-700
  white: '#f9fafb', // gray-50
  bg: '#111827', // gray-900
} as const;

// ── Formatting ──────────────────────────────────────────────────────
export function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return str + ' '.repeat(len - str.length);
}

export function padLeft(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len);
  return ' '.repeat(len - str.length) + str;
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '\u2026';
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatSpeed(count: number, ms: number): string {
  if (ms === 0) return '\u2014';
  const perSec = (count / ms) * 1000;
  return `${perSec.toFixed(1)}/s`;
}
