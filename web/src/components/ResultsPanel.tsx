import { useMemo } from 'react'
import type { WebStats } from '../types'

export function ResultsPanel({
  stats,
  cleanCsv,
  onReset,
}: {
  stats: WebStats
  cleanCsv: string
  onReset: () => void
}) {
  const downloadUrl = useMemo(
    () => URL.createObjectURL(new Blob([cleanCsv], { type: 'text/csv' })),
    [cleanCsv],
  )

  const qualityClass = stats.quality >= 80 ? 'green' : stats.quality >= 60 ? 'yellow' : 'red'

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

      <div className="results-actions">
        <a
          className="download-button"
          href={downloadUrl}
          download="contacts-clean.csv"
          aria-label={`Download cleaned CSV with ${stats.cleanCount} contacts`}
        >
          Download clean CSV ({stats.cleanCount} contacts)
        </a>
        <button type="button" className="reset-button" onClick={onReset}>
          Try another file
        </button>
      </div>
    </section>
  )
}
