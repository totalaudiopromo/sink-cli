import React from 'react';
import { Box, Text } from 'ink';
import { GLYPH, COLOUR, padRight, truncate } from '../theme.js';
import type { SinkRecord } from '../../types.js';

interface EnrichmentViewProps {
  records: SinkRecord[];
  terminalHeight: number;
  terminalWidth: number;
}

export function EnrichmentView({ records, terminalHeight, terminalWidth }: EnrichmentViewProps) {
  const width = Math.max(60, terminalWidth);
  const enriched = records.filter(r => r.soak);
  const visibleRows = Math.max(5, terminalHeight - 6);
  const visible = enriched.slice(-visibleRows);

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between">
        <Text bold color={COLOUR.accent}>
          {' '}
          Enrichment Results
        </Text>
        <Text color={COLOUR.muted}>{enriched.length} enriched</Text>
      </Box>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
      {visible.map(record => {
        const soak = record.soak!;
        const nameW = Math.min(20, Math.floor(width * 0.2));
        return (
          <Box key={record.id}>
            <Text color={COLOUR.valid}>
              {' '}
              {GLYPH.check}{' '}
            </Text>
            <Text color={COLOUR.white}>{padRight(truncate(record.raw.name, nameW), nameW)}</Text>
            <Text> </Text>
            <Text color={COLOUR.accent}>{soak.platformType ?? 'unknown'}</Text>
            <Text color={COLOUR.muted}> {GLYPH.dot} </Text>
            <Text color={COLOUR.muted}>{soak.genres?.join(', ') ?? ''}</Text>
            <Text color={COLOUR.muted}> {GLYPH.dot} </Text>
            <Text
              color={
                soak.confidence === 'high'
                  ? COLOUR.valid
                  : soak.confidence === 'medium'
                    ? COLOUR.risky
                    : COLOUR.muted
              }
            >
              {soak.confidence}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
