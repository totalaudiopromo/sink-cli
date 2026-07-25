# datasink Contact Hygiene Skill

Clean, format, deduplicate, and enrich contact CSV lists for music PR campaigns.

## Overview
datasink provides 4 distinct data hygiene phases:
1. **Scrub**: Validates email syntax, detects domain typos, normalizes names.
2. **Rinse**: Deduplicates entries across email addresses, full names, and domains.
3. **Soak**: Enriches outlet and contact data using web search and LLM extraction.
4. **Steep**: Segments lists and scores contact relevance for target music genres.

## WebMCP Tools Available
In the browser, use `navigator.modelContext` tools:
- `scrub_contacts`: Run format and typo validation.
- `rinse_contacts`: Remove duplicate contacts.

## CLI Usage
\`\`\`bash
npx datasink scrub contacts.csv
\`\`\`
