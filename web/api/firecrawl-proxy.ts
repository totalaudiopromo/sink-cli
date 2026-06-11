/**
 * Thin Firecrawl proxy — the ONLY server-side code in sink web.
 *
 * Firecrawl's REST API blocks browser CORS, so a single outlet scrape is
 * forwarded here. The user's Firecrawl key arrives in the request body, is used
 * once for the upstream call, and is never logged or stored. Everything else in
 * sink web runs in the browser.
 *
 * Source is intentionally tiny and open — see github.com/totalaudiopromo/sink-cli.
 */

export const config = { runtime: 'edge' }

const FIRECRAWL_URL = 'https://api.firecrawl.dev/v1/scrape'
const TIMEOUT_MS = 15_000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let payload: { url?: string; firecrawlKey?: string }
  try {
    payload = (await req.json()) as { url?: string; firecrawlKey?: string }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { url, firecrawlKey } = payload
  if (!url || !/^https:\/\//i.test(url)) return json({ error: 'A https url is required' }, 400)
  if (!firecrawlKey || !firecrawlKey.startsWith('fc-')) {
    return json({ error: 'A Firecrawl key (fc-…) is required' }, 400)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const upstream = await fetch(FIRECRAWL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      signal: controller.signal,
    })

    if (!upstream.ok) {
      // Surface auth failures so the UI can prompt for a valid key; treat other
      // upstream errors as an empty (skippable) scrape.
      if (upstream.status === 401 || upstream.status === 403) {
        return json({ error: 'Firecrawl rejected the key' }, 401)
      }
      return json({ markdown: '' }, 200)
    }

    const data = (await upstream.json()) as {
      data?: { markdown?: string; content?: string }
    }
    return json({ markdown: data?.data?.markdown ?? data?.data?.content ?? '' })
  } catch {
    return json({ markdown: '' }, 200)
  } finally {
    clearTimeout(timer)
  }
}
