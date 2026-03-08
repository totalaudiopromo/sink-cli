import React from 'react';
import { Composition } from 'remotion';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { SinkPromo } from './SinkPromo';

const { fontFamily: monoFont } = loadJetBrainsMono('normal', {
  weights: ['400', '500', '700'],
  subsets: ['latin'],
});

export { monoFont };

// 7 scenes: 200+160+210+170+170+200+200 = 1310
// Minus 6 crossfades of 15 frames each = 90
// Total = 1220 frames (~40.7s at 30fps)
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SinkPromo"
      component={SinkPromo}
      durationInFrames={1220}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
