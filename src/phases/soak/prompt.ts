import type { SinkRecord } from '../../types.js';

const ENRICHMENT_PROMPT = `You are a music industry contact enrichment assistant. Given a contact's details, provide structured enrichment data.

Contact:
- Name: {name}
- Email: {email}
- Outlet: {outlet}
- Role: {role}

Respond with valid JSON only (no markdown, no explanation):
{
  "platform": "name of the platform/outlet",
  "platformType": "radio" | "press" | "playlist" | "blog" | "podcast",
  "roleDetail": "more specific role description",
  "genres": ["genre1", "genre2"],
  "coverageArea": "geographic coverage description",
  "contactMethod": "preferred contact method",
  "bestTiming": "best time to pitch",
  "submissionGuidelines": "how to submit music",
  "pitchTips": ["tip1", "tip2"],
  "geographicScope": "national" | "regional" | "local"
}

If you don't have confident information for a field, omit it. Only include fields you're reasonably sure about.`;

export function buildPrompt(record: SinkRecord): string {
  return ENRICHMENT_PROMPT
    .replace('{name}', record.raw.name)
    .replace('{email}', record.scrub?.email.normalised || record.raw.email || 'unknown')
    .replace('{outlet}', record.raw.outlet || 'unknown')
    .replace('{role}', record.raw.role || 'unknown');
}

const KEY_FIELDS = ['platform', 'platformType', 'genres', 'coverageArea', 'pitchTips'] as const;

export function calculateConfidence(data: Record<string, unknown>): 'high' | 'medium' | 'low' {
  const populated = KEY_FIELDS.filter(f => {
    const val = data[f];
    if (val === undefined || val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }).length;

  if (populated === KEY_FIELDS.length) return 'high';
  if (populated >= 2) return 'medium';
  return 'low';
}
