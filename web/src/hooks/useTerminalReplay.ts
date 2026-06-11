import { useCallback, useEffect, useRef, useState } from 'react'
import type { TerminalLine } from '../types'

const TICK_MS = 60

/**
 * Paces the reveal of terminal lines. The engine pushes lines into a queue as
 * real work happens; this hook drains one line per tick so the terminal reads
 * like it is being typed. Consecutive replace-lines (per-email progress)
 * collapse to the latest so the display never lags behind the engine.
 */
export function useTerminalReplay() {
  const queue = useRef<TerminalLine[]>([])
  const [visible, setVisible] = useState<TerminalLine[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const push = useCallback((line: TerminalLine) => {
    const q = queue.current
    // Collapse runs of replace-lines: keep only the newest progress frame.
    if (line.replace && q.length > 0 && q[q.length - 1].replace) {
      q[q.length - 1] = line
    } else {
      q.push(line)
    }
  }, [])

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => {
      const next = queue.current.shift()
      if (!next) return
      setVisible((lines) => {
        if (next.replace && lines.length > 0) {
          return [...lines.slice(0, -1), next]
        }
        return [...lines, next]
      })
    }, TICK_MS)
  }, [])

  const stop = useCallback(() => {
    // Flush whatever remains so the final state is always complete.
    const remaining = queue.current.splice(0)
    if (remaining.length > 0) {
      setVisible((lines) => {
        let out = [...lines]
        for (const l of remaining) {
          if (l.replace && out.length > 0) out = [...out.slice(0, -1), l]
          else out.push(l)
        }
        return out
      })
    }
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const queueEmpty = useCallback(() => queue.current.length === 0, [])

  const reset = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
    queue.current = []
    setVisible([])
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current)
    },
    [],
  )

  return { visible, push, start, stop, reset, queueEmpty }
}
