import type { SinkRecord, SinkConfig, PhaseProgress } from '../../types.js';
import { getProvider } from './registry.js';

export async function soak(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void
): Promise<SinkRecord[]> {
  const providerName = config.soak.provider;
  const provider = await getProvider(providerName);

  // Init with provider-specific config
  const providerConfig = (config.soak[providerName] as Record<string, unknown>) ?? {};
  await provider.init(providerConfig);

  // Filter to only enrichable records (valid email, not duplicate)
  const enrichable: { index: number; record: SinkRecord }[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const hasValidEmail = r.scrub ? r.scrub.email.valid : Boolean(r.raw.email);
    const isDuplicate = r.rinse?.duplicate ?? false;
    if (hasValidEmail && !isDuplicate) {
      enrichable.push({ index: i, record: r });
    }
  }

  const result = [...records];

  if (provider.enrichBatch) {
    const soakResults = await provider.enrichBatch(
      enrichable.map(e => e.record),
      (i) => {
        onProgress?.({
          phase: 'soak',
          current: i,
          total: enrichable.length,
          record: enrichable[i - 1]?.record,
        });
      }
    );

    for (let i = 0; i < enrichable.length; i++) {
      result[enrichable[i].index] = {
        ...result[enrichable[i].index],
        soak: soakResults[i],
      };
    }
  } else {
    for (let i = 0; i < enrichable.length; i++) {
      try {
        const soakResult = await provider.enrich(enrichable[i].record);
        result[enrichable[i].index] = {
          ...result[enrichable[i].index],
          soak: soakResult,
        };
      } catch {
        // Skip failed enrichments
      }
      onProgress?.({
        phase: 'soak',
        current: i + 1,
        total: enrichable.length,
        record: enrichable[i].record,
      });
    }
  }

  await provider.dispose?.();

  // Mark phase on all records
  return result.map(r => ({
    ...r,
    phases: r.phases.includes('soak') ? r.phases : [...r.phases, 'soak' as const],
  }));
}
