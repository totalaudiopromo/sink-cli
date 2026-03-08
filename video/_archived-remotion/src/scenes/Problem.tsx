import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TerminalWindow } from '../components/TerminalWindow';
import { TerminalLine } from '../components/TerminalLine';
import { TypeWriter } from '../components/TypeWriter';
import { colors, gradientBg } from '../lib/theme';

export const Problem: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: gradientBg }}>
      <TerminalWindow>
        {/* Context: what are we looking at? */}
        <TerminalLine startFrame={0} indent={2}>
          <span style={{ color: colors.muted }}>
            You exported your contacts. Let's see what we're working with.
          </span>
        </TerminalLine>

        <div style={{ height: 20 }} />

        <TypeWriter text="cat contacts.csv" startFrame={15} />

        <div style={{ height: 16 }} />

        {/* CSV header */}
        <TerminalLine startFrame={35} indent={2}>
          <span style={{ color: colors.muted }}>name,email,company</span>
        </TerminalLine>

        {/* CSV rows -- appear like terminal output, one after another */}
        <TerminalLine startFrame={40} indent={2}>
          <span style={{ color: colors.text }}>John Smith,john@</span>
          <span style={{ color: colors.red }}>gmial</span>
          <span style={{ color: colors.text }}>.com,Acme</span>
        </TerminalLine>
        <TerminalLine startFrame={45} indent={2}>
          <span style={{ color: colors.text }}>Sarah Jones,sarah@bbc.com,BBC</span>
        </TerminalLine>
        <TerminalLine startFrame={50} indent={2}>
          <span style={{ color: colors.text }}>Mike Brown,mike@gmail.com,</span>
        </TerminalLine>
        <TerminalLine startFrame={55} indent={2}>
          <span style={{ color: colors.yellow }}>,</span>
          <span style={{ color: colors.text }}>info@hotmail.com,Unknown</span>
        </TerminalLine>
        <TerminalLine startFrame={60} indent={2}>
          <span style={{ color: colors.text }}>Dave Wilson,dave@</span>
          <span style={{ color: colors.red }}>yahoo,com</span>
          <span style={{ color: colors.text }}>,PR Co</span>
        </TerminalLine>
        <TerminalLine startFrame={65} indent={2}>
          <span style={{ color: colors.muted }}>M. Brown,mike@gmail.com,</span>
        </TerminalLine>
        <TerminalLine startFrame={70} indent={2}>
          <span style={{ color: colors.text }}>Kate Davis,</span>
          <span style={{ color: colors.red }}>kate@</span>
          <span style={{ color: colors.text }}>,</span>
        </TerminalLine>
        <TerminalLine startFrame={75} indent={2}>
          <span style={{ color: colors.text }}>Tom Harris,tom@radiobbc.co.uk,</span>
        </TerminalLine>

        <div style={{ height: 20 }} />

        {/* Punchline -- lingers for ~50 frames */}
        <TerminalLine startFrame={95} indent={2}>
          <span style={{ color: colors.muted }}>
            8 rows. Typos, dupes, missing data. How many are actually usable?
          </span>
        </TerminalLine>
      </TerminalWindow>
    </AbsoluteFill>
  );
};
