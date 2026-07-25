/**
 * WebMCP integration — exposes site tools to AI agents via the browser modelContext API.
 * https://webmachinelearning.github.io/webmcp/
 */

import { validateEmail, MxCache } from 'datasink/core'

interface WebMcpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, any>) => Promise<unknown>
}

interface ModelContextAPI {
  registerTool?: (tool: WebMcpTool) => void
  provideContext?: (tool: WebMcpTool) => void
}

export function initWebMcp(): void {
  if (typeof window === 'undefined') return

  const nav = navigator as unknown as { modelContext?: ModelContextAPI }
  if (!nav.modelContext) return

  const register = nav.modelContext.registerTool?.bind(nav.modelContext) ?? nav.modelContext.provideContext?.bind(nav.modelContext)
  if (typeof register !== 'function') return

  try {
    // Tool 1: scrub_contacts
    register({
      name: 'scrub_contacts',
      description: 'Validate and scrub contact email addresses for syntax, typos, disposable domains, and role accounts.',
      inputSchema: {
        type: 'object',
        properties: {
          emails: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of email addresses to scrub and validate.',
          },
        },
        required: ['emails'],
      },
      execute: async (args: { emails?: string[] }) => {
        const emails = args.emails ?? []
        const cache = new MxCache()
        const results = await Promise.all(
          emails.map(async (email) => {
            const res = await validateEmail(email, { mxCache: cache })
            return {
              original: email,
              valid: res.valid,
              normalised: res.normalised,
              corrected: res.corrected,
              confidence: res.confidence,
              disposable: res.disposable,
              roleBased: res.roleBased,
              catchAll: res.catchAll,
            }
          }),
        )
        return { success: true, count: results.length, results }
      },
    })

    // Tool 2: get_api_catalog
    register({
      name: 'get_api_catalog',
      description: 'Get the machine-readable API catalog metadata for datasink services.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        return {
          catalogUrl: 'https://datasink.dev/.well-known/api-catalog',
          openApiUrl: 'https://datasink.dev/docs/openapi.json',
          mcpServerCard: 'https://datasink.dev/.well-known/mcp/server-card.json',
          agentSkillsIndex: 'https://datasink.dev/.well-known/agent-skills/index.json',
          authMd: 'https://datasink.dev/auth.md',
        }
      },
    })
  } catch (err) {
    console.warn('WebMCP tool registration warning:', err)
  }
}
