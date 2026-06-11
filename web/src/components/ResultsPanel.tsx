import { useMemo, useState } from 'react'
import { generateCSV, generateJSON, generateJSONL } from 'datasink/core'
import type { SinkRecord, WebStats } from '../types'

type Format = 'csv' | 'json' | 'jsonl'

const FORMATS: { id: Format; label: string; mime: string; ext: string }[] = [
  { id: 'csv', label: 'CSV', mime: 'text/csv', ext: 'csv' },
  { id: 'json', label: 'JSON', mime: 'application/json', ext: 'json' },
  { id: 'jsonl', label: 'JSONL', mime: 'application/x-ndjson', ext: 'jsonl' },
]

function generate(format: Format, records: SinkRecord[]): string {
  if (format === 'json') return generateJSON(records)
  if (format === 'jsonl') return generateJSONL(records)
  return generateCSV(records)
}

function platformBreakdown(records: SinkRecord[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const r of records) {
    const t = r.soak?.platformType
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function topGenres(records: SinkRecord[], limit = 12): string[] {
  const counts = new Map<string, number>()
  for (const r of records) {
    for (const g of r.soak?.genres ?? []) {
      const key = g.trim().toLowerCase()
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([g]) => g)
}

export function ResultsPanel({
  stats,
  records,
  reportOnly,
  onReset,
}: {
  stats: WebStats
  records: SinkRecord[]
  reportOnly?: boolean
  onReset: () => void
}) {
  const [format, setFormat] = useState<Format>('csv')

  const downloadUrl = useMemo(() => {
    const content = generate(format, records)
    const mime = FORMATS.find((f) => f.id === format)?.mime ?? 'text/plain'
    return URL.createObjectURL(new Blob([content], { type: mime }))
  }, [format, records])

  const ext = FORMATS.find((f) => f.id === format)?.ext ?? 'csv'
  const qualityClass = stats.quality >= 80 ? 'green' : stats.quality >= 60 ? 'yellow' : 'red'

  const didSoak = stats.enriched != null
  const didSteep = stats.outletsScraped != null
  const genres = useMemo(() => (didSoak ? topGenres(records) : []), [didSoak, records])
  const platforms = useMemo(() => (didSoak ? platformBreakdown(records) : []), [didSoak, records])
  const intel = useMemo(
    () => records.filter((r) => !r.rinse?.duplicate && (r.soak || r.steep)),
    [records],
  )

  return (
    <section className="results" aria-label="Cleaning results">
      <div className="results-score">
        <span className={`score-number ${qualityClass}`}>{stats.quality}%</span>
        <span className="score-label dim">quality score</span>
      </div>

      <dl className="results-counts">
        <div className="count-item">
          <dt className="dim">Valid</dt>
          <dd className="green">✓ {stats.valid}</dd>
        </div>
        <div className="count-item">
          <dt className="dim">Risky</dt>
          <dd className="yellow">~ {stats.risky}</dd>
        </div>
        <div className="count-item">
          <dt className="dim">Invalid</dt>
          <dd className="red">✗ {stats.invalid}</dd>
        </div>
      </dl>

      {(stats.typos > 0 || stats.duplicates > 0) && (
        <p className="dim results-detail">
          {stats.typos > 0 && `Fixed ${stats.typos} typo${stats.typos === 1 ? '' : 's'}`}
          {stats.typos > 0 && stats.duplicates > 0 && ' · '}
          {stats.duplicates > 0 &&
            `Merged ${stats.duplicates} duplicate${stats.duplicates === 1 ? '' : 's'}`}
        </p>
      )}

      {didSoak && (
        <div className="results-section">
          <h3 className="results-h">
            AI enrichment{' '}
            <span className="dim">
              · {stats.enriched} enriched
              {stats.enrichFailed ? `, ${stats.enrichFailed} failed` : ''}
            </span>
          </h3>
          {platforms.length > 0 && (
            <p className="dim results-detail">
              {platforms.map(([t, n]) => `${n} ${t}`).join(' · ')}
            </p>
          )}
          {genres.length > 0 && (
            <div className="tag-cloud">
              {genres.map((g) => (
                <span key={g} className="tag">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {didSteep && (
        <div className="results-section">
          <h3 className="results-h">
            Outlet research{' '}
            <span className="dim">
              · {stats.outletsScraped} outlet{stats.outletsScraped === 1 ? '' : 's'}
            </span>
          </h3>
          <p className="dim results-detail">
            {stats.outletsWithPortal ?? 0} with a submission portal · {stats.contactsConfirmed ?? 0}{' '}
            contact{stats.contactsConfirmed === 1 ? '' : 's'} confirmed on-page
          </p>
        </div>
      )}

      {intel.length > 0 && (
        <div className="results-section">
          <h3 className="results-h">Per-contact intel</h3>
          <div className="intel-list">
            {intel.map((r) => (
              <details key={r.id} className="intel-item">
                <summary>
                  <span className="intel-id">
                    <span className="intel-name">{r.raw.name}</span>
                    {(r.scrub?.email.normalised || r.raw.email) && (
                      <span className="intel-email dim">
                        {r.scrub?.email.normalised || r.raw.email}
                      </span>
                    )}
                  </span>
                  <span className="dim intel-meta">
                    {[r.raw.outlet, r.soak?.platformType].filter(Boolean).join(' · ')}
                    {r.steep?.confirmedAtOutlet ? ' · confirmed' : ''}
                  </span>
                </summary>
                <div className="intel-body">
                  {r.soak?.genres?.length ? (
                    <div>
                      <span className="dim">Genres: </span>
                      {r.soak.genres.join(', ')}
                    </div>
                  ) : null}
                  {r.soak?.pitchTips?.length ? (
                    <div>
                      <span className="dim">Pitch tips: </span>
                      {r.soak.pitchTips.join('; ')}
                    </div>
                  ) : null}
                  {r.soak?.submissionGuidelines ? (
                    <div>
                      <span className="dim">Submit: </span>
                      {r.soak.submissionGuidelines}
                    </div>
                  ) : null}
                  {r.steep?.submissionPortalUrl ? (
                    <div>
                      <span className="dim">Portal: </span>
                      {r.steep.submissionPortalUrl}
                    </div>
                  ) : null}
                  {r.steep?.submissionEmail ? (
                    <div>
                      <span className="dim">Submissions email: </span>
                      {r.steep.submissionEmail}
                    </div>
                  ) : null}
                  {r.steep?.outletInstagram ? (
                    <div>
                      <span className="dim">Instagram: </span>
                      {r.steep.outletInstagram}
                    </div>
                  ) : null}
                  {r.steep?.pitchHooks?.length ? (
                    <div>
                      <span className="dim">Hooks: </span>
                      {r.steep.pitchHooks.join('; ')}
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {reportOnly ? (
        <div className="results-actions">
          <p className="dim">Report only — no file generated.</p>
          <button type="button" className="reset-button" onClick={onReset}>
            Run a full clean
          </button>
        </div>
      ) : (
        <div className="results-actions">
          <div className="format-selector" role="group" aria-label="Download format">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`format-button ${format === f.id ? 'active' : ''}`}
                aria-pressed={format === f.id}
                onClick={() => setFormat(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <a
            className="download-button"
            href={downloadUrl}
            download={`contacts-clean.${ext}`}
            aria-label={`Download cleaned ${ext.toUpperCase()} with ${stats.cleanCount} contacts`}
          >
            Download clean {ext.toUpperCase()} ({stats.cleanCount} contacts)
          </a>
          <button type="button" className="reset-button" onClick={onReset}>
            Try another file
          </button>
        </div>
      )}
    </section>
  )
}
