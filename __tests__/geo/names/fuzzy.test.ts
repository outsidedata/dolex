import { describe, it, expect } from 'vitest';
import { levenshtein, suggestMatch } from '../../../src/renderers/d3/geo/names/fuzzy.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('returns string length for empty comparison', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('computes simple edit distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('texas', 'tejas')).toBe(1);
    expect(levenshtein('california', 'californa')).toBe(1);
  });
});

describe('suggestMatch', () => {
  const states = ['California', 'Texas', 'Florida', 'New York', 'Ohio'];

  it('suggests close match', () => {
    const result = suggestMatch('Californa', states);
    expect(result).toBeDefined();
    expect(result!.suggestion).toBe('California');
    expect(result!.distance).toBe(1);
  });

  it('suggests for typos', () => {
    const result = suggestMatch('Texs', states);
    expect(result).toBeDefined();
    expect(result!.suggestion).toBe('Texas');
  });

  it('returns undefined for no close match', () => {
    const result = suggestMatch('Zimbabwe', states);
    expect(result).toBeUndefined();
  });

  it('finds best match when multiple candidates are close', () => {
    const result = suggestMatch('New Yok', states);
    expect(result).toBeDefined();
    expect(result!.suggestion).toBe('New York');
  });

  it('respects maxDistance', () => {
    const result = suggestMatch('Tejas', states, 1);
    expect(result).toBeDefined();
    expect(result!.suggestion).toBe('Texas');

    const strict = suggestMatch('Tejas', states, 0);
    expect(strict).toBeUndefined();
  });
});
