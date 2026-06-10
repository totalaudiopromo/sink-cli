import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the options handed to validateEmailBatch so we can assert the
// seconds -> milliseconds conversion the scrub phase performs.
const batchSpy = vi.fn(async () => new Map())

vi.mock('../../src/phases/scrub/validate.js', async (importActual) => {
  const actual = await importActual<typeof import('../../src/phases/scrub/validate.js')>()
  return { ...actual, validateEmailBatch: batchSpy }
})

const { scrub } = await import('../../src/phases/scrub/index.js')
const { loadConfig } = await import('../../src/config.js')

describe('scrub smtpTimeout conversion', () => {
  beforeEach(() => batchSpy.mockClear())

  it('converts the default 10s config to 10000ms for the validator', async () => {
    const config = await loadConfig()
    config.scrub.smtp = true
    await scrub([], config)

    expect(batchSpy).toHaveBeenCalledTimes(1)
    const opts = batchSpy.mock.calls[0][1] as { smtpTimeout: number }
    expect(opts.smtpTimeout).toBe(10_000)
  })

  it('converts a custom seconds value to milliseconds', async () => {
    const config = await loadConfig()
    config.scrub.smtp = true
    config.scrub.smtpTimeout = 5
    await scrub([], config)

    const opts = batchSpy.mock.calls[0][1] as { smtpTimeout: number }
    expect(opts.smtpTimeout).toBe(5_000)
  })
})
