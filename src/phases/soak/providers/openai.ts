import type { SoakProvider, SoakResult, SinkRecord } from '../../../types.js'
import { SoakConfigError } from '../provider.js'
import { buildPrompt, calculateConfidence } from '../prompt.js'

export class OpenAIProvider implements SoakProvider {
  name = 'openai'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lazy-loaded SDK
  private client: any = null
  private model = 'gpt-4o-mini'

  async init(config: Record<string, unknown>): Promise<void> {
    const apiKey = (config.apiKey as string) || process.env.OPENAI_API_KEY
    if (!apiKey) throw new SoakConfigError('OPENAI_API_KEY required for soak phase')

    const { default: OpenAI } = await import('openai')
    this.client = new OpenAI({ apiKey })
    if (config.model) this.model = config.model as string
  }

  async enrich(record: SinkRecord): Promise<SoakResult> {
    const prompt = buildPrompt(record)

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content ?? ''

    try {
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
      const data = JSON.parse(cleaned)
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
        confidence: calculateConfidence(data),
      }
    } catch {
      return {
        provider: 'openai',
        confidence: 'none',
        reasoning: 'Failed to parse enrichment response',
      }
    }
  }

  async enrichBatch(
    records: SinkRecord[],
    onProgress?: (i: number) => void,
  ): Promise<SoakResult[]> {
    const results: SoakResult[] = []
    for (let i = 0; i < records.length; i++) {
      try {
        const result = await this.enrich(records[i])
        results.push(result)
      } catch (err) {
        results.push({
          provider: 'openai',
          confidence: 'low',
          reasoning: err instanceof Error ? err.message : 'Enrichment failed',
        })
      }
      onProgress?.(i + 1)
      if (i < records.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }
    return results
  }

  async dispose(): Promise<void> {
    this.client = null
  }
}
