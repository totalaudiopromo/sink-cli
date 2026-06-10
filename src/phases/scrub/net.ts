/**
 * Network-dependent checks for the scrub phase.
 *
 * Kept in a separate module so the rest of the validator stays pure
 * (browser-safe). Everything Node-only lives here; tests mock this module
 * instead of performing real DNS lookups.
 *
 * SMTP mailbox verification (RCPT-TO probing) was deliberately removed in
 * 0.3.0: major providers return misleading accept responses to defeat probing,
 * outbound port 25 is blocked in most environments, and the previous
 * implementation never functioned. If real demand appears, reintroduce it here
 * behind the same seam.
 */

import { resolveMx } from 'node:dns/promises'

/**
 * True when the domain publishes at least one MX record.
 * DNS failures (NXDOMAIN, timeouts, no records) all count as "no MX".
 */
export async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain)
    return records.length > 0
  } catch {
    return false
  }
}
