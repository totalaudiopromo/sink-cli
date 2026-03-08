import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TerminalWindow } from '../components/TerminalWindow';
import { TerminalLine } from '../components/TerminalLine';
import { TypeWriter } from '../components/TypeWriter';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { colors, glyphs, rail, gradientBg } from '../lib/theme';

export const Result: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: gradientBg }}>
      <TerminalWindow>
        {/* Context */}
        <TerminalLine startFrame={0} indent={2}>
          <span style={{ color: colors.muted }}>
            Inspect shows you exactly what you've got.
          </span>
        </TerminalLine>

        <div style={{ height: 20 }} />

        <TypeWriter text="sink inspect contacts.csv" startFrame={15} />

        <div style={{ height: 16 }} />

        <TerminalLine startFrame={35} indent={2}>
          <span style={{ color: colors.cyan }}>{rail.diamond}</span>
          <span style={{ color: colors.text }}> 150 contacts loaded</span>
        </TerminalLine>

        <div style={{ height: 12 }} />

        <TerminalLine startFrame={45} indent={2}>
          <span style={{ color: colors.text }}>150 contacts, 135 with email</span>
        </TerminalLine>

        <div style={{ height: 16 }} />

        {/* Quality score -- hero moment */}
        <TerminalLine startFrame={60} indent={2}>
          <span style={{ color: colors.text }}>Quality score: </span>
          <span style={{ color: colors.green }}>
            <AnimatedNumber value={85} startFrame={60} duration={25} />
            {'%'}
          </span>
        </TerminalLine>

        <div style={{ height: 16 }} />

        {/* Validation table -- matches format.ts validationRow() exactly:
            icon label.padEnd(18) count.padStart(6) unit */}
        <TerminalLine startFrame={80} indent={2}>
          <span style={{ color: colors.green }}>{glyphs.valid}</span>
          <span style={{ color: colors.text }}>{' '}{'Valid'.padEnd(18)}</span>
          <span style={{ color: colors.muted }}>{'100'.padStart(6)}</span>
        </TerminalLine>

        <TerminalLine startFrame={88} indent={2}>
          <span style={{ color: colors.yellow }}>{'~'}</span>
          <span style={{ color: colors.text }}>{' '}{'Risky'.padEnd(18)}</span>
          <span style={{ color: colors.muted }}>{'10'.padStart(6)}</span>
          <span style={{ color: colors.muted }}> role/catch-all</span>
        </TerminalLine>

        <TerminalLine startFrame={96} indent={2}>
          <span style={{ color: colors.red }}>{glyphs.invalid}</span>
          <span style={{ color: colors.text }}>{' '}{'Invalid'.padEnd(18)}</span>
          <span style={{ color: colors.muted }}>{'25'.padStart(6)}</span>
        </TerminalLine>

        <TerminalLine startFrame={104} indent={2}>
          <span style={{ color: colors.yellow }}>{'~'}</span>
          <span style={{ color: colors.text }}>{' '}{'Typos fixed'.padEnd(18)}</span>
          <span style={{ color: colors.muted }}>{'5'.padStart(6)}</span>
        </TerminalLine>

        <TerminalLine startFrame={112} indent={2}>
          <span style={{ color: colors.green }}>{glyphs.valid}</span>
          <span style={{ color: colors.text }}>{' '}{'Domains'.padEnd(18)}</span>
          <span style={{ color: colors.muted }}>{'47'.padStart(6)}</span>
          <span style={{ color: colors.muted }}> unique</span>
        </TerminalLine>

        <div style={{ height: 16 }} />

        {/* Done -- lingers for ~60 frames */}
        <TerminalLine startFrame={130} indent={2}>
          <span style={{ color: colors.muted }}>Done in 0.0s</span>
        </TerminalLine>
      </TerminalWindow>
    </AbsoluteFill>
  );
};
