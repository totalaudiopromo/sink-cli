import { useCallback, useRef, useState } from 'react'
import { runClean, narrateSummary, runSpot } from '../engine'
import { runSoakBrowser } from '../soak-browser'
import { runSteepBrowser } from '../steep-browser'
import { useTerminalReplay } from './useTerminalReplay'
import type { ApiKeys, RunMode, RunStatus, SinkRecord, WebStats } from '../types'

export function useEngine() {
  const replay = useTerminalReplay()
  const [status, setStatus] = useState<RunStatus>('idle')
  const [stats, setStats] = useState<WebStats | null>(null)
  const [records, setRecords] = useState<SinkRecord[]>([])
  const [mode, setMode] = useState<RunMode>('full')
  const [error, setError] = useState<string | null>(null)

  // Carried between the clean phase and the (later) AI phases.
  const pending = useRef<{ records: SinkRecord[]; stats: WebStats; startedAt: number } | null>(null)

  const waitForDrain = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const poll = setInterval(() => {
          if (replay.queueEmpty()) {
            clearInterval(poll)
            resolve()
          }
        }, 80)
      }),
    [replay],
  )

  const run = useCallback(
    async (csvText: string, runMode: RunMode = 'full') => {
      setStatus('running')
      setError(null)
      setStats(null)
      setRecords([])
      setMode(runMode)
      replay.reset()
      replay.start()
      const startedAt = Date.now()

      const result = await runClean(csvText, replay.push, runMode)

      if (result.parseError) {
        await waitForDrain()
        replay.stop()
        setError(result.parseError)
        setStatus('idle')
        return
      }

      pending.current = { records: result.records, stats: result.stats, startedAt }

      if (runMode === 'inspect') {
        narrateSummary(result.records, result.stats, replay.push, {
          durationMs: Date.now() - startedAt,
          reportOnly: true,
        })
        await waitForDrain()
        replay.stop()
        setRecords(result.records)
        setStats({ ...result.stats, durationMs: Date.now() - startedAt })
        setStatus('done')
        return
      }

      // Full mode: pause and offer AI enrichment once the clean output is typed.
      await waitForDrain()
      setStatus('awaiting-keys')
    },
    [replay, waitForDrain],
  )

  const finalize = useCallback(
    async (recs: SinkRecord[], finalStats: WebStats, startedAt: number) => {
      narrateSummary(recs, finalStats, replay.push, { durationMs: Date.now() - startedAt })
      await waitForDrain()
      replay.stop()
      setRecords(recs)
      setStats({ ...finalStats, durationMs: Date.now() - startedAt })
      setStatus('done')
    },
    [replay, waitForDrain],
  )

  const runAiPhases = useCallback(
    async (keys: ApiKeys) => {
      const ctx = pending.current
      if (!ctx) return
      setStatus('running')

      let recs = ctx.records
      const next: WebStats = { ...ctx.stats }

      if (keys.anthropic) {
        const soak = await runSoakBrowser(recs, replay.push, { anthropicKey: keys.anthropic })
        recs = soak.records
        next.enriched = soak.enriched
        next.enrichFailed = soak.failed
      }

      if (keys.anthropic && keys.firecrawl) {
        const steep = await runSteepBrowser(recs, replay.push, {
          anthropicKey: keys.anthropic,
          firecrawlKey: keys.firecrawl,
        })
        recs = steep.records
        next.outletsScraped = steep.outletsScraped
        next.outletsWithPortal = steep.outletsWithPortal
        next.contactsConfirmed = steep.contactsConfirmed
      }

      await finalize(recs, next, ctx.startedAt)
    },
    [replay, finalize],
  )

  const skipAiPhases = useCallback(async () => {
    const ctx = pending.current
    if (!ctx) return
    setStatus('running')
    await finalize(ctx.records, ctx.stats, ctx.startedAt)
  }, [finalize])

  const spot = useCallback(
    async (email: string) => {
      setStatus('running')
      setError(null)
      setStats(null)
      setRecords([])
      setMode('spot')
      replay.reset()
      replay.start()
      await runSpot(email, replay.push)
      await waitForDrain()
      replay.stop()
      setStatus('done')
    },
    [replay, waitForDrain],
  )

  const reset = useCallback(() => {
    replay.reset()
    pending.current = null
    setStatus('idle')
    setStats(null)
    setRecords([])
    setError(null)
    setMode('full')
  }, [replay])

  return {
    status,
    stats,
    records,
    mode,
    error,
    lines: replay.visible,
    run,
    runAiPhases,
    skipAiPhases,
    spot,
    reset,
  }
}
