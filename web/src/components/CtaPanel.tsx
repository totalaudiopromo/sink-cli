export function CtaPanel() {
  return (
    <section className="cta" aria-label="About sink">
      <div className="cta-block">
        <h2>Prefer the terminal?</h2>
        <p className="dim">
          Same four phases, no key-pasting — point the CLI at a file and it reads keys from your
          environment.
        </p>
        <pre className="snippet">
          <code>
            <span className="dim">$ </span>npx datasink wash contacts.csv
          </code>
        </pre>
        <p className="dim npm-note">
          sink is published on npm as <span className="cyan">datasink</span> — the short name was
          taken.
        </p>
        <a
          className="text-link"
          href="https://github.com/totalaudiopromo/sink-cli"
          rel="noopener noreferrer"
        >
          github.com/totalaudiopromo/sink-cli →
        </a>
      </div>

      <div className="cta-block">
        <h2>Doing this at scale?</h2>
        <p className="dim">
          sink keeps one list clean. TAP runs the whole campaign — enriched contacts, submission
          tracking, and coverage monitoring for music promotion.
        </p>
        <a className="tap-link" href="https://totalaudiopromo.com" rel="noopener noreferrer">
          totalaudiopromo.com →
        </a>
      </div>

      <footer className="footer dim">
        Part of <a href="https://totalaudiopromo.com">Total Audio Promo</a> · Built by{' '}
        <a href="https://x.com/chrisschouk">Chris Schofield</a> · Fictional demo data
      </footer>
    </section>
  )
}
