import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { TerminalWindow } from '../components/TerminalWindow';
import { TerminalLine } from '../components/TerminalLine';
import { TypeWriter } from '../components/TypeWriter';
import { colors, asciiLogo, gradientBg } from '../lib/theme';
import { monoFont } from '../Root';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo appears instantly at f5
  const logoVisible = frame >= 5;

  // Fade to black over last 30 frames
  const fadeOut = interpolate(frame, [170, 200], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: gradientBg }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <TerminalWindow>
          {/* ASCII logo -- instant, no typewriter */}
          {logoVisible && (
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 28,
                lineHeight: 1.3,
                whiteSpace: 'pre',
              }}
            >
              <span style={{ color: colors.cyan }}>{asciiLogo[0]}</span>
              {'\n'}
              <span style={{ color: colors.cyan }}>{asciiLogo[1]}</span>
              <span style={{ color: colors.muted }}>{'   v0.1.0'}</span>
              {'\n'}
              <span style={{ color: colors.cyan }}>{asciiLogo[2]}</span>
            </div>
          )}

          <div style={{ height: 28 }} />

          {/* CTA command */}
          <TypeWriter
            text="npx sink-cli wash contacts.csv"
            startFrame={25}
            speed={1}
          />

          <div style={{ height: 20 }} />

          {/* One-liner pitch */}
          <TerminalLine startFrame={65} indent={2}>
            <span style={{ color: colors.text }}>
              Clean contact lists from the terminal. Open source. Free.
            </span>
          </TerminalLine>

          <div style={{ height: 16 }} />

          {/* GitHub URL */}
          <TerminalLine startFrame={85} indent={2}>
            <span style={{ color: colors.muted }}>
              github.com/totalaudiopromo/sink-cli
            </span>
          </TerminalLine>

          <div style={{ height: 24 }} />

          {/* Staggered tagline words */}
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 28,
              fontWeight: 700,
              whiteSpace: 'pre',
              paddingLeft: 16,
            }}
          >
            {frame >= 110 && (
              <span style={{ color: colors.cyan }}>Scrub.</span>
            )}
            {frame >= 120 && (
              <span style={{ color: colors.green }}>{'  Rinse.'}</span>
            )}
            {frame >= 130 && (
              <span style={{ color: colors.yellow }}>{'  Soak.'}</span>
            )}
          </div>
        </TerminalWindow>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
