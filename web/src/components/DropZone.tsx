import { useCallback, useEffect, useRef, useState } from 'react'

export function DropZone({
  onCsv,
  error,
}: {
  onCsv: (text: string) => void
  error: string | null
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => onCsv(String(reader.result ?? ''))
      reader.readAsText(file)
    },
    [onCsv],
  )

  // Paste anywhere on the page (e.g. straight from a spreadsheet).
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')
      if (text && text.includes(',')) onCsv(text)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [onCsv])

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
        <button
          type="button"
          className="demo-button"
          onClick={(e) => {
            e.stopPropagation()
            onCsv('__DEMO__')
          }}
        >
          or try the demo data
        </button>
        <p className="dim privacy-note">
          Your contacts never leave your browser — cleaning runs locally; only domain names are
          checked against DNS.
        </p>
      </div>
    </div>
  )
}
