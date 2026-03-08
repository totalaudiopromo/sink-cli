import React, { useState, useEffect } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nanoid } from 'nanoid'
import { COLOUR } from '../theme.js'
import { PhaseProgress } from './phase-progress.js'
import { SummaryPanel } from './summary.js'
import type { SinkRecord, SinkConfig, Phase } from '../../types.js'

async function parseFile(filePath: string): Promise<SinkRecord[]> {
  const { parseCSV } = await import('../../phases/scrub/parse.js')
  const text = readFileSync(resolve(filePath), 'utf-8')
  const { contacts } = parseCSV(text)
  return contacts.map((raw) => ({
    id: nanoid(),
    raw,
    phases: [] as Phase[],
    timestamp: new Date().toISOString(),
  }))
}

interface AppProps {
  filePath: string
  config: SinkConfig
  phases?: Phase[]
}

export function App({ filePath, config, phases: requestedPhases }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const termWidth = stdout?.columns ?? 80

  const phasesToRun = requestedPhases ?? (['scrub', 'rinse', 'soak'] as Phase[])

  const [records, setRecords] = useState<SinkRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [startTime] = useState(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  const [phaseStates, setPhaseStates] = useState<
    Record<
      Phase,
      { current: number; total: number; elapsed: number; active: boolean; done: boolean }
    >
  >({
    scrub: { current: 0, total: 0, elapsed: 0, active: false, done: false },
    rinse: { current: 0, total: 0, elapsed: 0, active: false, done: false },
    soak: { current: 0, total: 0, elapsed: 0, active: false, done: false },
  })

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const parsed = await parseFile(filePath)
        if (cancelled) return
        setRecords(parsed)

        const { runPipeline } = await import('../../pipeline.js')
        const { records: processed } = await runPipeline(parsed, {
          phases: phasesToRun,
          config,
          onProgress: (phase, progress) => {
            if (cancelled) return
            setPhaseStates((prev) => ({
              ...prev,
              [phase]: {
                current: progress.current,
                total: progress.total,
                elapsed: Date.now() - startTime,
                active: true,
                done: progress.current >= progress.total,
              },
            }))
            setElapsedMs(Date.now() - startTime)
          },
        })

        if (!cancelled) {
          setRecords(processed)
          setDone(true)
          setElapsedMs(Date.now() - startTime)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [filePath, config, phasesToRun, startTime])

  useInput((input) => {
    if (input === 'q') exit()
  })

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={COLOUR.invalid} bold>
          Error: {error}
        </Text>
        <Text color={COLOUR.muted}>Press q to quit</Text>
      </Box>
    )
  }

  const width = Math.max(60, termWidth)

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between">
        <Text bold color={COLOUR.accent}>
          {' '}
          sink {phasesToRun.join(' \u2192 ')}
        </Text>
        <Text color={COLOUR.muted}>{records.length} contacts</Text>
      </Box>
      <Text color={COLOUR.dimmed}>{'\u2500'.repeat(width)}</Text>
      <Text> </Text>

      <PhaseProgress
        phases={phasesToRun.map((p) => ({
          phase: p,
          label: p,
          ...phaseStates[p],
        }))}
        width={width}
      />

      <Text> </Text>
      <SummaryPanel
        total={records.length}
        completed={records.filter((r) => r.phases.length > 0).length}
        elapsedMs={elapsedMs}
        width={width}
      />

      {done && (
        <Box marginTop={1}>
          <Text color={COLOUR.valid}> {'\u2713'} Complete</Text>
          <Text color={COLOUR.muted}> · Press q to quit</Text>
        </Box>
      )}
    </Box>
  )
}
