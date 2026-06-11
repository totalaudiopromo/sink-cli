import { useCallback } from 'react'
import { DEMO_CSV } from 'datasink/core'
import { useEngine } from './hooks/useEngine'
import { TerminalWindow } from './components/TerminalWindow'
import { TerminalLineView } from './components/TerminalLine'
import { DropZone } from './components/DropZone'
import { ResultsPanel } from './components/ResultsPanel'
import { CtaPanel } from './components/CtaPanel'

const LOGO = ['     ___ (_)__  / /__', "    (_-</ / _ \\/  '_/", '   /___/_/_//_/_/\\_\\']

export default function App() {
  const { status, stats, cleanCsv, error, lines, run, reset } = useEngine()

  const handleCsv = useCallback(
    (text: string) => {
      void run(text === '__DEMO__' ? DEMO_CSV : text)
    },
    [run],
  )

  return (
    <div className="page">
      <header className="hero">
        <pre className="logo" aria-hidden="true">
          {LOGO.join('\n')}
        </pre>
        <h1 className="visually-hidden">sink — contact data hygiene for music PR</h1>
        <p className="strapline">Data hygiene for music PR. In your browser.</p>
        <p className="substrap dim">
          Scrub typos, verify mail servers, merge duplicates — without your contact list ever
          leaving your machine.
        </p>
      </header>

      <main>
        <TerminalWindow autoScroll={status === 'running'}>
          {status === 'idle' ? (
            <DropZone onCsv={handleCsv} error={error} />
          ) : (
            <div className="terminal-output">
              {lines.map((line) => (
                <TerminalLineView key={line.id} line={line} />
              ))}
              {status === 'running' && <div className="t-line cursor">▋</div>}
            </div>
          )}
        </TerminalWindow>

        {status === 'done' && stats && (
          <ResultsPanel stats={stats} cleanCsv={cleanCsv} onReset={reset} />
        )}

        <CtaPanel />
      </main>
    </div>
  )
}
