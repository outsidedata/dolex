import { describe, it, expect } from 'vitest';
import { loadTopojson, getGeoDataDir } from '../../src/renderers/d3/geo/topojson-loader.js';

describe('topojson-loader', () => {
  it('loads world countries', () => {
    const data = loadTopojson('countries-110m.json');
    expect(data.type).toBe('Topology');
    expect(data.objects.countries).toBeDefined();
  });

  it('loads US states', () => {
    const data = loadTopojson('us/states-10m.json');
    expect(data.type).toBe('Topology');
    expect(data.objects.states).toBeDefined();
  });

  it('loads country subdivision', () => {
    const data = loadTopojson('countries/australia/states.json');
    expect(data.type).toBe('Topology');
    expect(data.objects.default).toBeDefined();
  });

  it('loads continent file', () => {
    const data = loadTopojson('continents/europe.json');
    expect(data.type).toBe('Topology');
    expect(data.objects.continent_Europe_subunits).toBeDefined();
  });

  it('throws for missing file', () => {
    expect(() => loadTopojson('nonexistent.json')).toThrow();
  });

  it('getGeoDataDir returns a valid path', () => {
    const dir = getGeoDataDir();
    expect(dir).toContain('data/geo');
  });
});
