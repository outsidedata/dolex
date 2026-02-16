import { describe, it, expect } from 'vitest';
import { getGeoConfig, getAllGeoRegions, getSubdivisionRegions, getCountryRegions } from '../../src/renderers/d3/geo/geo-registry.js';

describe('geo-registry', () => {
  it('returns config for US', () => {
    const cfg = getGeoConfig('US');
    expect(cfg).toBeDefined();
    expect(cfg!.projection).toBe('albersUsa');
    expect(cfg!.geoLevel).toBe('subdivision');
    expect(cfg!.objectName).toBe('states');
    expect(cfg!.nameProperty).toBe('name');
  });

  it('returns config for world', () => {
    const cfg = getGeoConfig('world');
    expect(cfg).toBeDefined();
    expect(cfg!.projection).toBe('naturalEarth1');
    expect(cfg!.geoLevel).toBe('country');
    expect(cfg!.objectName).toBe('countries');
  });

  it('returns config for continent EU', () => {
    const cfg = getGeoConfig('EU');
    expect(cfg).toBeDefined();
    expect(cfg!.geoLevel).toBe('country');
    expect(cfg!.objectName).toBe('continent_Europe_subunits');
    expect(cfg!.nameProperty).toBe('geounit');
  });

  it('returns config for Tier 1 country CN', () => {
    const cfg = getGeoConfig('CN');
    expect(cfg).toBeDefined();
    expect(cfg!.geoLevel).toBe('subdivision');
    expect(cfg!.objectName).toBe('CHN_adm1');
    expect(cfg!.nameProperty).toBe('NAME_1');
  });

  it('returns config for AU with verified object name', () => {
    const cfg = getGeoConfig('AU');
    expect(cfg).toBeDefined();
    expect(cfg!.objectName).toBe('default');
    expect(cfg!.nameProperty).toBe('name');
  });

  it('returns undefined for unsupported region', () => {
    expect(getGeoConfig('XX')).toBeUndefined();
  });

  it('getAllGeoRegions returns all supported codes', () => {
    const regions = getAllGeoRegions();
    expect(regions).toContain('US');
    expect(regions).toContain('world');
    expect(regions).toContain('EU');
    expect(regions).toContain('CN');
    expect(regions).toContain('JP');
    expect(regions).toContain('AR');
    expect(regions.length).toBe(25);
  });

  it('is case-insensitive', () => {
    expect(getGeoConfig('us')).toEqual(getGeoConfig('US'));
    expect(getGeoConfig('cn')).toEqual(getGeoConfig('CN'));
  });

  it('getSubdivisionRegions returns only subdivision regions', () => {
    const subs = getSubdivisionRegions();
    expect(subs).toContain('US');
    expect(subs).toContain('CN');
    expect(subs).not.toContain('world');
    expect(subs).not.toContain('EU');
    expect(subs.length).toBe(18);
  });

  it('getCountryRegions returns only country-level regions', () => {
    const countries = getCountryRegions();
    expect(countries).toContain('world');
    expect(countries).toContain('EU');
    expect(countries).not.toContain('US');
    expect(countries.length).toBe(7);
  });

  it('every region has required fields', () => {
    for (const code of getAllGeoRegions()) {
      const cfg = getGeoConfig(code);
      expect(cfg, `${code} missing`).toBeDefined();
      expect(cfg!.geoLevel, `${code} geoLevel`).toBeDefined();
      expect(cfg!.projection, `${code} projection`).toBeDefined();
      expect(cfg!.topoPath, `${code} topoPath`).toBeDefined();
      expect(cfg!.objectName, `${code} objectName`).toBeDefined();
      expect(cfg!.nameProperty, `${code} nameProperty`).toBeDefined();
      expect(cfg!.label, `${code} label`).toBeDefined();
    }
  });
});
