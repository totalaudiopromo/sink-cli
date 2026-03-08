import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TerminalWindow } from '../components/TerminalWindow';
import { TerminalLine } from '../components/TerminalLine';
import { TypeWriter } from '../components/TypeWriter';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { colors, rail, gradientBg } from '../lib/theme';

export const Soak: React.FC = () => {
  const divider = rail.dash.repeat(44);

  return (
    <AbsoluteFill style={{ background: gradientBg }}>
      <TerminalWindow>
        {/* Context */}
        <TerminalLine startFrame={0} indent={2}>
          <span style={{ color: colors.muted }}>
            Soak enriches contacts with AI -- roles, genres, stations, socials.
          </span>
        </TerminalLine>

        <div style={{ height: 20 }} />

        <TypeWriter text="sink soak contacts.csv" startFrame={15} />

        <div style={{ height: 16 }} />

        <TerminalLine startFrame={35} indent={2}>
          <span style={{ color: colors.text }}>Processing </span>
          <span style={{ color: colors.text, fontWeight: 700 }}>contacts.csv</span>
          <span style={{ color: colors.text }}> through scrub </span>
          <span style={{ color: colors.muted }}>{rail.arrow}</span>
          <span style={{ color: colors.text }}> soak</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        <TerminalLine startFrame={45} indent={2}>
          <span style={{ color: colors.cyan }}>{rail.diamond}</span>
          <span style={{ color: colors.text }}> 142 contacts parsed</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        <TerminalLine startFrame={55} indent={2}>
          <span style={{ color: colors.muted }}>{divider}</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        <TerminalLine startFrame={65} indent={2}>
          <span style={{ color: colors.green }}>
            <AnimatedNumber value={100} startFrame={65} />
            {' valid'}
          </span>
          <span style={{ color: colors.muted }}>{'  \u00B7  '}</span>
          <span style={{ color: colors.red }}>
            <AnimatedNumber value={20} startFrame={65} />
            {' invalid'}
          </span>
          <span style={{ color: colors.muted }}>{'  \u00B7  '}</span>
          <span style={{ color: colors.yellow }}>
            <AnimatedNumber value={8} startFrame={65} />
            {' risky'}
          </span>
        </TerminalLine>

        <TerminalLine startFrame={75} indent={2}>
          <span style={{ color: colors.muted }}>
            3 typos fixed{'  \u00B7  '}0 dupes merged{'  \u00B7  '}98 enriched
          </span>
        </TerminalLine>

        <div style={{ height: 16 }} />

        <TerminalLine startFrame={95} indent={2}>
          <span style={{ color: colors.muted }}>{rail.arrow} </span>
          <span style={{ color: colors.cyan }}>contacts-clean.csv</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        {/* Done -- lingers for ~50 frames */}
        <TerminalLine startFrame={110} indent={2}>
          <span style={{ color: colors.muted }}>Done in 4.7s</span>
        </TerminalLine>
      </TerminalWindow>
    </AbsoluteFill>
  );
};
