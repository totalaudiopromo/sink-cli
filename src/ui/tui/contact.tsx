import React from 'react';
import { Box, Text } from 'ink';
import { GLYPH, COLOUR, padRight } from '../theme.js';
import type { WaterfallEntry } from './waterfall.js';

interface ContactDetailProps {
  entry: WaterfallEntry;
  index: number;
  total: number;
  terminalWidth: number;
}

function Field({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <Box>
      <Text color={COLOUR.muted}>{padRight(label, 18)}</Text>
      <Text color={colour ?? COLOUR.white}>{value}</Text>
    </Box>
  );
}

function checkIcon(passed: boolean | undefined) {
  if (passed === undefined) return <Text color={COLOUR.muted}>-</Text>;
  if (passed) return <Text color={COLOUR.valid}>{GLYPH.check}</Text>;
  return <Text color={COLOUR.invalid}>{GLYPH.cross}</Text>;
}

function CheckRow({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean | undefined;
  detail?: string;
}) {
  const icon = checkIcon(passed);

  return (
    <Box>
      <Text> </Text>
      {icon}
      <Text> </Text>
      <Text color={COLOUR.muted}>{padRight(label, 16)}</Text>
      {detail && <Text color={COLOUR.muted}>{detail}</Text>}
    </Box>
  );
}

export function ContactDetail({ entry, index, total, terminalWidth }: ContactDetailProps) {
  const { record } = entry;
  const scrub = record.scrub;
  const width = Math.max(60, terminalWidth);

  let statusColour: string = COLOUR.valid;
  let statusLabel = 'Valid';
  if (scrub && !scrub.email.valid) {
    statusColour = COLOUR.invalid;
    statusLabel = 'Invalid';
  } else if (scrub?.email.confidence === 'medium') {
    statusColour = COLOUR.risky;
    statusLabel = 'Risky';
  }

  const checks = scrub?.email.checks;

  return (
    <Box flexDirection="column" width={width} paddingLeft={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color={COLOUR.accent}>
          {' '}
          Contact Detail
        </Text>
        <Text color={COLOUR.muted}>
          {index + 1} of {total}
        </Text>
      </Box>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
      <Text> </Text>

      {/* Contact fields */}
      <Field label="Name" value={record.raw.name} />
      <Field label="Email" value={scrub?.email.normalised ?? record.raw.email ?? ''} />
      {record.raw.outlet && <Field label="Outlet" value={record.raw.outlet} />}
      {record.raw.role && <Field label="Role" value={record.raw.role} />}
      {record.raw.phone && <Field label="Phone" value={record.raw.phone} />}
      {record.raw.website && <Field label="Website" value={record.raw.website} />}
      {record.raw.notes && <Field label="Notes" value={record.raw.notes} />}
      {record.raw.tags && record.raw.tags.length > 0 && (
        <Field label="Tags" value={record.raw.tags.join(', ')} />
      )}

      <Text> </Text>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
      <Text> </Text>

      {/* Validation status */}
      {scrub && (
        <>
          <Field label="Status" value={statusLabel} colour={statusColour} />
          <Field label="Confidence" value={scrub.email.confidence} colour={statusColour} />
          {scrub.email.reason && (
            <Field
              label="Reason"
              value={scrub.email.reason.replace(/_/g, ' ')}
              colour={COLOUR.invalid}
            />
          )}
          {scrub.email.roleBased && (
            <Field label="Role-based" value="yes" colour={COLOUR.risky} />
          )}
          {scrub.email.catchAll && <Field label="Catch-all" value="yes" colour={COLOUR.risky} />}
          {scrub.email.disposable && (
            <Field label="Disposable" value="yes" colour={COLOUR.invalid} />
          )}

          {/* Typo correction */}
          {scrub.email.corrected && (
            <>
              <Text> </Text>
              <Box>
                <Text color={COLOUR.muted}>{padRight('Correction', 18)}</Text>
                <Text color={COLOUR.typo}>{scrub.email.original}</Text>
                <Text color={COLOUR.muted}> {GLYPH.arrow} </Text>
                <Text color={COLOUR.valid}>{scrub.email.suggested}</Text>
              </Box>
            </>
          )}

          {/* Validation checks */}
          {checks && (
            <>
              <Text> </Text>
              <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
              <Text> </Text>
              <Text bold color={COLOUR.muted}>
                {' '}
                Validation Checks
              </Text>
              <Text> </Text>
              <CheckRow label="Regex format" passed={checks.regex} />
              <CheckRow label="Typo check" passed={checks.typo} />
              <CheckRow
                label="Disposable"
                passed={checks.disposable}
                detail={checks.disposable ? 'not disposable' : 'disposable domain'}
              />
              <CheckRow label="MX record" passed={checks.mx} />
              {checks.smtp !== undefined && <CheckRow label="SMTP verify" passed={checks.smtp} />}
            </>
          )}
        </>
      )}

      {/* Soak enrichment data */}
      {record.soak && (
        <>
          <Text> </Text>
          <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
          <Text> </Text>
          <Text bold color={COLOUR.muted}>
            {' '}
            Enrichment
          </Text>
          <Text> </Text>
          {record.soak.platform && <Field label="Platform" value={record.soak.platform} />}
          {record.soak.platformType && (
            <Field label="Type" value={record.soak.platformType} />
          )}
          {record.soak.genres && record.soak.genres.length > 0 && (
            <Field label="Genres" value={record.soak.genres.join(', ')} />
          )}
          {record.soak.coverageArea && (
            <Field label="Coverage" value={record.soak.coverageArea} />
          )}
          {record.soak.geographicScope && (
            <Field label="Scope" value={record.soak.geographicScope} />
          )}
          <Field label="Confidence" value={record.soak.confidence} />
        </>
      )}

      {/* Navigation */}
      <Text> </Text>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
      <Box marginTop={1}>
        <Text color={COLOUR.muted}> [Esc] back [left/right] prev/next [q] quit</Text>
      </Box>
    </Box>
  );
}
