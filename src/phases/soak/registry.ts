import type { SoakProvider } from './provider.js';

const providers = new Map<string, () => Promise<SoakProvider>>();

export function registerProvider(name: string, factory: () => Promise<SoakProvider>): void {
  providers.set(name, factory);
}

export async function getProvider(name: string): Promise<SoakProvider> {
  const factory = providers.get(name);
  if (!factory) {
    throw new Error(`Soak provider '${name}' not found. Available: ${[...providers.keys()].join(', ')}`);
  }
  return factory();
}

// Register built-in providers
registerProvider('anthropic', async () => {
  const { AnthropicProvider } = await import('./providers/anthropic.js');
  return new AnthropicProvider();
});

registerProvider('openai', async () => {
  const { OpenAIProvider } = await import('./providers/openai.js');
  return new OpenAIProvider();
});
