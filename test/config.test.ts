import { describe, it, expect, afterEach } from 'vitest'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, ConfigError, DEFAULT_CONFIG } from '../src/config.js'

const tmpFiles: string[] = []

function tmpFile(name: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'sink-config-'))
  const path = join(dir, name)
  writeFileSync(path, contents, 'utf-8')
  tmpFiles.push(dir)
  return path
}

afterEach(() => {
  for (const dir of tmpFiles.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('loadConfig', () => {
  it('returns defaults when no config file is present', async () => {
    const config = await loadConfig()
    expect(config.rinse.fuzzyThreshold).toBe(DEFAULT_CONFIG.rinse.fuzzyThreshold)
    expect(config.soak.provider).toBe(DEFAULT_CONFIG.soak.provider)
  })

  it('throws ConfigError when an explicit --config path does not exist', async () => {
    await expect(loadConfig({ configPath: '/no/such/sink.config.json' })).rejects.toBeInstanceOf(
      ConfigError,
    )
  })

  it('throws ConfigError when an explicit JSON config is malformed', async () => {
    const path = tmpFile('sink.config.json', '{ not valid json ]')
    await expect(loadConfig({ configPath: path })).rejects.toBeInstanceOf(ConfigError)
  })

  it('loads and merges a valid explicit JSON config over defaults', async () => {
    const path = tmpFile('sink.config.json', JSON.stringify({ rinse: { fuzzyThreshold: 0.8 } }))
    const config = await loadConfig({ configPath: path })
    expect(config.rinse.fuzzyThreshold).toBe(0.8)
    // Untouched defaults survive the merge.
    expect(config.soak.provider).toBe(DEFAULT_CONFIG.soak.provider)
  })

  it('applies CLI overrides on top of file config', async () => {
    const path = tmpFile('sink.config.json', JSON.stringify({ soak: { provider: 'openai' } }))
    const config = await loadConfig({
      configPath: path,
      overrides: { soak: { provider: 'anthropic' } },
    })
    expect(config.soak.provider).toBe('anthropic')
  })
})
