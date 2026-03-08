import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors } from '../lib/theme';

export const TerminalWindow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200, mass: 0.6 },
    from: 0.95,
    to: 1,
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: 1400,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          transform: `scale(${scale})`,
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#eab308' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#22c55e' }} />
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};
