import React from 'react';
import { Box, Text } from 'ink';
import { GLYPH, COLOUR, formatElapsed, formatSpeed } from '../theme.js';

interface SummaryProps {
  scrub?: { valid: number; invalid: number; risky: number; typos: number; domains: number };
  rinse?: { duplicates: number; merged: number; fuzzyMatches: number };
  soak?: { enriched: number; failed: number; skipped: number };
  total: number;
  completed: number;
  elapsedMs: number;
  width: number;
}

export function SummaryPanel({
  scrub,
  rinse,
  soak,
  total,
  completed,
  elapsedMs,
  width,
}: SummaryProps) {
  const elapsed = formatElapsed(elapsedMs);
  const speed = formatSpeed(completed, elapsedMs);
  const sep = ` ${GLYPH.dot} `;

  return (
    <Box flexDirection="column" width={width}>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
      <Box>
        {scrub && (
          <>
            <Text color={COLOUR.valid}> {scrub.valid} valid</Text>
            <Text color={COLOUR.muted}>{sep}</Text>
            <Text color={COLOUR.invalid}>{scrub.invalid} invalid</Text>
            <Text color={COLOUR.muted}>{sep}</Text>
            <Text color={COLOUR.risky}>{scrub.risky} risky</Text>
          </>
        )}
        {rinse && (
          <>
            <Text color={COLOUR.muted}>{sep}</Text>
            <Text color={COLOUR.typo}>{rinse.duplicates} dupes</Text>
          </>
        )}
        {soak && (
          <>
            <Text color={COLOUR.muted}>{sep}</Text>
            <Text color={COLOUR.accent}>{soak.enriched} enriched</Text>
          </>
        )}
        <Text color={COLOUR.muted}>
          {sep}
          {elapsed}
        </Text>
        {completed < total && (
          <>
            <Text color={COLOUR.muted}>{sep}</Text>
            <Text color={COLOUR.accent}>{speed}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
