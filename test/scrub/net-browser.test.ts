import { describe, it, expect, vi, afterEach } from 'vitest'
import { hasMxRecord } from '../../src/phases/scrub/net.browser.js'

function mockFetch(impl: (url: string) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('net.browser hasMxRecord (DNS-over-HTTPS)', () => {
  it('returns true when the DoH response has MX answers', async () => {
    mockFetch(async () =>
      Response.json({ Status: 0, Answer: [{ name: 'gmail.com.', type: 15, data: '10 smtp.x.' }] }),
    )
    expect(await hasMxRecord('gmail.com')).toBe(true)
  })

  it('returns false when there are no answers (NOERROR, empty)', async () => {
    mockFetch(async () => Response.json({ Status: 0 }))
    expect(await hasMxRecord('no-mx.example')).toBe(false)
  })

  it('returns false on NXDOMAIN-style empty answer arrays', async () => {
    mockFetch(async () => Response.json({ Status: 3, Answer: [] }))
    expect(await hasMxRecord('nxdomain.invalid')).toBe(false)
  })

  it('returns false on HTTP errors (e.g. rate limiting)', async () => {
    mockFetch(async () => new Response('slow down', { status: 429 }))
    expect(await hasMxRecord('gmail.com')).toBe(false)
  })

  it('returns false when fetch rejects (offline)', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await hasMxRecord('gmail.com')).toBe(false)
  })

  it('queries cloudflare-dns.com with the dns-json accept header', async () => {
    const spy = vi.fn(async () => Response.json({ Status: 0, Answer: [{}] }))
    vi.stubGlobal('fetch', spy)
    await hasMxRecord('bbc.co.uk')
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('https://cloudflare-dns.com/dns-query')
    expect(url).toContain('name=bbc.co.uk')
    expect(url).toContain('type=MX')
    expect((init.headers as Record<string, string>).accept).toBe('application/dns-json')
  })
})
