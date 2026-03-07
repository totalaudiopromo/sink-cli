import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { GLYPH, COLOUR, padLeft } from '../theme.js';
import type { Phase } from '../../types.js';

interface PhaseBarProps {
  phase: Phase;
  label: string;
  current: number;
  total: number;
  elapsed: number;
  active: boolean;
  done: boolean;
  width: number;
}

function PhaseBar({ label, current, total, active, done, elapsed, width }: PhaseBarProps) {
  const barWidth = Math.max(width - 40, 15);
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const pctStr = `${Math.round(pct * 100)}%`;

  return (
    <Box>
      <Text color={done ? COLOUR.valid : active ? COLOUR.accent : COLOUR.muted}>
        {' '}
        {done ? GLYPH.check : active ? '' : ' '}
        {active && !done && <Spinner type="dots" />}
      </Text>
      <Text bold color={active ? COLOUR.white : COLOUR.muted}>
        {' '}
        {label.toUpperCase().padEnd(6)}
      </Text>
      <Text color={active ? COLOUR.accent : COLOUR.muted}>{GLYPH.blockFull.repeat(filled)}</Text>
      <Text color={COLOUR.dimmed}>{GLYPH.blockLight.repeat(empty)}</Text>
      <Text color={COLOUR.muted}>
        {' '}
        {padLeft(pctStr, 4)} {current}/{total}{' '}
        {elapsed > 0 ? `${(elapsed / 1000).toFixed(1)}s` : ''}
      </Text>
    </Box>
  );
}

interface PhaseProgressProps {
  phases: {
    phase: Phase;
    label: string;
    current: number;
    total: number;
    elapsed: number;
    active: boolean;
    done: boolean;
  }[];
  width: number;
}

export function PhaseProgress({ phases, width }: PhaseProgressProps) {
  return (
    <Box flexDirection="column">
      {phases.map(p => (
        <PhaseBar key={p.phase} {...p} width={width} />
      ))}
    </Box>
  );
}
