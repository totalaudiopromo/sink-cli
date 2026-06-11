/**
 * Browser twin of net.ts (swapped in via the package.json "browser" field).
 *
 * MX verification via Cloudflare's DNS-over-HTTPS JSON API. Privacy note:
 * only the bare domain is transmitted — never the full email address — and
 * it goes to a DNS resolver, which is where domain lookups go anyway.
 * Failures, timeouts, and rate limits all degrade to "no MX", matching the
 * Node implementation's behaviour.
 */

const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query'

export async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=MX`
    const response = await fetch(url, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const data = (await response.json()) as { Answer?: unknown[] }
    return Array.isArray(data.Answer) && data.Answer.length > 0
  } catch {
    return false
  }
}
