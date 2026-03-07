import type { SoakProvider, SoakResult, SinkRecord } from '../../../types.js';

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

If you don't have confident information for a field, omit it.`;

function buildPrompt(record: SinkRecord): string {
  return ENRICHMENT_PROMPT
    .replace('{name}', record.raw.name)
    .replace('{email}', record.scrub?.email.normalised || record.raw.email || 'unknown')
    .replace('{outlet}', record.raw.outlet || 'unknown')
    .replace('{role}', record.raw.role || 'unknown');
}

export class OpenAIProvider implements SoakProvider {
  name = 'openai';
  private client: any = null;
  private model = 'gpt-4o-mini';

  async init(config: Record<string, unknown>): Promise<void> {
    const apiKey = (config.apiKey as string) || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY required for soak phase');

    const { default: OpenAI } = await import('openai');
    this.client = new OpenAI({ apiKey });
    if (config.model) this.model = config.model as string;
  }

  async enrich(record: SinkRecord): Promise<SoakResult> {
    const prompt = buildPrompt(record);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '';

    try {
      const data = JSON.parse(text);
      return {
        provider: 'openai',
        platform: data.platform,
        platformType: data.platformType,
        roleDetail: data.roleDetail,
        genres: data.genres,
        coverageArea: data.coverageArea,
        contactMethod: data.contactMethod,
        bestTiming: data.bestTiming,
        submissionGuidelines: data.submissionGuidelines,
        pitchTips: data.pitchTips,
        geographicScope: data.geographicScope,
        confidence: 'medium',
      };
    } catch {
      return {
        provider: 'openai',
        confidence: 'low',
        reasoning: 'Failed to parse enrichment response',
      };
    }
  }

  async enrichBatch(
    records: SinkRecord[],
    onProgress?: (i: number) => void
  ): Promise<SoakResult[]> {
    const results: SoakResult[] = [];
    for (let i = 0; i < records.length; i++) {
      try {
        const result = await this.enrich(records[i]);
        results.push(result);
      } catch (err) {
        results.push({
          provider: 'openai',
          confidence: 'low',
          reasoning: err instanceof Error ? err.message : 'Enrichment failed',
        });
      }
      onProgress?.(i + 1);
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return results;
  }

  async dispose(): Promise<void> {
    this.client = null;
  }
}
