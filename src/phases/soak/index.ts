import type { SinkRecord, SinkConfig, PhaseProgress } from '../../types.js'
import { getProvider } from './registry.js'
import { SoakConfigError } from './provider.js'

function markSoakPhase(records: SinkRecord[]): SinkRecord[] {
  return records.map((r) => ({
    ...r,
    phases: r.phases.includes('soak') ? r.phases : [...r.phases, 'soak' as const],
  }))
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export async function soak(
  records: SinkRecord[],
  config: SinkConfig,
  onProgress?: (progress: PhaseProgress) => void,
): Promise<SinkRecord[]> {
  const providerName = config.soak.provider
  const provider = await getProvider(providerName)
  const rateLimit = config.soak.rateLimit ?? 200
  const maxRetries = config.soak.maxRetries ?? 3

  const providerConfig = (config.soak[providerName] as Record<string, unknown>) ?? {}
  try {
    await provider.init(providerConfig)
  } catch (err) {
    if (err instanceof SoakConfigError) {
      console.warn(`  Skipping soak: ${err.message}`)
      return records
    }
    throw err
  }

  const enrichable: { index: number; record: SinkRecord }[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const hasValidEmail = r.scrub ? r.scrub.email.valid : Boolean(r.raw.email)
    const isDuplicate = r.rinse?.duplicate ?? false
    if (hasValidEmail && !isDuplicate) {
      enrichable.push({ index: i, record: r })
    }
  }

  const result = [...records]
  let failed = 0

  // Use ora for progress if available
  let spinner: { text: string; succeed: (t: string) => void; fail: (t: string) => void } | null =
    null
  try {
    const ora = (await import('ora')).default
    spinner = ora({ text: `Enriching 0/${enrichable.length} contacts...`, spinner: 'dots' }).start()
  } catch {
    // ora not available, fall back to progress callback only
  }

  const soakStart = Date.now()

  for (let i = 0; i < enrichable.length; i++) {
    try {
      const soakResult = await withRetry(
        () => provider.enrich(enrichable[i].record),
        maxRetries,
        1000,
      )
      result[enrichable[i].index] = {
        ...result[enrichable[i].index],
        soak: soakResult,
      }
    } catch (err) {
      failed++
      const reason = err instanceof Error ? err.message : 'Enrichment failed'
      console.warn(`  Warning: enrichment failed for ${enrichable[i].record.raw.name}: ${reason}`)
      result[enrichable[i].index] = {
        ...result[enrichable[i].index],
        soak: {
          provider: providerName,
          confidence: 'none',
          reasoning: reason,
        },
      }
    }

    if (spinner) {
      const done = i + 1
      const remaining = enrichable.length - done
      let eta = ''
      if (done >= 2 && remaining > 0) {
        const avgMs = (Date.now() - soakStart) / done
        const remainSecs = Math.ceil((avgMs * remaining) / 1000)
        eta = ` (est. ${remainSecs}s remaining)`
      }
      spinner.text = `Enriching ${done}/${enrichable.length} contacts...${eta}`
    }
    onProgress?.({
      phase: 'soak',
      current: i + 1,
      total: enrichable.length,
      record: enrichable[i].record,
    })

    // Rate limit between requests
    if (i < enrichable.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, rateLimit))
    }
  }

  if (spinner) {
    if (failed > 0) {
      spinner.fail(
        `Enriched ${enrichable.length - failed}/${enrichable.length} contacts (${failed} failed)`,
      )
    } else {
      spinner.succeed(`Enriched ${enrichable.length} contacts`)
    }
  }

  await provider.dispose?.()

  return markSoakPhase(result)
}
