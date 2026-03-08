import type {
  SinkRecord,
  SinkConfig,
  PhaseProgress,
} from '../../types.js';
import { exactDedup } from './exact-dedup.js';
import { fuzzyMatch } from './fuzzy-match.js';
import { crossFieldMatch } from './identity.js';

type Strategy = 'exact-email' | 'fuzzy-name' | 'cross-field';

const strategyRunners: Record<
  Strategy,
  (records: SinkRecord[], config: SinkConfig) => SinkRecord[]
> = {
  'exact-email': (records) => exactDedup(records),
  'fuzzy-name': (records, config) =>
    fuzzyMatch(records, config.rinse.fuzzyThreshold),
  'cross-field': (records) => crossFieldMatch(records),
};

export async function rinse(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void,
): Promise<SinkRecord[]> {
  const strategies = (config.rinse.strategies ?? [
    'exact-email',
    'fuzzy-name',
    'cross-field',
  ]).filter((s): s is Strategy => s in strategyRunners);
  let current = records;

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const runner = strategyRunners[strategy];
    if (runner) {
      current = runner(current, config);
      onProgress?.({
        phase: 'rinse',
        current: i + 1,
        total: strategies.length,
        message: `${strategy} complete`,
      });
    }
  }

  // Mark phase on all records
  return current.map((r) => ({
    ...r,
    phases: r.phases.includes('rinse')
      ? r.phases
      : [...r.phases, 'rinse' as const],
  }));
}
