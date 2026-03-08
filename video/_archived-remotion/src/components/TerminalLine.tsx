import React from 'react';
import { useCurrentFrame } from 'remotion';
import { monoFont } from '../Root';

interface TerminalLineProps {
  startFrame: number;
  children: React.ReactNode;
  indent?: number;
}

export const TerminalLine: React.FC<TerminalLineProps> = ({
  startFrame,
  children,
  indent = 2,
}) => {
  const frame = useCurrentFrame();

  // Instant appear -- no spring, no slide. Like a real terminal.
  if (frame < startFrame) return null;

  return (
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 24,
        whiteSpace: 'pre',
        lineHeight: 1.6,
      }}
    >
      {' '.repeat(indent)}
      {children}
    </div>
  );
};
