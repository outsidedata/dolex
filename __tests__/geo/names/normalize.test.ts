import { describe, it, expect } from 'vitest';
import { normalizeGeoName } from '../../../src/renderers/d3/geo/names/normalize.js';

describe('geo name normalization', () => {
  it('lowercases', () => {
    expect(normalizeGeoName('California')).toBe('california');
  });

  it('strips accents', () => {
    expect(normalizeGeoName('São Paulo')).toBe('sao paulo');
    expect(normalizeGeoName('Zürich')).toBe('zurich');
    expect(normalizeGeoName('Côte d\'Ivoire')).toBe("cote d'ivoire");
  });

  it('strips periods', () => {
    expect(normalizeGeoName('U.S.A.')).toBe('usa');
  });

  it('strips "the" prefix', () => {
    expect(normalizeGeoName('The Netherlands')).toBe('netherlands');
  });

  it('collapses whitespace', () => {
    expect(normalizeGeoName('  New   York  ')).toBe('new york');
  });

  it('handles combined normalization', () => {
    expect(normalizeGeoName('  The São Paulo  ')).toBe('sao paulo');
  });

  it('handles empty string', () => {
    expect(normalizeGeoName('')).toBe('');
  });
});
