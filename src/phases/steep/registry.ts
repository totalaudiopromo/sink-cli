import type { SteepScraper } from '../../types.js'

const scrapers = new Map<string, () => Promise<SteepScraper>>()

export function registerScraper(name: string, factory: () => Promise<SteepScraper>): void {
  scrapers.set(name, factory)
}

export async function getScraper(name: string): Promise<SteepScraper> {
  const factory = scrapers.get(name)
  if (!factory) {
    throw new Error(
      `Steep scraper '${name}' not found. Available: ${[...scrapers.keys()].join(', ')}`,
    )
  }
  return factory()
}

registerScraper('firecrawl', async () => {
  const { FirecrawlScraper } = await import('./providers/firecrawl.js')
  return new FirecrawlScraper()
})
