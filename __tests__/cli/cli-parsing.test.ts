import { describe, it, expect } from 'vitest';
import { parseArgs, str, bool, num, list } from '../../src/cli/args.js';
import { parseSort, parseFilters } from '../../src/cli/commands/refine.js';
import { loadSpec } from '../../src/cli/spec-disk.js';

describe('CLI arg parser', () => {
  it('parses positionals, value flags, and aliases', () => {
    const a = parseArgs(['sales.csv', '-i', 'compare regions', '--palette', 'blue'], {
      aliases: { i: 'intent' },
    });
    expect(a._).toEqual(['sales.csv']);
    expect(str(a, 'intent')).toBe('compare regions');
    expect(str(a, 'palette')).toBe('blue');
  });

  it('handles --flag=value', () => {
    const a = parseArgs(['--out=/tmp/x.html']);
    expect(str(a, 'out')).toBe('/tmp/x.html');
  });

  it('treats a single dash as a positional (stdin sentinel)', () => {
    const a = parseArgs(['-', '--stdin'], { booleans: ['stdin'] });
    expect(a._).toEqual(['-']);
    expect(bool(a, 'stdin')).toBe(true);
  });

  it('does not let a boolean flag swallow the next token', () => {
    const a = parseArgs(['--open', 'data.csv'], { booleans: ['open'] });
    expect(bool(a, 'open')).toBe(true);
    expect(a._).toEqual(['data.csv']);
  });

  it('parses --no-<flag> as false for declared booleans', () => {
    const a = parseArgs(['--no-table'], { booleans: ['table'] });
    expect(a.table).toBe(false);
  });

  // Regression: a boolean flag with an inline value must coerce, not store a string.
  it('coerces inline values on boolean flags', () => {
    expect(parseArgs(['--table=no'], { booleans: ['table'] }).table).toBe(false);
    expect(parseArgs(['--table=false'], { booleans: ['table'] }).table).toBe(false);
    expect(parseArgs(['--table=0'], { booleans: ['table'] }).table).toBe(false);
    expect(parseArgs(['--table=yes'], { booleans: ['table'] }).table).toBe(true);
    expect(parseArgs(['--table'], { booleans: ['table'] }).table).toBe(true);
  });

  it('keeps negative numbers as values', () => {
    const a = parseArgs(['--threshold', '-0.5']);
    expect(num(a, 'threshold')).toBe(-0.5);
  });

  it('splits comma lists', () => {
    const a = parseArgs(['--highlight', 'North, South ,East']);
    expect(list(a, 'highlight')).toEqual(['North', 'South', 'East']);
  });
});

describe('refine parseSort', () => {
  it('parses field:direction', () => {
    expect(parseSort('revenue:asc')).toEqual({ field: 'revenue', direction: 'asc' });
    expect(parseSort('value:desc')).toEqual({ field: 'value', direction: 'desc' });
  });

  // Regression: direction keyword must be case-insensitive; field keeps its case.
  it('matches direction case-insensitively', () => {
    expect(parseSort('value:DESC')).toEqual({ field: 'value', direction: 'desc' });
    expect(parseSort('Revenue:ASC')).toEqual({ field: 'Revenue', direction: 'asc' });
    expect(parseSort('DESC')).toEqual({ direction: 'desc' });
    expect(parseSort('asc')).toEqual({ direction: 'asc' });
  });

  it('treats a bare token as a field (default desc)', () => {
    expect(parseSort('revenue')).toEqual({ field: 'revenue', direction: 'desc' });
  });

  it('returns null to clear', () => {
    expect(parseSort('none')).toBeNull();
    expect(parseSort('CLEAR')).toBeNull();
  });
});

describe('refine parseFilters', () => {
  it('parses a single clause', () => {
    expect(parseFilters('region in North,South')).toEqual([
      { field: 'region', op: 'in', values: ['North', 'South'] },
    ]);
  });

  // Regression: operator must be accepted case-insensitively.
  it('accepts uppercase operators', () => {
    expect(parseFilters('price GT 1000')).toEqual([
      { field: 'price', op: 'gt', values: ['1000'] },
    ]);
    expect(parseFilters('region NOT_IN A,B')).toEqual([
      { field: 'region', op: 'not_in', values: ['A', 'B'] },
    ]);
  });

  it('parses multiple clauses separated by ;', () => {
    expect(parseFilters('region in North; price gt 1000')).toEqual([
      { field: 'region', op: 'in', values: ['North'] },
      { field: 'price', op: 'gt', values: ['1000'] },
    ]);
  });

  it('clears with "clear"/"none"', () => {
    expect(parseFilters('clear')).toEqual([]);
    expect(parseFilters('none')).toEqual([]);
  });

  it('rejects unknown operators', () => {
    expect(() => parseFilters('price BETWEENISH 1,2')).toThrow(/must be one of/);
  });
});

describe('spec-disk path safety', () => {
  it('returns null for path-traversal ids instead of escaping the specs dir', () => {
    expect(loadSpec('../../../etc/passwd')).toBeNull();
    expect(loadSpec('..')).toBeNull();
    expect(loadSpec('nonexistent-spec-id')).toBeNull();
  });
});
