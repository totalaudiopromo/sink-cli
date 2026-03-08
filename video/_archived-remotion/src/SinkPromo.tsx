import React from 'react';
import { CrossfadeSeries } from './components/CrossfadeSeries';
import { Intro } from './scenes/Intro';
import { Problem } from './scenes/Problem';
import { Scrub } from './scenes/Scrub';
import { Rinse } from './scenes/Rinse';
import { Soak } from './scenes/Soak';
import { Result } from './scenes/Result';
import { Outro } from './scenes/Outro';

export const SinkPromo: React.FC = () => {
  return (
    <CrossfadeSeries
      scenes={[
        { durationInFrames: 200, children: <Intro /> },
        { durationInFrames: 160, children: <Problem /> },
        { durationInFrames: 210, children: <Scrub /> },
        { durationInFrames: 170, children: <Rinse /> },
        { durationInFrames: 170, children: <Soak /> },
        { durationInFrames: 200, children: <Result /> },
        { durationInFrames: 200, children: <Outro /> },
      ]}
      crossfadeDuration={15}
    />
  );
};
