import { useCallback, useEffect, useRef, useState } from 'react'
import { toGoogleSheetsExportUrl } from 'datasink/core'
import type { RunMode } from '../types'

export function DropZone({
  onCsv,
  onSpot,
  error,
}: {
  onCsv: (text: string, mode?: RunMode) => void
  onSpot: (email: string) => void
  error: string | null
}) {
  const [dragOver, setDragOver] = useState(false)
  const [inspect, setInspect] = useState(false)
  const [panel, setPanel] = useState<'none' | 'url' | 'spot'>('none')
  const [urlValue, setUrlValue] = useState('')
  const [spotValue, setSpotValue] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Paste handler reads the latest inspect value without re-subscribing.
  const inspectRef = useRef(inspect)
  inspectRef.current = inspect

  const submitCsv = useCallback(
    (text: string) => onCsv(text, inspectRef.current ? 'inspect' : 'full'),
    [onCsv],
  )

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => submitCsv(String(reader.result ?? ''))
      reader.readAsText(file)
    },
    [submitCsv],
  )

  // Paste anywhere on the page (e.g. straight from a spreadsheet).
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')
      if (text && text.includes(',')) submitCsv(text)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [submitCsv])

  const fetchUrl = useCallback(async () => {
    const raw = urlValue.trim()
    if (!raw) return
    setUrlError(null)
    setFetching(true)
    try {
      const res = await fetch(toGoogleSheetsExportUrl(raw))
      if (!res.ok) {
        setUrlError(`Couldn’t fetch that URL (HTTP ${res.status}).`)
        return
      }
      const text = await res.text()
      if (!text.trim()) {
        setUrlError('That URL returned an empty response.')
        return
      }
      submitCsv(text)
    } catch {
      setUrlError(
        'Couldn’t fetch that URL — it may block cross-origin requests. Google Sheets share links work; for other hosts, download the CSV and drop it in.',
      )
    } finally {
      setFetching(false)
    }
  }, [urlValue, submitCsv])

  return (
    <div
      className={`dropzone ${dragOver ? 'drag-over' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Drop a CSV file, click to browse, or paste from a spreadsheet"
      onClick={() => fileInput.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) readFile(file)
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
        }}
      />
      <div className="dropzone-inner">
        <div className="dropzone-glyph cyan">◇</div>
        <p className="dropzone-title">Drop your contacts CSV here</p>
        <p className="dim">click to browse, or paste straight from your spreadsheet</p>
        {error && <p className="red dropzone-error">{error}</p>}

        <div className="dropzone-extras" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="demo-button" onClick={() => submitCsv('__DEMO__')}>
            or try the demo data
          </button>

          <div className="dropzone-links">
            <button
              type="button"
              className="text-link"
              onClick={() => setPanel(panel === 'url' ? 'none' : 'url')}
            >
              load from URL
            </button>
            <span className="dim"> · </span>
            <button
              type="button"
              className="text-link"
              onClick={() => setPanel(panel === 'spot' ? 'none' : 'spot')}
            >
              spot-check one email
            </button>
          </div>

          {panel === 'url' && (
            <div className="mini-form">
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/… or a CSV URL"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void fetchUrl()
                }}
              />
              <button type="button" className="mini-button" disabled={fetching} onClick={() => void fetchUrl()}>
                {fetching ? 'Fetching…' : 'Fetch'}
              </button>
              {urlError && <p className="red mini-error">{urlError}</p>}
            </div>
          )}

          {panel === 'spot' && (
            <div className="mini-form">
              <input
                type="email"
                placeholder="name@outlet.com"
                value={spotValue}
                onChange={(e) => setSpotValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && spotValue.trim()) onSpot(spotValue.trim())
                }}
              />
              <button
                type="button"
                className="mini-button"
                disabled={!spotValue.trim()}
                onClick={() => onSpot(spotValue.trim())}
              >
                Check
              </button>
            </div>
          )}

          <label className="dropzone-inspect dim">
            <input type="checkbox" checked={inspect} onChange={(e) => setInspect(e.target.checked)} />{' '}
            Quality report only (no cleaned file)
          </label>
        </div>

        <p className="dim privacy-note">
          Scrub &amp; rinse run locally — your contacts never leave your browser (only domain names
          are checked against DNS). The optional AI phases use your own API key.
        </p>
      </div>
    </div>
  )
}
