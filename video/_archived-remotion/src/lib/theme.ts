export const colors = {
  bg: '#111827',
  surface: '#1f2937',
  border: '#374151',
  cyan: '#06b6d4',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  text: '#f9fafb',
  muted: '#6b7280',
} as const;

export const glyphs = {
  valid: '\u2713',      // checkmark
  invalid: '\u2717',    // cross
  risky: '\u26A0',      // warning
  duplicate: '\u2261',  // triple bar
  sparkle: '\u25C6',    // diamond
  bullet: '\u2022',     // bullet
  block: '\u2588',      // full block
  lightBlock: '\u2591', // light shade
  cursor: '\u2588',     // block cursor
  prompt: '$',
} as const;

export const asciiLogo = [
  '     ___ (_)__  / /__',
  "    (_-</ / _ \\/  '_/",
  '   /___/_/_//_/_/\\_\\',
];

export const rail = {
  pipe: '\u2502',      // │
  top: '\u256D',       // ╭
  bottom: '\u2570',    // ╰
  tee: '\u251C',       // ├
  dash: '\u2500',      // ─
  diamond: '\u25C7',   // ◇
  arrow: '\u2192',     // →
} as const;

/** Cyan-to-off-white gradient for behind terminal windows */
export const gradientBg = 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 30%, #a5f3fc 60%, #ecfeff 85%, #f8fafc 100%)';

export const springPresets = {
  snappy: { damping: 20, stiffness: 200, mass: 0.6 },
  smooth: { damping: 26, stiffness: 160, mass: 0.7 },
  gentle: { damping: 30, stiffness: 120, mass: 0.8 },
  bouncy: { damping: 12, stiffness: 180, mass: 0.5 },
} as const;
