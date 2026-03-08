import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { monoFont } from '../Root';
import { colors, glyphs } from '../lib/theme';

interface ProgressBarProps {
  label: string;
  percentage: number;
  color?: string;
  startFrame?: number;
  durationFrames?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  percentage,
  color = colors.cyan,
  startFrame = 0,
  durationFrames = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 26, stiffness: 160, mass: 0.7 },
    from: 0,
    to: percentage,
    durationInFrames: durationFrames,
  });

  const totalWidth = 40;
  const filled = Math.round((progress / 100) * totalWidth);
  const bar = glyphs.block.repeat(filled) + glyphs.lightBlock.repeat(totalWidth - filled);

  return (
    <div style={{ fontFamily: monoFont, fontSize: 20, color: colors.text, whiteSpace: 'pre' }}>
      <span>{label}: </span>
      <span style={{ color }}>{bar}</span>
      <span> {Math.round(progress)}%</span>
    </div>
  );
};
