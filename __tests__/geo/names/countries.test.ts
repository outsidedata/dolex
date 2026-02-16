import { describe, it, expect } from 'vitest';
import { resolveCountryName, getAllCountryNames, getCountryAlpha2Codes } from '../../../src/renderers/d3/geo/names/countries.js';

describe('country name resolution', () => {
  it('resolves canonical name', () => {
    expect(resolveCountryName('United States')).toBe('US');
    expect(resolveCountryName('China')).toBe('CN');
    expect(resolveCountryName('Australia')).toBe('AU');
    expect(resolveCountryName('Japan')).toBe('JP');
    expect(resolveCountryName('Brazil')).toBe('BR');
  });

  it('resolves ISO alpha-2 codes', () => {
    expect(resolveCountryName('US')).toBe('US');
    expect(resolveCountryName('cn')).toBe('CN');
    expect(resolveCountryName('GB')).toBe('GB');
    expect(resolveCountryName('de')).toBe('DE');
  });

  it('resolves ISO alpha-3 codes', () => {
    expect(resolveCountryName('USA')).toBe('US');
    expect(resolveCountryName('GBR')).toBe('GB');
    expect(resolveCountryName('DEU')).toBe('DE');
    expect(resolveCountryName('JPN')).toBe('JP');
    expect(resolveCountryName('BRA')).toBe('BR');
  });

  it('resolves common aliases', () => {
    expect(resolveCountryName('America')).toBe('US');
    expect(resolveCountryName('UK')).toBe('GB');
    expect(resolveCountryName('South Korea')).toBe('KR');
    expect(resolveCountryName('Holland')).toBe('NL');
    expect(resolveCountryName('Great Britain')).toBe('GB');
  });

  it('normalizes input', () => {
    expect(resolveCountryName('  united states  ')).toBe('US');
    expect(resolveCountryName('U.S.A.')).toBe('US');
    expect(resolveCountryName('THE NETHERLANDS')).toBe('NL');
    expect(resolveCountryName('Côte d\'Ivoire')).toBe('CI');
  });

  it('returns undefined for non-country', () => {
    expect(resolveCountryName('California')).toBeUndefined();
    expect(resolveCountryName('nonsense')).toBeUndefined();
    expect(resolveCountryName('')).toBeUndefined();
  });

  it('resolves all 195+ sovereign nations', () => {
    const allCountries = getAllCountryNames();
    expect(allCountries.length).toBeGreaterThanOrEqual(195);
  });

  it('getCountryAlpha2Codes returns correct count', () => {
    const codes = getCountryAlpha2Codes();
    expect(codes.length).toBeGreaterThanOrEqual(195);
    expect(codes).toContain('US');
    expect(codes).toContain('CN');
    expect(codes).toContain('GB');
  });
});
