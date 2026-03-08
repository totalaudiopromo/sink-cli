/**
 * RFC 4180 CSV parser
 *
 * State-machine parser. Handles quoted fields containing commas, escaped
 * double-quotes, multiline fields, CRLF/LF, and UTF-8 BOM.
 */

import type { RawRecord } from '../../types.js';

const NAME_HEADERS = [
  'name', 'contact', 'contact name', 'full name', 'person',
  'artist', 'band', 'act', 'label', 'label name', 'sender', 'from',
];
const FIRST_NAME_HEADERS = ['first name', 'firstname', 'first', 'given name'];
const LAST_NAME_HEADERS = ['last name', 'lastname', 'last', 'surname', 'family name'];
const OUTLET_HEADERS = [
  'outlet',
  'publication',
  'media',
  'company',
  'organisation',
  'organization',
  'station',
  'platform',
  'source',
];
const EMAIL_HEADERS = ['email', 'e mail', 'email address', 'e-mail', 'contact email'];
const ROLE_HEADERS = ['role', 'title', 'position', 'job title', 'job'];
const PHONE_HEADERS = ['phone', 'phone number', 'telephone', 'mobile', 'tel', 'cell'];
const WEBSITE_HEADERS = ['website', 'url', 'web', 'site', 'link'];
const NOTES_HEADERS = ['notes', 'comments', 'description', 'bio', 'about'];
const TAGS_HEADERS = ['tags', 'categories', 'labels', 'genres', 'genre'];

function normalise(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]/g, ' ');
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = headers.findIndex(h => normalise(h) === candidate);
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Parse raw CSV text into rows of fields.
 * Handles quoted fields (including commas and newlines inside quotes),
 * escaped double-quotes (`""`), CRLF and LF line endings, and UTF-8 BOM.
 */
export function parseRows(text: string): string[][] {
  // Strip UTF-8 BOM if present
  const input = text.startsWith('\uFEFF') ? text.slice(1) : text;

  const rows: string[][] = [];
  let fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek at next character to check for escaped quote
        if (input[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // Closing quote -- exit quoted mode
        inQuotes = false;
        i++;
        continue;
      }
      // All other characters (including commas and newlines) are literal inside quotes
      currentField += ch;
      i++;
      continue;
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      fields.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (ch === '\r' && input[i + 1] === '\n') {
      // CRLF -- end of row
      fields.push(currentField);
      rows.push(fields);
      fields = [];
      currentField = '';
      i += 2;
      continue;
    }

    if (ch === '\n') {
      // LF -- end of row
      fields.push(currentField);
      rows.push(fields);
      fields = [];
      currentField = '';
      i++;
      continue;
    }

    currentField += ch;
    i++;
  }

  // Flush the last field/row
  if (fields.length > 0 || currentField.length > 0) {
    fields.push(currentField);
    rows.push(fields);
  }

  return rows;
}

export function parseCSV(text: string): {
  contacts: RawRecord[];
  headers: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows = parseRows(text.trim());

  if (rows.length < 2) {
    return {
      contacts: [],
      headers: [],
      errors: ['CSV must have a header row and at least one data row.'],
    };
  }

  const headers = rows[0].map(h => h.trim());

  const nameCol = findColumn(headers, NAME_HEADERS);
  const firstNameCol = findColumn(headers, FIRST_NAME_HEADERS);
  const lastNameCol = findColumn(headers, LAST_NAME_HEADERS);
  const outletCol = findColumn(headers, OUTLET_HEADERS);
  const emailCol = findColumn(headers, EMAIL_HEADERS);
  const roleCol = findColumn(headers, ROLE_HEADERS);
  const phoneCol = findColumn(headers, PHONE_HEADERS);
  const websiteCol = findColumn(headers, WEBSITE_HEADERS);
  const notesCol = findColumn(headers, NOTES_HEADERS);
  const tagsCol = findColumn(headers, TAGS_HEADERS);

  const hasNameCol = nameCol !== -1;
  const hasNameParts = firstNameCol !== -1 || lastNameCol !== -1;

  if (!hasNameCol && !hasNameParts) {
    errors.push(`No name column found -- names will be derived from email or left as "Unknown".`);
  }

  // Build a set of all mapped column indices so we can collect extras
  const mappedIndices = new Set<number>(
    [
      nameCol,
      firstNameCol,
      lastNameCol,
      outletCol,
      emailCol,
      roleCol,
      phoneCol,
      websiteCol,
      notesCol,
      tagsCol,
    ].filter(i => i !== -1)
  );

  const contacts: RawRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].map(c => c.trim());

    // Skip entirely blank rows
    if (cols.every(c => !c)) continue;

    // Resolve name from dedicated column, first/last parts, or email prefix
    let name = '';
    if (hasNameCol) {
      name = cols[nameCol] ?? '';
    } else if (hasNameParts) {
      const first = firstNameCol !== -1 ? (cols[firstNameCol] ?? '') : '';
      const last = lastNameCol !== -1 ? (cols[lastNameCol] ?? '') : '';
      name = [first, last].filter(Boolean).join(' ');
    }

    // Derive name from email prefix if still empty
    if (!name && emailCol !== -1 && cols[emailCol]) {
      const prefix = cols[emailCol].split('@')[0] ?? '';
      name = prefix
        .replace(/[._+]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    }

    // Last resort
    if (!name) {
      name = 'Unknown';
    }

    // Parse tags -- split by comma if the field contains multiple values
    let tags: string[] | undefined;
    if (tagsCol !== -1) {
      const raw = cols[tagsCol] ?? '';
      if (raw) {
        tags = raw
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
      }
    }

    // Collect unmapped columns into extras
    const extras: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      if (!mappedIndices.has(j) && cols[j]) {
        extras[headers[j]] = cols[j];
      }
    }

    contacts.push({
      name,
      outlet: outletCol !== -1 ? cols[outletCol] || undefined : undefined,
      email: emailCol !== -1 ? cols[emailCol] || undefined : undefined,
      role: roleCol !== -1 ? cols[roleCol] || undefined : undefined,
      phone: phoneCol !== -1 ? cols[phoneCol] || undefined : undefined,
      website: websiteCol !== -1 ? cols[websiteCol] || undefined : undefined,
      notes: notesCol !== -1 ? cols[notesCol] || undefined : undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
      extras: Object.keys(extras).length > 0 ? extras : undefined,
    });
  }

  return { contacts, headers, errors };
}
