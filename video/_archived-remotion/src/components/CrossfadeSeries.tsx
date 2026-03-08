import React from 'react';
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface SceneEntry {
  durationInFrames: number;
  children: React.ReactNode;
}

interface CrossfadeSeriesProps {
  scenes: SceneEntry[];
  crossfadeDuration?: number;
}

export const CrossfadeSeries: React.FC<CrossfadeSeriesProps> = ({
  scenes,
  crossfadeDuration = 15,
}) => {
  const starts: number[] = [];
  let offset = 0;
  for (let i = 0; i < scenes.length; i++) {
    starts.push(offset);
    offset += scenes[i].durationInFrames - (i < scenes.length - 1 ? crossfadeDuration : 0);
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 30%, #a5f3fc 60%, #ecfeff 85%, #f8fafc 100%)' }} />
      {scenes.map((scene, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={scene.durationInFrames}>
          <CrossfadeWrapper
            index={i}
            total={scenes.length}
            duration={scene.durationInFrames}
            crossfadeDuration={crossfadeDuration}
          >
            {scene.children}
          </CrossfadeWrapper>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const CrossfadeWrapper: React.FC<{
  index: number;
  total: number;
  duration: number;
  crossfadeDuration: number;
  children: React.ReactNode;
}> = ({ index, total, duration, crossfadeDuration, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn =
    index === 0
      ? 1
      : spring({
          frame,
          fps,
          config: { damping: 22, stiffness: 100, mass: 0.7 },
          durationInFrames: crossfadeDuration,
        });

  const fadeOut =
    index === total - 1
      ? 1
      : 1 -
        spring({
          frame: Math.max(0, frame - (duration - crossfadeDuration)),
          fps,
          config: { damping: 22, stiffness: 100, mass: 0.7 },
          durationInFrames: crossfadeDuration,
        });

  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};
