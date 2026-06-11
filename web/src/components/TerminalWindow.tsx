import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function TerminalWindow({
  children,
  autoScroll = false,
}: {
  children: ReactNode
  autoScroll?: boolean
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  })

  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="traffic red-light" />
        <span className="traffic yellow-light" />
        <span className="traffic green-light" />
        <span className="terminal-title">sink — contact data hygiene for the music industry</span>
      </div>
      <div className="terminal-body" role="log" aria-live="polite" ref={bodyRef}>
        {children}
      </div>
    </div>
  )
}
