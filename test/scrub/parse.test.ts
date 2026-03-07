import { describe, it, expect } from 'vitest';
import { parseCSV, parseRows } from '../../src/phases/scrub/parse.js';

describe('parseRows', () => {
  it('parses basic CSV rows', () => {
    const rows = parseRows('a,b,c\n1,2,3');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles RFC 4180 quoted fields', () => {
    const rows = parseRows('name,bio\nAlice,"likes ""music"", cats"');
    expect(rows).toEqual([
      ['name', 'bio'],
      ['Alice', 'likes "music", cats'],
    ]);
  });

  it('handles quoted fields with newlines', () => {
    const rows = parseRows('name,notes\nAlice,"line1\nline2"');
    expect(rows).toEqual([
      ['name', 'notes'],
      ['Alice', 'line1\nline2'],
    ]);
  });

  it('handles CRLF line endings', () => {
    const rows = parseRows('a,b\r\n1,2\r\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('strips UTF-8 BOM', () => {
    const rows = parseRows('\uFEFFname,email\nAlice,alice@example.com');
    expect(rows[0][0]).toBe('name');
  });
});

describe('parseCSV', () => {
  it('parses contacts from CSV text', () => {
    const csv = 'Name,Email,Outlet\nAlice,alice@bbc.co.uk,BBC Radio 1';
    const { contacts, headers, errors } = parseCSV(csv);

    expect(errors).toEqual([]);
    expect(headers).toEqual(['Name', 'Email', 'Outlet']);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toEqual({
      name: 'Alice',
      email: 'alice@bbc.co.uk',
      outlet: 'BBC Radio 1',
      role: undefined,
      phone: undefined,
      website: undefined,
      notes: undefined,
      tags: undefined,
      extras: undefined,
    });
  });

  it('returns error when no name column found', () => {
    const csv = 'Email,Outlet\nalice@test.com,BBC';
    const { contacts, errors } = parseCSV(csv);

    expect(contacts).toEqual([]);
    expect(errors[0]).toContain('Could not find a name column');
  });

  it('joins first and last name columns', () => {
    const csv = 'First Name,Last Name,Email\nAlice,Smith,alice@test.com';
    const { contacts, errors } = parseCSV(csv);

    expect(errors).toEqual([]);
    expect(contacts[0].name).toBe('Alice Smith');
  });

  it('collects unmapped columns into extras', () => {
    const csv = 'Name,Email,Genre,Region\nAlice,alice@test.com,Rock,London';
    const { contacts } = parseCSV(csv);

    expect(contacts[0].extras).toEqual({ Genre: 'Rock', Region: 'London' });
  });

  it('skips blank rows', () => {
    const csv = 'Name,Email\nAlice,alice@test.com\n,,\nBob,bob@test.com';
    const { contacts } = parseCSV(csv);

    expect(contacts).toHaveLength(2);
  });

  it('reports missing name in data rows', () => {
    const csv = 'Name,Email\n,alice@test.com\nBob,bob@test.com';
    const { contacts, errors } = parseCSV(csv);

    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('Bob');
    expect(errors[0]).toContain('Row 2: missing name');
  });

  it('parses tags from comma-separated field', () => {
    const csv = 'Name,Tags\nAlice,"rock, indie, alternative"';
    const { contacts } = parseCSV(csv);

    expect(contacts[0].tags).toEqual(['rock', 'indie', 'alternative']);
  });

  it('returns error for CSV with header only', () => {
    const csv = 'Name,Email';
    const { errors } = parseCSV(csv);

    expect(errors[0]).toContain('at least one data row');
  });
});
