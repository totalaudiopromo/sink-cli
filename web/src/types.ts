import type { SinkRecord } from 'datasink/core'

export type RunStatus = 'idle' | 'running' | 'awaiting-keys' | 'done'

/** Which capabilities a run exercises. */
export type RunMode = 'full' | 'inspect' | 'spot'

export type TerminalLineKind =
  | 'blank'
  | 'logo'
  | 'plain'
  | 'step'
  | 'step-complete'
  | 'progress'
  | 'validation-row'
  | 'divider'
  | 'quality'
  | 'transform-summary'
  | 'transform-detail'
  | 'contact-row'
  | 'contact-dupe'
  | 'output-path'
  | 'outro'
  // AI phases
  | 'phase-header'
  | 'phase-gate'
  | 'soak-row'
  | 'soak-summary'
  | 'steep-row'
  | 'steep-summary'
  | 'key-error'
  | 'key-prompt'

export interface TerminalLine {
  id: string
  kind: TerminalLineKind
  /** When true, this line replaces the previous visible line (spinner-style). */
  replace?: boolean
  data: Record<string, string | number | boolean | undefined>
}

export interface WebStats {
  total: number
  valid: number
  risky: number
  invalid: number
  typos: number
  duplicates: number
  quality: number
  durationMs: number
  cleanCount: number
  /** Soak phase (present only when AI enrichment ran). */
  enriched?: number
  enrichFailed?: number
  /** Steep phase (present only when outlet research ran). */
  outletsScraped?: number
  outletsWithPortal?: number
  contactsConfirmed?: number
}

/** BYO keys, held in memory only (optionally mirrored to sessionStorage). */
export interface ApiKeys {
  anthropic?: string
  firecrawl?: string
}

/** The full record set after a run, surfaced to the results panel. */
export type { SinkRecord }
