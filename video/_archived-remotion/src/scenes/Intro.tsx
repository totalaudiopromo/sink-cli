import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { monoFont } from '../Root';
import { TerminalWindow } from '../components/TerminalWindow';
import { TerminalLine } from '../components/TerminalLine';
import { TypeWriter } from '../components/TypeWriter';
import { colors, asciiLogo, gradientBg } from '../lib/theme';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Version fades in after second logo line finishes typing
  const versionOpacity = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: { damping: 30, stiffness: 120, mass: 0.8 },
  });

  return (
    <AbsoluteFill style={{ background: gradientBg }}>
      <TerminalWindow>
        {/* ASCII logo -- typed in line by line */}
        <TypeWriter
          text={asciiLogo[0]}
          prefix=""
          color={colors.cyan}
          startFrame={20}
          speed={1}
          showCursor={false}
        />
        {/* Second line + version on same line (matches real CLI: format.ts:30) */}
        <div style={{ fontFamily: monoFont, fontSize: 24, whiteSpace: 'pre' }}>
          <TypeWriter
            text={asciiLogo[1]}
            prefix=""
            color={colors.cyan}
            startFrame={35}
            speed={1}
            showCursor={false}
          />
          <span style={{ color: colors.muted, opacity: versionOpacity }}>
            {'   v0.1.0'}
          </span>
        </div>
        <TypeWriter
          text={asciiLogo[2]}
          prefix=""
          color={colors.cyan}
          startFrame={50}
          speed={1}
          showCursor={false}
        />

        {/* Blank line */}
        <div style={{ height: 28 }} />

        {/* Tagline -- monospace, bold */}
        <TerminalLine startFrame={80} indent={2}>
          <span style={{ color: colors.text, fontWeight: 700 }}>
            Data hygiene for music PR.
          </span>
        </TerminalLine>

        {/* Subtitle */}
        <TerminalLine startFrame={100} indent={2}>
          <span style={{ color: colors.muted }}>
            Clean, dedupe, and enrich your contact lists from the terminal.
          </span>
        </TerminalLine>

        {/* Phases */}
        <div style={{ height: 20 }} />
        <TerminalLine startFrame={125} indent={2}>
          <span style={{ color: colors.cyan }}>Scrub</span>
          <span style={{ color: colors.muted }}> {'·'} </span>
          <span style={{ color: colors.green }}>Rinse</span>
          <span style={{ color: colors.muted }}> {'·'} </span>
          <span style={{ color: colors.yellow }}>Soak</span>
        </TerminalLine>
      </TerminalWindow>
    </AbsoluteFill>
  );
};
