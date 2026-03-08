import type {
  Phase,
  PhaseProgress,
  SinkConfig,
  SinkRecord,
  SinkStats,
} from './types.js';

type PhaseRunner = (
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void
) => Promise<SinkRecord[]>;

const phaseRunners: Record<Phase, PhaseRunner | null> = {
  scrub: null,
  rinse: null,
  soak: null,
};

/**
 * Register a phase runner. Called by each phase module on import.
 */
export function registerPhase(phase: Phase, runner: PhaseRunner): void {
  phaseRunners[phase] = runner;
}

/**
 * Lazily load phase runners on first use.
 */
async function ensurePhase(phase: Phase): Promise<PhaseRunner> {
  if (phaseRunners[phase]) return phaseRunners[phase];

  switch (phase) {
    case 'scrub': {
      const mod = await import('./phases/scrub/index.js');
      registerPhase('scrub', mod.scrub);
      break;
    }
    case 'rinse': {
      const mod = await import('./phases/rinse/index.js');
      registerPhase('rinse', mod.rinse);
      break;
    }
    case 'soak': {
      const mod = await import('./phases/soak/index.js');
      registerPhase('soak', mod.soak);
      break;
    }
  }

  const runner = phaseRunners[phase];
  if (!runner) throw new Error(`Phase '${phase}' not found`);
  return runner;
}

export interface PipelineOptions {
  phases: Phase[];
  config: SinkConfig;
  onProgress?: (phase: Phase, progress: PhaseProgress) => void;
}

/**
 * Compute aggregate stats from processed records.
 */
function computeStats(records: SinkRecord[], durationMs: number): SinkStats {
  const stats: SinkStats = {
    total: records.length,
    scrub: { valid: 0, invalid: 0, risky: 0, typos: 0, domains: 0 },
    rinse: { duplicates: 0, merged: 0, fuzzyMatches: 0 },
    soak: { enriched: 0, failed: 0, skipped: 0 },
    duration: durationMs,
  };

  const domains = new Set<string>();

  for (const record of records) {
    if (record.scrub) {
      const { email } = record.scrub;
      if (!email.valid) {
        stats.scrub.invalid++;
      } else if (email.confidence === 'medium') {
        stats.scrub.risky++;
      } else {
        stats.scrub.valid++;
      }
      if (email.corrected) stats.scrub.typos++;
      const atIdx = email.normalised.indexOf('@');
      if (atIdx !== -1) domains.add(email.normalised.slice(atIdx + 1));
    }

    if (record.rinse) {
      if (record.rinse.duplicate) stats.rinse.duplicates++;
      if (record.rinse.mergedWith) stats.rinse.merged++;
      if (record.rinse.matchType === 'fuzzy-name') stats.rinse.fuzzyMatches++;
    }

    if (record.phases.includes('soak')) {
      if (record.soak && record.soak.confidence !== 'none') {
        stats.soak.enriched++;
      } else if (record.scrub?.email.valid === false || record.rinse?.duplicate) {
        stats.soak.skipped++;
      } else {
        stats.soak.failed++;
      }
    }
  }

  stats.scrub.domains = domains.size;
  return stats;
}

/**
 * Run the processing pipeline across specified phases.
 */
export async function runPipeline(
  records: SinkRecord[],
  options: PipelineOptions
): Promise<{ records: SinkRecord[]; stats: SinkStats }> {
  const start = Date.now();
  let current = records;

  for (const phase of options.phases) {
    const runner = await ensurePhase(phase);
    current = await runner(current, options.config, (progress) => {
      options.onProgress?.(phase, progress);
    });
  }

  const duration = Date.now() - start;
  return { records: current, stats: computeStats(current, duration) };
}
