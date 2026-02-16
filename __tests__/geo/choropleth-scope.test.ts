import { describe, it, expect } from 'vitest';
import { choroplethPattern } from '../../src/patterns/definitions/geo/choropleth.js';
import { proportionalSymbolPattern } from '../../src/patterns/definitions/geo/proportional-symbol.js';

describe('choropleth generateSpec — geo scope detection', () => {
  it('should set mapType "us" for US state data', () => {
    const data = [
      { state: 'California', value: 100 },
      { state: 'Texas', value: 200 },
      { state: 'Florida', value: 150 },
      { state: 'New York', value: 180 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['state', 'value']);
    expect(spec.config.mapType).toBe('us');
    expect(spec.config.projection).toBe('albersUsa');
    expect(spec.title).toBe('value by State');
  });

  it('should set mapType "world" for country data', () => {
    const data = [
      { country: 'France', gdp: 2700 },
      { country: 'Germany', gdp: 3800 },
      { country: 'Japan', gdp: 5100 },
      { country: 'Brazil', gdp: 1400 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['country', 'gdp']);
    expect(spec.config.mapType).toBe('world');
    expect(spec.config.projection).toBe('naturalEarth1');
    expect(spec.title).toBe('gdp by Region');
  });

  it('should expand state abbreviations in spec data', () => {
    const data = [
      { state: 'CA', value: 100 },
      { state: 'TX', value: 200 },
      { state: 'FL', value: 150 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['state', 'value']);
    expect(spec.config.mapType).toBe('us');
    expect(spec.data[0].state).toBe('California');
    expect(spec.data[1].state).toBe('Texas');
    expect(spec.data[2].state).toBe('Florida');
  });

  it('should not mutate original data when expanding abbreviations', () => {
    const data = [
      { state: 'CA', value: 100 },
      { state: 'TX', value: 200 },
      { state: 'FL', value: 150 },
    ];
    choroplethPattern.generateSpec(data, ['state', 'value']);
    expect(data[0].state).toBe('CA');
  });

  it('should allow mapType override via options', () => {
    const data = [
      { state: 'California', value: 100 },
      { state: 'Texas', value: 200 },
      { state: 'Florida', value: 150 },
      { state: 'New York', value: 180 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['state', 'value'], { mapType: 'world' });
    expect(spec.config.mapType).toBe('world');
  });

  it('should use intent to bias US detection', () => {
    const data = [
      { region: 'California', value: 100 },
      { region: 'Texas', value: 200 },
      { region: 'France', value: 150 },
      { region: 'Germany', value: 180 },
      { region: 'Japan', value: 120 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['region', 'value'], { _intent: 'show by US state' });
    expect(spec.config.mapType).toBe('us');
  });
});

describe('choropleth generateSpec — explicit geoRegion', () => {
  it('generates spec with CN region config', () => {
    const data = [
      { province: 'Beijing', value: 100 },
      { province: 'Shanghai', value: 200 },
      { province: 'Guangdong', value: 300 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['province', 'value'], {
      geoRegion: 'CN',
    });
    expect(spec.config.projection).toBe('conicEqualArea');
    expect(spec.config.mapType).toBe('CN');
    expect(spec.config.objectName).toBe('CHN_adm1');
    expect(spec.config.nameProperty).toBe('NAME_1');
    expect(spec.config.topoPath).toBe('countries/china/provinces.json');
    expect(spec.config.rotate).toEqual([-105, 0, 0]);
    expect(spec.config.parallels).toEqual([25, 47]);
    expect(spec.title).toBe('value by Province');
  });

  it('generates spec with EU continent config', () => {
    const data = [
      { country: 'France', value: 100 },
      { country: 'Germany', value: 200 },
      { country: 'Italy', value: 150 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['country', 'value'], {
      geoRegion: 'EU',
    });
    expect(spec.config.projection).toBe('azimuthalEqualArea');
    expect(spec.config.mapType).toBe('EU');
    expect(spec.config.objectName).toBe('continent_Europe_subunits');
    expect(spec.config.rotate).toEqual([-10, -52, 0]);
  });

  it('generates spec with JP region config', () => {
    const data = [
      { prefecture: 'Tokyo', value: 100 },
      { prefecture: 'Osaka', value: 200 },
      { prefecture: 'Hokkaido', value: 150 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['prefecture', 'value'], {
      geoRegion: 'JP',
    });
    expect(spec.config.projection).toBe('mercator');
    expect(spec.config.mapType).toBe('JP');
    expect(spec.title).toBe('value by Prefecture');
  });

  it('auto-detected US still includes registry config', () => {
    const data = [
      { state: 'California', value: 100 },
      { state: 'Texas', value: 200 },
      { state: 'Florida', value: 150 },
      { state: 'New York', value: 180 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['state', 'value']);
    expect(spec.config.objectName).toBe('states');
    expect(spec.config.nameProperty).toBe('name');
    expect(spec.config.topoPath).toBe('us/states-10m.json');
  });
});

describe('proportional-symbol generateSpec — geo scope detection', () => {
  it('should set mapType "us" for US state data', () => {
    const data = [
      { location: 'California', count: 100 },
      { location: 'Texas', count: 200 },
      { location: 'Florida', count: 150 },
      { location: 'New York', count: 180 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(data, ['location', 'count']);
    expect(spec.config.mapType).toBe('us');
    expect(spec.config.projection).toBe('albersUsa');
  });

  it('should set mapType "world" for country data', () => {
    const data = [
      { city: 'Paris', pop: 2700 },
      { city: 'Berlin', pop: 3800 },
      { city: 'Tokyo', pop: 5100 },
      { city: 'Brasilia', pop: 1400 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(data, ['city', 'pop']);
    expect(spec.config.mapType).toBe('world');
    expect(spec.config.projection).toBe('naturalEarth1');
  });

  it('should expand state abbreviations in spec data', () => {
    const data = [
      { state: 'CA', count: 100 },
      { state: 'TX', count: 200 },
      { state: 'FL', count: 150 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(data, ['state', 'count']);
    expect(spec.config.mapType).toBe('us');
    expect(spec.data[0].state).toBe('California');
  });
});
