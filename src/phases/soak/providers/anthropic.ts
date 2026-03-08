import type { SoakProvider, SoakResult, SinkRecord } from '../../../types.js'
import { SoakConfigError } from '../provider.js'
import { buildPrompt, calculateConfidence } from '../prompt.js'

export class AnthropicProvider implements SoakProvider {
  name = 'anthropic'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lazy-loaded SDK
  private client: any = null
  private model = 'claude-haiku-4-5-20251001'

  async init(config: Record<string, unknown>): Promise<void> {
    const apiKey = (config.apiKey as string) || process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new SoakConfigError('ANTHROPIC_API_KEY required for soak phase')

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    this.client = new Anthropic({ apiKey })
    if (config.model) this.model = config.model as string
  }

  async enrich(record: SinkRecord): Promise<SoakResult> {
    const prompt = buildPrompt(record)

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    try {
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
      const data = JSON.parse(cleaned)
      return {
        provider: 'anthropic',
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
        provider: 'anthropic',
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
          provider: 'anthropic',
          confidence: 'low',
          reasoning: err instanceof Error ? err.message : 'Enrichment failed',
        })
      }
      onProgress?.(i + 1)
      // Simple rate limiting -- 200ms between requests
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
