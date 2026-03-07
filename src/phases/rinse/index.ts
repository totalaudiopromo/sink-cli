import type {
  SinkRecord,
  SinkConfig,
  PhaseProgress,
} from '../../types.js';
import { exactDedup } from './exact-dedup.js';
import { fuzzyMatch } from './fuzzy-match.js';
import { domainCluster, crossFieldMatch } from './identity.js';

type Strategy =
  | 'exact-email'
  | 'fuzzy-name'
  | 'domain-cluster'
  | 'cross-field';

const strategyRunners: Record<
  Strategy,
  (records: SinkRecord[], config: SinkConfig) => SinkRecord[]
> = {
  'exact-email': (records) => exactDedup(records),
  'fuzzy-name': (records, config) =>
    fuzzyMatch(records, config.rinse.fuzzyThreshold),
  'domain-cluster': (records) => domainCluster(records),
  'cross-field': (records) => crossFieldMatch(records),
};

export async function rinse(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void,
): Promise<SinkRecord[]> {
  const strategies = config.rinse.strategies ?? [
    'exact-email',
    'fuzzy-name',
    'domain-cluster',
    'cross-field',
  ];
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
