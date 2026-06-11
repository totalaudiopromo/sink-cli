import { useCallback, useState } from 'react'
import { runEngine } from '../engine'
import { useTerminalReplay } from './useTerminalReplay'
import type { RunStatus, WebStats } from '../types'

export function useEngine() {
  const replay = useTerminalReplay()
  const [status, setStatus] = useState<RunStatus>('idle')
  const [stats, setStats] = useState<WebStats | null>(null)
  const [cleanCsv, setCleanCsv] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (csvText: string) => {
      setStatus('running')
      setError(null)
      setStats(null)
      replay.reset()
      replay.start()

      const result = await runEngine(csvText, replay.push)

      if (result.parseError) {
        replay.stop()
        setError(result.parseError)
        setStatus('idle')
        return
      }

      // Let the replay drain before declaring done, so the results panel
      // arrives after the terminal has finished "typing".
      const waitForDrain = () =>
        new Promise<void>((resolve) => {
          const poll = setInterval(() => {
            if (replay.queueEmpty()) {
              clearInterval(poll)
              resolve()
            }
          }, 80)
        })
      await waitForDrain()
      replay.stop()

      setStats(result.stats)
      setCleanCsv(result.cleanCsv)
      setStatus('done')
    },
    [replay],
  )

  const reset = useCallback(() => {
    replay.reset()
    setStatus('idle')
    setStats(null)
    setCleanCsv('')
    setError(null)
  }, [replay])

  return { status, stats, cleanCsv, error, lines: replay.visible, run, reset }
}
