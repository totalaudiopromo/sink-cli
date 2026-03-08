import React from 'react';
import { useCurrentFrame } from 'remotion';
import { monoFont } from '../Root';
import { colors, glyphs } from '../lib/theme';

interface TypeWriterProps {
  text: string;
  speed?: number;
  prefix?: string;
  color?: string;
  startFrame?: number;
  showCursor?: boolean;
}

export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  speed = 2,
  prefix = '$ ',
  color = colors.text,
  startFrame = 0,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(Math.floor(elapsed / speed), text.length);
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  return (
    <div style={{ fontFamily: monoFont, fontSize: 24, whiteSpace: 'pre' }}>
      <span style={{ color: colors.cyan }}>{prefix}</span>
      <span style={{ color }}>{text.slice(0, visibleChars)}</span>
      {showCursor && (
        <span style={{ color, opacity: cursorVisible ? 1 : 0 }}>{glyphs.cursor}</span>
      )}
    </div>
  );
};
