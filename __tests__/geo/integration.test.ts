import { describe, it, expect } from 'vitest';
import { choroplethPattern } from '../../src/patterns/definitions/geo/choropleth.js';
import { proportionalSymbolPattern } from '../../src/patterns/definitions/geo/proportional-symbol.js';
import { detectGeoScope } from '../../src/renderers/d3/geo/geo-scope.js';

interface RegionTestCase {
  region: string;
  data: Record<string, any>[];
  expectedProjection: string;
  geoField: string;
}

describe('geo integration — choropleth generates correct spec per region', () => {
  const testCases: RegionTestCase[] = [
    {
      region: 'US',
      data: [
        { state: 'California', value: 100 },
        { state: 'Texas', value: 80 },
        { state: 'Florida', value: 60 },
      ],
      expectedProjection: 'albersUsa',
      geoField: 'state',
    },
    {
      region: 'CN',
      data: [
        { province: 'Beijing', value: 100 },
        { province: 'Shanghai', value: 80 },
      ],
      expectedProjection: 'conicEqualArea',
      geoField: 'province',
    },
    {
      region: 'JP',
      data: [
        { prefecture: 'Tokyo', value: 100 },
        { prefecture: 'Osaka', value: 80 },
      ],
      expectedProjection: 'mercator',
      geoField: 'prefecture',
    },
    {
      region: 'AU',
      data: [
        { state: 'New South Wales', value: 100 },
        { state: 'Victoria', value: 80 },
      ],
      expectedProjection: 'mercator',
      geoField: 'state',
    },
    {
      region: 'DE',
      data: [
        { land: 'Berlin', value: 100 },
        { land: 'Hamburg', value: 80 },
      ],
      expectedProjection: 'mercator',
      geoField: 'land',
    },
    {
      region: 'IT',
      data: [
        { region: 'Lazio', value: 100 },
        { region: 'Lombardia', value: 80 },
      ],
      expectedProjection: 'mercator',
      geoField: 'region',
    },
    {
      region: 'BR',
      data: [
        { estado: 'São Paulo', value: 100 },
        { estado: 'Rio de Janeiro', value: 80 },
      ],
      expectedProjection: 'conicEqualArea',
      geoField: 'estado',
    },
    {
      region: 'CA',
      data: [
        { province: 'Ontario', value: 100 },
        { province: 'Québec', value: 80 },
      ],
      expectedProjection: 'conicConformal',
      geoField: 'province',
    },
    {
      region: 'IN',
      data: [
        { state: 'Maharashtra', value: 100 },
        { state: 'Karnataka', value: 80 },
      ],
      expectedProjection: 'mercator',
      geoField: 'state',
    },
    {
      region: 'FR',
      data: [
        { region: 'Île-de-France', value: 100 },
        { region: 'Bretagne', value: 80 },
      ],
      expectedProjection: 'conicConformal',
      geoField: 'region',
    },
    {
      region: 'world',
      data: [
        { country: 'France', value: 100 },
        { country: 'Germany', value: 80 },
        { country: 'Japan', value: 60 },
      ],
      expectedProjection: 'naturalEarth1',
      geoField: 'country',
    },
  ];

  testCases.forEach(({ region, data, expectedProjection, geoField }) => {
    it(`renders ${region} with correct projection`, () => {
      const spec = choroplethPattern.generateSpec(
        data,
        [geoField, 'value'],
        { geoRegion: region },
      );
      expect(spec.config.projection).toBe(expectedProjection);
      expect(spec.config.topojsonData).toBeDefined();
      expect(spec.config.objectName).toBeDefined();
      expect(spec.config.mapType).toBe(region);
    });
  });

  it('auto-detects US from state data without explicit geoRegion', () => {
    const data = [
      { state: 'California', value: 100 },
      { state: 'Texas', value: 80 },
      { state: 'Florida', value: 60 },
      { state: 'New York', value: 90 },
      { state: 'Ohio', value: 40 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['state', 'value'], {
      _intent: 'show state map',
    });
    expect(spec.config.mapType).toBe('us');
    expect(spec.config.projection).toBe('albersUsa');
  });

  it('auto-detects JP from prefecture data without explicit geoRegion', () => {
    const data = [
      { prefecture: 'Tokyo', value: 100 },
      { prefecture: 'Osaka', value: 80 },
      { prefecture: 'Hokkaido', value: 60 },
      { prefecture: 'Kyoto', value: 50 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['prefecture', 'value'], {
      _intent: 'Japanese prefectures map',
    });
    expect(spec.config.mapType).toBe('JP');
    expect(spec.config.projection).toBe('mercator');
  });

  it('expands US abbreviations in data', () => {
    const data = [
      { state: 'CA', value: 100 },
      { state: 'TX', value: 80 },
      { state: 'FL', value: 60 },
    ];
    const spec = choroplethPattern.generateSpec(data, ['state', 'value'], {
      _intent: 'state map',
    });
    expect(spec.data[0].state).toBe('California');
    expect(spec.data[1].state).toBe('Texas');
    expect(spec.data[2].state).toBe('Florida');
  });
});

describe('geo integration — proportional symbol', () => {
  it('generates JP proportional symbol spec', () => {
    const data = [
      { city: 'Tokyo', pop: 14 },
      { city: 'Osaka', pop: 9 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(
      data, ['city', 'pop'], { geoRegion: 'JP' },
    );
    expect(spec.config.mapType).toBe('JP');
    expect(spec.config.projection).toBe('mercator');
    expect(spec.config.topojsonData).toBeDefined();
  });
});

describe('geo integration — detectGeoScope with Tier 2 regions', () => {
  it('detects Russian regions', () => {
    const result = detectGeoScope(['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Krasnoyarsk']);
    expect(result.scope).toBe('RU');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects Italian regions', () => {
    const result = detectGeoScope(['Tuscany', 'Lombardy', 'Sicily', 'Lazio']);
    expect(result.scope).toBe('IT');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects Spanish communities', () => {
    const result = detectGeoScope(['Madrid', 'Catalonia', 'Andalucia', 'Valencia']);
    expect(result.scope).toBe('ES');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects South Korean provinces', () => {
    const result = detectGeoScope(['Seoul', 'Busan', 'Incheon', 'Daegu']);
    expect(result.scope).toBe('KR');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects Argentine provinces', () => {
    const result = detectGeoScope(['Buenos Aires', 'Cordoba', 'Mendoza', 'Tucuman']);
    expect(result.scope).toBe('AR');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects Colombian departments', () => {
    const result = detectGeoScope(['Antioquia', 'Cundinamarca', 'Atlantico', 'Santander']);
    expect(result.scope).toBe('CO');
    expect(result.geoLevel).toBe('subdivision');
  });
});
