import type { SinkRecord, SinkConfig, PhaseProgress } from '../../types.js'
import { validateEmailBatch } from './validate.js'
import { loadTypoMap } from './typo-map.js'

export { parseCSV, parseRows } from './parse.js'
export { validateEmail, validateEmailBatch } from './validate.js'
export { loadTypoMap, getTypoMap, correctDomain } from './typo-map.js'

export async function scrub(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void,
): Promise<SinkRecord[]> {
  // Load typo map if custom path specified
  loadTypoMap(config.scrub.typoMap)

  // Extract emails from records
  const emails = records.map((r) => r.raw.email).filter((e): e is string => Boolean(e))

  // config.scrub.smtpTimeout is in SECONDS (per the docs and example config);
  // the validator works in milliseconds. Convert once here. Previously the raw
  // value was passed straight through, so the documented default of 10 became a
  // 10ms timeout -- every SMTP check timed out and silently fell back to a
  // "valid / medium confidence" verdict, making --smtp a no-op.
  const smtpTimeoutMs = (config.scrub.smtpTimeout ?? 10) * 1000

  // Validate batch
  const validationMap = await validateEmailBatch(emails, {
    smtp: config.scrub.smtp ?? false,
    smtpTimeout: smtpTimeoutMs,
    rolePrefixes: config.scrub.rolePrefixes,
    catchAllDomains: config.scrub.catchAllDomains,
    musicTLDs: config.scrub.musicTLDs,
    mxCacheTTL: config.scrub.mxCacheTTL,
    onProgress: (_email, _result, index, total) => {
      onProgress?.({ phase: 'scrub', current: index, total })
    },
  })

  // Map results onto records
  return records.map((record) => {
    if (!record.raw.email) {
      return {
        ...record,
        scrub: {
          email: {
            valid: false,
            normalised: '',
            reason: 'invalid_format',
            confidence: 'none' as const,
          },
        },
        phases: [...record.phases, 'scrub' as const],
      }
    }

    const result = validationMap.get(record.raw.email)
    if (!result) {
      return {
        ...record,
        scrub: {
          email: {
            valid: true,
            normalised: record.raw.email,
            confidence: 'low' as const,
          },
        },
        phases: [...record.phases, 'scrub' as const],
      }
    }

    return {
      ...record,
      scrub: { email: result },
      phases: [...record.phases, 'scrub' as const],
    }
  })
}
