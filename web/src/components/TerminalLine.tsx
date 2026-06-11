import type { TerminalLine as Line } from '../types'

const LOGO = ['     ___ (_)__  / /__', "    (_-</ / _ \\/  '_/", '   /___/_/_//_/_/\\_\\']

const ICONS: Record<string, { glyph: string; cls: string }> = {
  ok: { glyph: '✓', cls: 'green' },
  warn: { glyph: '~', cls: 'yellow' },
  fail: { glyph: '✗', cls: 'red' },
}

function pad(value: string, width: number): string {
  return value.length > width ? value.slice(0, width - 1) + '…' : value.padEnd(width)
}

function confidenceCls(confidence: string): string {
  if (confidence === 'high') return 'green'
  if (confidence === 'medium') return 'yellow'
  if (confidence === 'none') return 'red'
  return 'dim'
}

export function TerminalLineView({ line }: { line: Line }) {
  const d = line.data
  switch (line.kind) {
    case 'blank':
      return <div className="t-line">&nbsp;</div>

    case 'logo':
      return (
        <div className="t-line">
          {LOGO.map((row, i) => (
            <div key={i} className="cyan">
              {row}
            </div>
          ))}
        </div>
      )

    case 'plain':
      return <div className={`t-line ${d.dim ? 'dim' : ''}`}>{'  ' + String(d.text)}</div>

    case 'step':
      return <div className="t-line">{'  ' + String(d.text)}</div>

    case 'progress':
      return (
        <div className="t-line">
          {'  '}
          <span className="cyan spinner">◌</span> <span className="dim">{String(d.text)}</span>
        </div>
      )

    case 'step-complete':
      return (
        <div className="t-line">
          {'  '}
          <span className="cyan">◇</span> {String(d.text)}
        </div>
      )

    case 'validation-row': {
      const icon = ICONS[String(d.icon)] ?? ICONS.ok
      return (
        <div className="t-line">
          {'  '}
          <span className={icon.cls}>{icon.glyph}</span> {pad(String(d.label), 12)}
          <span className="count">{String(d.count).padStart(6)}</span>{' '}
          <span className="dim">{String(d.unit)}</span>
        </div>
      )
    }

    case 'divider':
      return <div className="t-line dim">{'  ' + '─'.repeat(44)}</div>

    case 'quality': {
      const q = Number(d.quality)
      const cls = q >= 80 ? 'green' : q >= 60 ? 'yellow' : 'red'
      return (
        <div className="t-line">
          {'  Quality: '}
          <span className={cls}>{q}%</span>
        </div>
      )
    }

    case 'transform-summary':
      return (
        <div className="t-line">
          {'  '}
          {String(d.total)} contacts <span className="dim">→</span>{' '}
          <span className="green">{String(d.valid)} verified</span>
          {',  '}
          <span className="yellow">{String(d.risky)} unverified</span>
          {',  '}
          <span className="red">{String(d.invalid)} invalid</span>
        </div>
      )

    case 'transform-detail':
      return (
        <div className="t-line dim">
          {'  '}
          {Number(d.typos) > 0 && `Fixed ${String(d.typos)} typo${Number(d.typos) === 1 ? '' : 's'}`}
          {Number(d.typos) > 0 && Number(d.duplicates) > 0 && ' · '}
          {Number(d.duplicates) > 0 &&
            `Merged ${String(d.duplicates)} dupe${Number(d.duplicates) === 1 ? '' : 's'}`}
        </div>
      )

    case 'contact-row': {
      const icon = ICONS[String(d.tone)] ?? ICONS.ok
      return (
        <div className="t-line">
          {'  '}
          <span className={icon.cls}>{icon.glyph}</span> {pad(String(d.name), 22)}
          <span className="dim">{pad(String(d.email), 28)}</span>
          <span className={icon.cls === 'green' ? 'dim' : icon.cls}>{String(d.reason)}</span>
        </div>
      )
    }

    case 'contact-dupe':
      return (
        <div className="t-line dim">
          {'    ↳ '}
          {pad(String(d.name), 20)}merged ({String(d.matchType)}) with {String(d.mergedWith)}
        </div>
      )

    case 'output-path':
      return (
        <div className="t-line">
          {'  '}
          <span className="dim">→</span> <span className="cyan">{String(d.path)}</span>
        </div>
      )

    case 'outro':
      return <div className="t-line dim">{`  Done in ${String(d.seconds)}s`}</div>

    case 'phase-header':
      return (
        <div className="t-line">
          {'  '}
          <span className="cyan">{`── ${String(d.name)} `}</span>
          <span className="dim">{String(d.label)}</span>
        </div>
      )

    case 'phase-gate':
      return (
        <div className="t-line">
          {'  '}
          <span className="yellow">~</span> <span className="yellow">{String(d.text)}</span>
        </div>
      )

    case 'soak-row': {
      const icon = ICONS[String(d.tone)] ?? ICONS.ok
      return (
        <div className="t-line">
          {'  '}
          <span className={icon.cls}>{icon.glyph}</span> {pad(String(d.name), 22)}
          <span className="dim">{pad(String(d.detail ?? ''), 34)}</span>
          <span className={confidenceCls(String(d.confidence))}>{String(d.confidence)}</span>
        </div>
      )
    }

    case 'soak-summary': {
      const failed = Number(d.failed)
      return (
        <div className="t-line">
          {'  '}
          <span className={failed > 0 ? 'yellow' : 'green'}>{failed > 0 ? '~' : '✓'}</span>{' '}
          Enriched {String(d.enriched)} contact{Number(d.enriched) === 1 ? '' : 's'}
          {failed > 0 && <span className="dim">{` (${failed} failed)`}</span>}
        </div>
      )
    }

    case 'steep-row': {
      const icon = ICONS[String(d.tone)] ?? ICONS.ok
      return (
        <div className="t-line">
          {'  '}
          <span className={icon.cls}>{icon.glyph}</span> {pad(String(d.domain), 26)}
          <span className="dim">{pad(String(d.detail ?? ''), 30)}</span>
          <span className={confidenceCls(String(d.confidence))}>{String(d.confidence)}</span>
        </div>
      )
    }

    case 'steep-summary':
      return (
        <div className="t-line">
          {'  '}
          <span className="green">✓</span> Researched {String(d.outlets)} outlet
          {Number(d.outlets) === 1 ? '' : 's'}
          <span className="dim">
            {`  ·  ${String(d.portals)} submission portal${Number(d.portals) === 1 ? '' : 's'}`}
            {`  ·  ${String(d.confirmed)} contact${Number(d.confirmed) === 1 ? '' : 's'} confirmed`}
          </span>
        </div>
      )

    case 'key-error':
      return (
        <div className="t-line">
          {'  '}
          <span className="red">✗</span> <span className="red">{String(d.text)}</span>
        </div>
      )

    case 'key-prompt':
      return (
        <div className="t-line">
          {'  '}
          <span className="cyan">?</span> <span className="dim">{String(d.text)}</span>
        </div>
      )

    default:
      return null
  }
}
