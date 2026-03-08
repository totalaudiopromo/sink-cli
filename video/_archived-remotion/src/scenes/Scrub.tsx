import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TerminalWindow } from '../components/TerminalWindow';
import { TerminalLine } from '../components/TerminalLine';
import { TypeWriter } from '../components/TypeWriter';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { colors, rail, gradientBg } from '../lib/theme';

export const Scrub: React.FC = () => {
  const divider = rail.dash.repeat(44);

  return (
    <AbsoluteFill style={{ background: gradientBg }}>
      <TerminalWindow>
        {/* Context */}
        <TerminalLine startFrame={0} indent={2}>
          <span style={{ color: colors.muted }}>
            Scrub validates every email -- fixes typos, flags bad addresses.
          </span>
        </TerminalLine>

        <div style={{ height: 20 }} />

        <TypeWriter text="sink scrub contacts.csv" startFrame={15} />

        <div style={{ height: 16 }} />

        <TerminalLine startFrame={40} indent={2}>
          <span style={{ color: colors.text }}>Processing </span>
          <span style={{ color: colors.text, fontWeight: 700 }}>contacts.csv</span>
          <span style={{ color: colors.text }}> through scrub</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        <TerminalLine startFrame={50} indent={2}>
          <span style={{ color: colors.cyan }}>{rail.diamond}</span>
          <span style={{ color: colors.text }}> 150 contacts parsed</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        <TerminalLine startFrame={60} indent={2}>
          <span style={{ color: colors.muted }}>{divider}</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        {/* Summary stats -- matches format.ts summary() */}
        <TerminalLine startFrame={70} indent={2}>
          <span style={{ color: colors.green }}>
            <AnimatedNumber value={100} startFrame={70} />
            {' valid'}
          </span>
          <span style={{ color: colors.muted }}>{'  \u00B7  '}</span>
          <span style={{ color: colors.red }}>
            <AnimatedNumber value={25} startFrame={70} />
            {' invalid'}
          </span>
          <span style={{ color: colors.muted }}>{'  \u00B7  '}</span>
          <span style={{ color: colors.yellow }}>
            <AnimatedNumber value={10} startFrame={70} />
            {' risky'}
          </span>
        </TerminalLine>

        <TerminalLine startFrame={80} indent={2}>
          <span style={{ color: colors.muted }}>
            5 typos fixed{'  \u00B7  '}47 unique domains
          </span>
        </TerminalLine>

        <div style={{ height: 16 }} />

        {/* Hero moment: typo corrections */}
        <TerminalLine startFrame={100} indent={2}>
          <span style={{ color: colors.red }}>john@gmial.com</span>
          <span style={{ color: colors.muted }}> {rail.arrow} </span>
          <span style={{ color: colors.green }}>john@gmail.com</span>
        </TerminalLine>

        <TerminalLine startFrame={110} indent={2}>
          <span style={{ color: colors.red }}>dave@yahoo,com</span>
          <span style={{ color: colors.muted }}> {rail.arrow} </span>
          <span style={{ color: colors.green }}>dave@yahoo.com</span>
        </TerminalLine>

        <div style={{ height: 16 }} />

        <TerminalLine startFrame={130} indent={2}>
          <span style={{ color: colors.muted }}>{rail.arrow} </span>
          <span style={{ color: colors.cyan }}>contacts-clean.csv</span>
        </TerminalLine>

        <div style={{ height: 8 }} />

        {/* Done -- lingers for ~60 frames */}
        <TerminalLine startFrame={145} indent={2}>
          <span style={{ color: colors.muted }}>Done in 2.3s</span>
        </TerminalLine>
      </TerminalWindow>
    </AbsoluteFill>
  );
};
