/**
 * Browser-safe input helpers.
 *
 * Pure-string utilities extracted from input.ts so the web app can reuse them
 * via the `datasink/core` entry without dragging in node:fs / chalk / process.
 * input.ts re-exports from here, so existing CLI imports keep working.
 */

/** Convert a Google Sheets share/edit URL to a CSV export URL */
export function toGoogleSheetsExportUrl(url: string): string {
  if (!url.includes('docs.google.com/spreadsheets/d/')) return url
  if (url.includes('/export?') || url.includes('/gviz/tq')) return url

  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) return url

  const id = idMatch[1]
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch ? `&gid=${gidMatch[1]}` : ''

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid}`
}
