// Pipeline
export { runPipeline } from './pipeline.js';
export { loadConfig } from './config.js';

// Output
export { generateCSV } from './output/csv.js';
export { generateJSON, generateJSONL } from './output/json.js';
export { drain, parseInput, formatOutput, detectFormat } from './output/drain.js';

// Phases
export { parseCSV, parseRows } from './phases/scrub/parse.js';

// Types
export type {
  SinkRecord,
  RawRecord,
  ScrubResult,
  RinseResult,
  SoakResult,
  SinkStats,
  SinkConfig,
  Phase,
  PhaseProgress,
  SoakProvider,
} from './types.js';
