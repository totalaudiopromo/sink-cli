import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface AnimatedNumberProps {
  value: number;
  startFrame: number;
  duration?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  startFrame,
  duration = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = Math.max(0, frame - startFrame);

  const animated = spring({
    frame: elapsed,
    fps,
    config: { damping: 26, stiffness: 160, mass: 0.7 },
    from: 0,
    to: value,
    durationInFrames: duration,
  });

  return <>{Math.round(animated).toLocaleString('en-GB')}</>;
};
