export type RunStatus = 'idle' | 'running' | 'done'

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
}
