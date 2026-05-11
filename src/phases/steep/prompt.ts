/**
 * Grounded extraction prompt for steep phase.
 *
 * The prompt instructs the LLM to extract ONLY values present in the scraped text.
 * No guessing. Missing fields stay omitted. This is parser, not researcher.
 */

const STEEP_PROMPT = `You are a structured-data extractor for music PR research. You have been given the visible text of an outlet's public website (homepage, contact page, about page, team page, submissions page where available).

Your job: extract structured channel and submission information that is visibly present in the text. Never guess. Never invent. If a value is not stated in the text, omit the field.

Outlet name: {outletName}
Outlet domain: {outletDomain}
Names of contacts at this outlet (look for these on team / presenter pages): {contactNames}

Scraped text (truncated, separated by ---PAGE--- markers):
{scrapedText}

Respond with valid JSON only (no markdown, no commentary):
{
  "outletInstagram": "@handle or full URL",
  "outletTwitter": "@handle or full URL",
  "outletLinkedIn": "company-page URL",
  "outletFacebook": "page URL",
  "submissionPortalUrl": "URL of submission form / page",
  "submissionEmail": "submissions@... if listed",
  "submissionFormat": "mp3 | link | form | mixed",
  "recentPresenters": ["name1", "name2"],
  "recentCoverage": ["short snippet of recent coverage if visible"],
  "pitchHooks": ["specific, observable, one-line hooks pulled from the text. examples: 'submissions form requires ISRC', 'currently accepting unsigned indie artists', 'no submissions email - portal only'"],
  "contacts": {
    "Contact Name": {
      "role": "if their role is stated",
      "instagram": "@handle if visible next to their name",
      "linkedIn": "URL if visible next to their name",
      "twitter": "@handle if visible next to their name"
    }
  },
  "confidenceNotes": "one short sentence on how grounded these extractions are"
}

Rules:
- Only include fields where the value appears verbatim in the scraped text. Omit fields you cannot ground.
- Handles can be "@something" or full URLs. Both are acceptable.
- pitchHooks must be specific to this outlet (not generic music-PR advice).
- recentCoverage means a short factual snippet of what they have recently covered, if visible.
- The "contacts" object should only include names from the list provided that you found on the page. Do not include anyone else.
- Keep arrays short (max 5 items each).`

export function buildSteepPrompt(args: {
  outletName: string
  outletDomain: string
  contactNames: string[]
  scrapedText: string
}): string {
  return STEEP_PROMPT.replace('{outletName}', args.outletName)
    .replace('{outletDomain}', args.outletDomain)
    .replace('{contactNames}', args.contactNames.length ? args.contactNames.join(', ') : '(none)')
    .replace('{scrapedText}', args.scrapedText.slice(0, 24000))
}

interface OutletConfidenceInputs {
  hasPortalOrEmail: boolean
  hasOutletSocial: boolean
  pagesFetched: number
}

export function calculateOutletConfidence(
  args: OutletConfidenceInputs,
): 'high' | 'medium' | 'low' | 'none' {
  if (args.pagesFetched === 0) return 'none'
  const signals = [args.hasPortalOrEmail, args.hasOutletSocial, args.pagesFetched >= 2].filter(
    Boolean,
  ).length
  if (signals >= 3) return 'high'
  if (signals >= 1) return 'medium'
  return 'low'
}
