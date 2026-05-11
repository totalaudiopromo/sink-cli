import type { SoakProvider, SoakResult, SinkRecord } from '../../../types.js'
import { SoakConfigError } from '../provider.js'
import { buildPrompt, calculateConfidence } from '../prompt.js'

const MODEL_ALIASES: Record<string, string> = {
  codex: 'codex-mini-latest',
  'gpt-4o-mini': 'gpt-4o-mini',
}

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
    if (config.model) {
      const alias = MODEL_ALIASES[config.model as string]
      this.model = alias ?? (config.model as string)
    }
  }

  async complete(prompt: string, opts?: { maxTokens?: number }): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: opts?.maxTokens ?? 512,
      response_format: { type: 'json_object' },
    })
    return response.choices[0]?.message?.content ?? ''
  }

  async enrich(record: SinkRecord): Promise<SoakResult> {
    const prompt = buildPrompt(record)
    const text = await this.complete(prompt, { maxTokens: 512 })

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

  async dispose(): Promise<void> {
    this.client = null
  }
}
