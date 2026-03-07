import React from 'react';
import { Box, Text } from 'ink';
import { GLYPH, COLOUR, padRight, truncate, padLeft } from '../theme.js';
import { SummaryPanel } from './summary.js';
import type { WaterfallEntry } from './waterfall.js';

interface ResultsBrowserProps {
  entries: WaterfallEntry[];
  allEntries: WaterfallEntry[];
  selectedIndex: number;
  filter: 'all' | 'valid' | 'invalid' | 'risky';
  stats: {
    valid: number;
    invalid: number;
    risky: number;
    typos: number;
    domains: number;
  };
  total: number;
  completed: number;
  elapsedMs: number;
  terminalHeight: number;
  terminalWidth: number;
  savedPath: string | null;
}

function FilterTab({
  label,
  count,
  active,
  hotkey,
}: {
  label: string;
  count: number;
  active: boolean;
  hotkey: string;
}) {
  return (
    <Box>
      <Text color={active ? COLOUR.accent : COLOUR.muted} bold={active}>
        [{hotkey}] {label}: {count}
      </Text>
      <Text> </Text>
    </Box>
  );
}

function StatusIcon({ valid, confidence }: { valid: boolean; confidence: string }) {
  if (!valid) return <Text color={COLOUR.invalid}>{GLYPH.cross}</Text>;
  if (confidence === 'medium') return <Text color={COLOUR.risky}>{GLYPH.tilde}</Text>;
  return <Text color={COLOUR.valid}>{GLYPH.check}</Text>;
}

export function ResultsBrowser({
  entries,
  allEntries,
  selectedIndex,
  filter,
  stats,
  total,
  completed,
  elapsedMs,
  terminalHeight,
  terminalWidth,
  savedPath,
}: ResultsBrowserProps) {
  const width = Math.max(60, terminalWidth);
  // Reserve: header(3) + column header(1) + footer(3) + hints(2) = 9
  const chrome = 9;
  const visibleRows = Math.max(5, terminalHeight - chrome);

  // Scroll window around selection
  let scrollStart = 0;
  if (entries.length > visibleRows) {
    scrollStart = Math.max(
      0,
      Math.min(selectedIndex - Math.floor(visibleRows / 2), entries.length - visibleRows),
    );
  }
  const visible = entries.slice(scrollStart, scrollStart + visibleRows);

  const nameW = Math.min(22, Math.floor(width * 0.2));
  const emailW = Math.min(30, Math.floor(width * 0.28));
  const outletW = Math.min(22, Math.floor(width * 0.2));

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color={COLOUR.accent}>
          {' '}
          Results
        </Text>
        <Text color={COLOUR.muted}>{entries.length} shown</Text>
      </Box>

      {/* Filter tabs */}
      <Box>
        <Text> </Text>
        <FilterTab label="all" count={allEntries.length} active={filter === 'all'} hotkey="a" />
        <FilterTab label="valid" count={stats.valid} active={filter === 'valid'} hotkey="v" />
        <FilterTab
          label="invalid"
          count={stats.invalid}
          active={filter === 'invalid'}
          hotkey="i"
        />
        <FilterTab label="risky" count={stats.risky} active={filter === 'risky'} hotkey="r" />
      </Box>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>

      {/* Column headers */}
      <Box>
        <Text color={COLOUR.muted}>
          {'  '}
          {padRight('#', 5)}
          {'  '}
          {padRight('Name', nameW)}
          {'  '}
          {padRight('Email', emailW)}
          {'  '}
          {padRight('Outlet', outletW)}
        </Text>
      </Box>

      {/* Rows */}
      {visible.map((entry, visIdx) => {
        const actualIdx = scrollStart + visIdx;
        const isSelected = actualIdx === selectedIndex;
        const { record } = entry;
        const scrub = record.scrub;
        const email = scrub?.email.normalised ?? record.raw.email ?? '';
        const valid = scrub?.email.valid ?? false;
        const confidence = scrub?.email.confidence ?? 'none';

        return (
          <Box key={`${record.id}-${actualIdx}`}>
            <Text color={isSelected ? COLOUR.accent : COLOUR.muted}>
              {isSelected ? '>' : ' '}
            </Text>
            <Text color={COLOUR.muted}>{padLeft(String(actualIdx + 1), 4)} </Text>
            <StatusIcon valid={valid} confidence={confidence} />
            <Text> </Text>
            <Text color={isSelected ? COLOUR.white : COLOUR.muted}>
              {padRight(truncate(record.raw.name, nameW), nameW)}
            </Text>
            <Text> </Text>
            <Text color={COLOUR.muted}>{padRight(truncate(email, emailW), emailW)}</Text>
            <Text> </Text>
            <Text color={COLOUR.muted}>
              {padRight(truncate(record.raw.outlet ?? '', outletW), outletW)}
            </Text>
          </Box>
        );
      })}

      {/* Padding for short lists */}
      {visible.length < visibleRows && <Box height={visibleRows - visible.length} />}

      {/* Footer */}
      <Text> </Text>
      <SummaryPanel
        scrub={stats}
        total={total}
        completed={completed}
        elapsedMs={elapsedMs}
        width={width}
      />

      {/* Save confirmation */}
      {savedPath && (
        <Box>
          <Text color={COLOUR.valid}>
            {' '}
            {GLYPH.check} Saved to {savedPath}
          </Text>
        </Box>
      )}

      {/* Key hints */}
      <Box marginTop={1}>
        <Text color={COLOUR.muted}>
          {' '}
          [up/down] navigate [Enter] details [a/v/i/r] filter [s] save [Esc] back [q] quit
        </Text>
      </Box>
    </Box>
  );
}
