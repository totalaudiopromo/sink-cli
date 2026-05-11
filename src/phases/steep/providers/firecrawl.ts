import type { SteepScraper } from '../../../types.js'
import { SteepConfigError } from '../provider.js'

/**
 * Sub-paths to try when scraping an outlet. Missing pages are tolerated.
 * Order matters: homepage first (most likely to exist), then progressively
 * specific pages.
 */
const SUBPATHS = ['', '/about', '/contact', '/team', '/presenters', '/submit', '/submissions']

interface FirecrawlScrapeResponse {
  success?: boolean
  data?: {
    markdown?: string
    content?: string
    metadata?: { sourceURL?: string }
  }
}

export class FirecrawlScraper implements SteepScraper {
  name = 'firecrawl'
  private apiKey = ''
  private apiUrl = 'https://api.firecrawl.dev/v1/scrape'
  private timeoutMs = 15_000

  async init(config: Record<string, unknown>): Promise<void> {
    const apiKey = (config.apiKey as string) || process.env.FIRECRAWL_API_KEY
    if (!apiKey) {
      throw new SteepConfigError(
        'FIRECRAWL_API_KEY required for steep phase. Set in env or steep.firecrawl.apiKey config.',
      )
    }
    this.apiKey = apiKey
    if (config.apiUrl) this.apiUrl = config.apiUrl as string
    if (config.timeoutMs) this.timeoutMs = config.timeoutMs as number
  }

  async scrape(outletDomain: string): Promise<{ text: string; pagesFetched: string[] }> {
    if (!outletDomain.includes('.')) {
      // Not a real domain (slug fallback) -- skip web scrape
      return { text: '', pagesFetched: [] }
    }

    const baseUrl = `https://${outletDomain}`
    const fragments: string[] = []
    const pagesFetched: string[] = []

    for (const path of SUBPATHS) {
      const url = `${baseUrl}${path}`
      try {
        const fragment = await this.scrapeOne(url)
        if (fragment) {
          fragments.push(`---PAGE: ${url}---\n${fragment}`)
          pagesFetched.push(url)
        }
      } catch {
        // Tolerate per-page failures; we want best-effort coverage
      }
    }

    return { text: fragments.join('\n\n'), pagesFetched }
  }

  private async scrapeOne(url: string): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        return ''
      }

      const data = (await response.json()) as FirecrawlScrapeResponse
      const text = data?.data?.markdown ?? data?.data?.content ?? ''
      // Trim individual page contributions so we keep the prompt budget
      return text.slice(0, 4_000)
    } finally {
      clearTimeout(timer)
    }
  }
}
