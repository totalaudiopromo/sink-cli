export const config = {
  matcher: ['/', '/index.html'],
}

export default function middleware(request: Request): Response | void {
  const accept = request.headers.get('accept') || ''
  if (accept.includes('text/markdown')) {
    const markdownContent = `# datasink.dev — Data Hygiene for Music PR

sink scrubs, rinses, soaks, and steeps your contact lists.

## Overview
datasink is a data hygiene CLI and web application built for music PR and press lists.
It cleans formatting errors, deduplicates entries across fields, enriches contact metadata, and segments list relevance.

## Core Capabilities
- **Scrub**: Format validation, email syntax checking, domain syntax checks, and typo mapping.
- **Rinse**: Multi-field deduplication by email, name, and publication domain.
- **Soak**: Contact enrichment via LLM queries and outlet metadata extraction.
- **Steep**: AI-assisted list segmenting and campaign relevance scoring.

## Getting Started
CLI installation:
\`\`\`bash
npx datasink scrub contacts.csv
\`\`\`

## Agent Discovery & Endpoints
- Web App: https://datasink.dev
- API Catalog: https://datasink.dev/.well-known/api-catalog
- ChatGPT Plugin Manifest: https://datasink.dev/.well-known/ai-plugin.json
- Extended LLM Spec: https://datasink.dev/llms-full.txt
- Standard LLM Doc: https://datasink.dev/llms.txt
- MCP Server Card: https://datasink.dev/.well-known/mcp/server-card.json
- Agent Skills Index: https://datasink.dev/.well-known/agent-skills/index.json
- Agent Auth: https://datasink.dev/auth.md
- Security Policy: https://datasink.dev/.well-known/security.txt
`

    return new Response(markdownContent, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'x-markdown-tokens': '210',
        'cache-control': 'public, max-age=3600',
      },
    })
  }
}
