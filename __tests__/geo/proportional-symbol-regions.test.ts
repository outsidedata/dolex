import { describe, it, expect } from 'vitest';
import { proportionalSymbolPattern } from '../../src/patterns/definitions/geo/proportional-symbol.js';

describe('proportional-symbol region wiring', () => {
  it('generates spec with explicit geoRegion', () => {
    const data = [
      { city: 'Tokyo', pop: 14 },
      { city: 'Osaka', pop: 9 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(
      data, ['city', 'pop'], { geoRegion: 'JP' }
    );
    expect(spec.config.mapType).toBe('JP');
    expect(spec.config.projection).toBe('mercator');
    expect(spec.config.topojsonData).toBeDefined();
    expect(spec.config.objectName).toBeDefined();
  });

  it('generates spec with US auto-detection', () => {
    const data = [
      { city: 'California', value: 100 },
      { city: 'Texas', value: 80 },
      { city: 'Florida', value: 60 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(
      data, ['city', 'value'], { _intent: 'show US state data on a map' }
    );
    expect(spec.config.mapType).toBe('us');
    expect(spec.config.projection).toBe('albersUsa');
  });

  it('spreads regionConfig into spec.config', () => {
    const data = [
      { region: 'Beijing', value: 100 },
    ];
    const spec = proportionalSymbolPattern.generateSpec(
      data, ['region', 'value'], { geoRegion: 'CN' }
    );
    expect(spec.config.topoPath).toBeDefined();
    expect(spec.config.objectName).toBeDefined();
    expect(spec.config.nameProperty).toBeDefined();
    expect(spec.config.topojsonData).toBeDefined();
  });
});
