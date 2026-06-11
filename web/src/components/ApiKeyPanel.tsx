import { useState } from 'react'
import type { ApiKeys } from '../types'

const STORE_ANTHROPIC = 'sink:anthropic'
const STORE_FIRECRAWL = 'sink:firecrawl'

function readStored(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

/**
 * Terminal-styled key entry, shown after rinse. Anthropic key unlocks soak
 * (AI enrichment); adding a Firecrawl key also unlocks steep (outlet research).
 * Keys live in memory only unless the user opts into sessionStorage.
 */
export function ApiKeyPanel({
  onRun,
  onSkip,
}: {
  onRun: (keys: ApiKeys) => void
  onSkip: () => void
}) {
  const storedAnthropic = readStored(STORE_ANTHROPIC)
  const storedFirecrawl = readStored(STORE_FIRECRAWL)
  const [anthropic, setAnthropic] = useState(storedAnthropic)
  const [firecrawl, setFirecrawl] = useState(storedFirecrawl)
  const [remember, setRemember] = useState(Boolean(storedAnthropic))
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    const a = anthropic.trim()
    const f = firecrawl.trim()
    if (!a) {
      setErr('An Anthropic key is required to run AI enrichment.')
      return
    }
    if (!a.startsWith('sk-ant-')) {
      setErr('That doesn’t look like an Anthropic key (expected sk-ant-…).')
      return
    }
    if (f && !f.startsWith('fc-')) {
      setErr('That doesn’t look like a Firecrawl key (expected fc-…).')
      return
    }
    try {
      if (remember) {
        sessionStorage.setItem(STORE_ANTHROPIC, a)
        if (f) sessionStorage.setItem(STORE_FIRECRAWL, f)
        else sessionStorage.removeItem(STORE_FIRECRAWL)
      } else {
        sessionStorage.removeItem(STORE_ANTHROPIC)
        sessionStorage.removeItem(STORE_FIRECRAWL)
      }
    } catch {
      // sessionStorage may be unavailable (private mode) — keys still work in-memory.
    }
    setErr(null)
    onRun({ anthropic: a, firecrawl: f || undefined })
  }

  return (
    <div className="keypanel" aria-label="API keys for AI enrichment">
      <p className="keypanel-title">
        <span className="cyan">◇</span> Run the AI phases?
      </p>
      <p className="dim keypanel-lead">
        Scrub &amp; rinse are done — locally. <span className="cyan">Soak</span> enriches each
        contact (genres, platform, pitch tips); <span className="cyan">steep</span> researches each
        outlet (submission portals, socials, recent coverage). Bring your own keys.
      </p>

      <label className="keypanel-field">
        <span>
          Anthropic API key <span className="dim">— for soak (required)</span>
        </span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={anthropic}
          onChange={(e) => setAnthropic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </label>

      <label className="keypanel-field">
        <span>
          Firecrawl API key <span className="dim">— for steep (optional)</span>
        </span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="fc-…"
          value={firecrawl}
          onChange={(e) => setFirecrawl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </label>

      <label className="keypanel-remember dim">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />{' '}
        Remember keys for this browser session
      </label>

      {err && <p className="red keypanel-error">{err}</p>}

      <div className="keypanel-actions">
        <button type="button" className="download-button" onClick={submit}>
          Run AI phases
        </button>
        <button type="button" className="reset-button" onClick={onSkip}>
          Skip — download clean CSV
        </button>
      </div>

      <p className="dim keypanel-privacy">
        Your keys stay in this browser and are never sent to our servers. Running the AI phases sends
        your contact data to <strong>Anthropic</strong>, and outlet pages to{' '}
        <strong>Firecrawl</strong> (via a thin open-source proxy, because Firecrawl blocks direct
        browser calls). Scrub &amp; rinse never leave your machine.
      </p>
    </div>
  )
}
