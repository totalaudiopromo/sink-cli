import { useCallback } from 'react'
import { DEMO_CSV } from 'datasink/core'
import { useEngine } from './hooks/useEngine'
import { TerminalWindow } from './components/TerminalWindow'
import { TerminalLineView } from './components/TerminalLine'
import { DropZone } from './components/DropZone'
import { ApiKeyPanel } from './components/ApiKeyPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { CtaPanel } from './components/CtaPanel'
import type { RunMode } from './types'

const LOGO = ['     ___ (_)__  / /__', "    (_-</ / _ \\/  '_/", '   /___/_/_//_/_/\\_\\']

export default function App() {
  const { status, stats, records, mode, error, lines, run, runAiPhases, skipAiPhases, spot, reset } =
    useEngine()

  const handleCsv = useCallback(
    (text: string, runMode: RunMode = 'full') => {
      void run(text === '__DEMO__' ? DEMO_CSV : text, runMode)
    },
    [run],
  )

  const handleSpot = useCallback(
    (email: string) => {
      void spot(email)
    },
    [spot],
  )

  const showResults = status === 'done' && stats && mode !== 'spot'

  return (
    <div className="page">
      <header className="hero">
        <pre className="logo" aria-hidden="true">
          {LOGO.join('\n')}
        </pre>
        <h1 className="visually-hidden">sink — contact data hygiene for the music industry</h1>
        <p className="strapline">
          Contact data hygiene for the music industry. The whole pipeline, in your browser.
        </p>
        <p className="substrap dim">
          Scrub typos, verify mail servers, merge duplicates — locally. Then enrich contacts and
          research outlets with AI, using your own API key.
        </p>
      </header>

      <main>
        <TerminalWindow autoScroll={status === 'running'}>
          {status === 'idle' ? (
            <DropZone onCsv={handleCsv} onSpot={handleSpot} error={error} />
          ) : (
            <div className="terminal-output">
              {lines.map((line) => (
                <TerminalLineView key={line.id} line={line} />
              ))}
              {status === 'running' && <div className="t-line cursor">▋</div>}
              {status === 'awaiting-keys' && (
                <ApiKeyPanel onRun={runAiPhases} onSkip={skipAiPhases} />
              )}
            </div>
          )}
        </TerminalWindow>

        {showResults && (
          <ResultsPanel
            stats={stats}
            records={records}
            reportOnly={mode === 'inspect'}
            onReset={reset}
          />
        )}

        {status === 'done' && mode === 'spot' && (
          <div className="results results-spot">
            <button type="button" className="reset-button" onClick={reset}>
              Check another
            </button>
          </div>
        )}

        <CtaPanel />
      </main>
    </div>
  )
}
