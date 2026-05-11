// Pipeline
export { runPipeline } from './pipeline.js';
export { loadConfig } from './config.js';

// Output
export { generateCSV } from './output/csv.js';
export { generateJSON, generateJSONL } from './output/json.js';
export { drain, parseInput, formatOutput, detectFormat } from './output/drain.js';

// Phases (also exposed individually so consumers can compose)
export { parseCSV, parseRows } from './phases/scrub/parse.js';
export { scrub } from './phases/scrub/index.js';
export { rinse } from './phases/rinse/index.js';
export { soak } from './phases/soak/index.js';
export { steep } from './phases/steep/index.js';

// Steep cache adapter (consumers can implement against the CacheAdapter interface)
export { InMemoryCache } from './phases/steep/cache/in-memory.js';
export { outletToDomain } from './phases/steep/provider.js';

// Types
export type {
  SinkRecord,
  RawRecord,
  ScrubResult,
  RinseResult,
  SoakResult,
  SteepResult,
  SteepScraper,
  CacheAdapter,
  ChannelConfidence,
  SubmissionFormat,
  SinkStats,
  SinkConfig,
  Phase,
  PhaseProgress,
  SoakProvider,
} from './types.js';
