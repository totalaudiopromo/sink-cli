import type { SinkRecord, SinkConfig, PhaseProgress } from '../../types.js';
import { validateEmailBatch } from './validate.js';
import { loadTypoMap } from './typo-map.js';

export { parseCSV, parseRows } from './parse.js';
export { validateEmail, validateEmailBatch } from './validate.js';
export { loadTypoMap, getTypoMap, correctDomain } from './typo-map.js';

export async function scrub(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void
): Promise<SinkRecord[]> {
  // Load typo map if custom path specified
  loadTypoMap(config.scrub.typoMap);

  // Extract emails from records
  const emails = records
    .map(r => r.raw.email)
    .filter((e): e is string => Boolean(e));

  // Validate batch
  const validationMap = await validateEmailBatch(emails, {
    smtp: config.scrub.smtp ?? false,
    smtpTimeout: config.scrub.smtpTimeout,
    rolePrefixes: config.scrub.rolePrefixes,
    catchAllDomains: config.scrub.catchAllDomains,
    musicTLDs: config.scrub.musicTLDs,
    mxCacheTTL: config.scrub.mxCacheTTL,
    onProgress: (_email, _result, index, total) => {
      onProgress?.({ phase: 'scrub', current: index, total });
    },
  });

  // Map results onto records
  return records.map(record => {
    if (!record.raw.email) {
      return {
        ...record,
        scrub: {
          email: {
            valid: true,
            normalised: '',
            confidence: 'none' as const,
          },
        },
        phases: [...record.phases, 'scrub' as const],
      };
    }

    const result = validationMap.get(record.raw.email);
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
      };
    }

    return {
      ...record,
      scrub: { email: result },
      phases: [...record.phases, 'scrub' as const],
    };
  });
}
