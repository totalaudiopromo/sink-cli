import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { GLYPH, COLOUR, padRight, truncate, padLeft } from '../theme.js';
import { SummaryPanel } from './summary.js';
import type { SinkRecord } from '../../types.js';

export interface WaterfallEntry {
  record: SinkRecord;
}

interface ValidationWaterfallProps {
  entries: WaterfallEntry[];
  total: number;
  totalContacts: number;
  completed: number;
  elapsedMs: number;
  stats: {
    valid: number;
    invalid: number;
    risky: number;
    typos: number;
    domains: number;
  };
  terminalHeight: number;
  terminalWidth: number;
  done: boolean;
  onBrowse: () => void;
}

function ProgressBar({
  completed,
  total,
  width,
}: {
  completed: number;
  total: number;
  width: number;
}) {
  const barWidth = Math.max(width - 30, 20);
  const pct = total > 0 ? completed / total : 0;
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const pctStr = `${Math.round(pct * 100)}%`;

  return (
    <Box>
      <Text color={COLOUR.accent}>
        {' '}
        {completed < total ? <Spinner type="dots" /> : <Text>{GLYPH.check}</Text>}
      </Text>
      <Text> </Text>
      <Text color={COLOUR.accent}>{GLYPH.blockFull.repeat(filled)}</Text>
      <Text color={COLOUR.dimmed}>{GLYPH.blockLight.repeat(empty)}</Text>
      <Text> </Text>
      <Text color={COLOUR.muted}>
        {padLeft(String(completed), 5)}/{total} {padLeft(pctStr, 4)}
      </Text>
    </Box>
  );
}

function StatusIcon({ record }: { record: SinkRecord }) {
  const scrub = record.scrub;
  if (!scrub) return <Text color={COLOUR.muted}>{GLYPH.diamond}</Text>;
  if (!scrub.email.valid) return <Text color={COLOUR.invalid}>{GLYPH.cross}</Text>;
  if (scrub.email.confidence === 'medium') return <Text color={COLOUR.risky}>{GLYPH.tilde}</Text>;
  return <Text color={COLOUR.valid}>{GLYPH.check}</Text>;
}

function WaterfallRow({ entry, width }: { entry: WaterfallEntry; width: number }) {
  const { record } = entry;
  const scrub = record.scrub;
  const nameWidth = Math.min(20, Math.floor(width * 0.18));
  const emailWidth = Math.min(32, Math.floor(width * 0.3));
  const outletWidth = Math.min(20, Math.floor(width * 0.18));

  const name = padRight(truncate(record.raw.name, nameWidth), nameWidth);
  const email = scrub
    ? padRight(truncate(scrub.email.normalised, emailWidth), emailWidth)
    : padRight(truncate(record.raw.email ?? '', emailWidth), emailWidth);

  let detail: React.ReactNode;
  if (scrub?.email.corrected && scrub.email.original) {
    const domain = scrub.email.original.split('@')[1] ?? '';
    detail = (
      <>
        <Text color={COLOUR.typo}>
          {GLYPH.arrow} {truncate(domain, outletWidth - 2)}
        </Text>
        <Text color={COLOUR.muted}> typo</Text>
      </>
    );
  } else if (scrub && !scrub.email.valid && scrub.email.reason) {
    detail = <Text color={COLOUR.muted}>{scrub.email.reason.replace(/_/g, ' ')}</Text>;
  } else {
    const outlet = record.raw.outlet ?? '';
    const conf = scrub?.email.confidence ?? 'none';
    const confColour =
      conf === 'high' ? COLOUR.valid : conf === 'medium' ? COLOUR.risky : COLOUR.muted;
    detail = (
      <>
        <Text color={COLOUR.white}>{padRight(truncate(outlet, outletWidth), outletWidth)}</Text>
        <Text color={confColour}>{'  '}{conf}</Text>
      </>
    );
  }

  return (
    <Box>
      <Text> </Text>
      <StatusIcon record={record} />
      <Text> </Text>
      <Text color={COLOUR.white}>{name}</Text>
      <Text> </Text>
      <Text color={COLOUR.muted}>{email}</Text>
      <Text> </Text>
      {detail}
    </Box>
  );
}

export function ValidationWaterfall({
  entries,
  total,
  totalContacts,
  completed,
  elapsedMs,
  stats,
  terminalHeight,
  terminalWidth,
  done,
}: ValidationWaterfallProps) {
  // Reserve lines: header(2) + progress(2) + blank + footer(2) + hint(1) = 8
  const chrome = 8;
  const visibleRows = Math.max(5, terminalHeight - chrome);
  const visible = entries.slice(-visibleRows);
  const width = Math.max(60, terminalWidth);

  return (
    <Box flexDirection="column" width={width}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color={COLOUR.accent}>
          {' '}
          sink v0.1.0
        </Text>
        <Text color={COLOUR.muted}>{totalContacts} contacts</Text>
      </Box>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>

      {/* Progress bar */}
      <Text> </Text>
      <ProgressBar completed={completed} total={total} width={width} />
      <Text> </Text>

      {/* Waterfall rows */}
      {visible.map((entry, i) => {
        const globalIdx = entries.length - visible.length + i;
        return <WaterfallRow key={`row-${globalIdx}`} entry={entry} width={width} />;
      })}

      {/* Padding if fewer entries than visible space */}
      {visible.length < visibleRows && <Box height={visibleRows - visible.length} />}

      {/* Summary footer */}
      <Text> </Text>
      <SummaryPanel
        scrub={stats}
        total={total}
        completed={completed}
        elapsedMs={elapsedMs}
        width={width}
      />

      {/* Navigation hint */}
      {done && (
        <Box marginTop={1}>
          <Text color={COLOUR.accent}> Press </Text>
          <Text bold color={COLOUR.white}>
            Enter
          </Text>
          <Text color={COLOUR.accent}> to browse results</Text>
          <Text color={COLOUR.muted}> {GLYPH.dot} </Text>
          <Text color={COLOUR.muted}>q to quit</Text>
        </Box>
      )}
    </Box>
  );
}
