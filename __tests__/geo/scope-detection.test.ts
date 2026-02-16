import { describe, it, expect } from 'vitest';
import { detectGeoScope } from '../../src/renderers/d3/geo/geo-scope.js';

describe('detectGeoScope', () => {
  it('should detect US state full names as scope "us"', () => {
    const values = ['California', 'Texas', 'Florida', 'New York', 'Ohio'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
    expect(result.normalizedValues).toBeUndefined();
  });

  it('should detect US state abbreviations as scope "us" with normalizedValues', () => {
    const values = ['CA', 'TX', 'FL', 'NY', 'OH'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
    expect(result.normalizedValues).toBeDefined();
    expect(result.normalizedValues!.get('CA')).toBe('California');
    expect(result.normalizedValues!.get('TX')).toBe('Texas');
    expect(result.normalizedValues!.get('FL')).toBe('Florida');
  });

  it('should handle mixed abbreviations and full names', () => {
    const values = ['California', 'TX', 'Florida', 'NY', 'Ohio'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
    expect(result.normalizedValues).toBeDefined();
    expect(result.normalizedValues!.get('TX')).toBe('Texas');
    expect(result.normalizedValues!.get('NY')).toBe('New York');
    expect(result.normalizedValues!.has('California')).toBe(false);
  });

  it('should detect world countries as scope "world"', () => {
    const values = ['France', 'Germany', 'Japan', 'Brazil', 'Australia'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('world');
  });

  it('should disambiguate Georgia with other US states', () => {
    const values = ['Georgia', 'California', 'Texas', 'Florida'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
  });

  it('should return "world" when below threshold (2 states in 10 rows)', () => {
    const values = [
      'California', 'Texas',
      'France', 'Germany', 'Japan', 'Brazil', 'Australia', 'Italy', 'Spain', 'Canada',
    ];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('world');
  });

  it('should lower threshold with US intent keywords', () => {
    const values = ['California', 'Texas', 'France', 'Germany', 'Japan', 'Brazil', 'Australia', 'Italy', 'Spain', 'Canada'];
    const resultWithout = detectGeoScope(values);
    expect(resultWithout.scope).toBe('world');

    const resultWith = detectGeoScope(values, 'show US state data');
    expect(resultWith.scope).toBe('us');
  });

  it('should detect US scope with intent bias on borderline data', () => {
    const values = ['California', 'Texas', 'France', 'Germany', 'Japan'];
    const resultWithIntent = detectGeoScope(values, 'by state in the US');
    expect(resultWithIntent.scope).toBe('us');
  });

  it('should return "world" for empty values', () => {
    expect(detectGeoScope([]).scope).toBe('world');
  });

  it('should return "world" for null/empty string values', () => {
    const values = ['', '', ''];
    expect(detectGeoScope(values).scope).toBe('world');
  });

  it('should be case insensitive', () => {
    const values = ['california', 'TEXAS', 'Florida', 'new york', 'OHIO'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
  });

  it('should handle DC / District of Columbia', () => {
    const values = ['District of Columbia', 'California', 'Texas', 'Florida'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
  });

  it('should recognize various US intent patterns', () => {
    const borderline = ['California', 'Texas', 'France', 'Germany', 'Japan'];

    expect(detectGeoScope(borderline, 'U.S. data').scope).toBe('us');
    expect(detectGeoScope(borderline, 'United States breakdown').scope).toBe('us');
    expect(detectGeoScope(borderline, 'state map of results').scope).toBe('us');
  });

  it('should handle trimming whitespace in values', () => {
    const values = ['  California  ', ' Texas', 'Florida ', 'New York', 'Ohio'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
  });
});

describe('multi-region detection', () => {
  it('detects Chinese provinces', () => {
    const result = detectGeoScope(['Beijing', 'Shanghai', 'Guangdong', 'Sichuan']);
    expect(result.scope).toBe('CN');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects country-level data', () => {
    const result = detectGeoScope(['United States', 'China', 'India', 'Brazil', 'Germany']);
    expect(result.geoLevel).toBe('country');
  });

  it('detects European countries with EU scope', () => {
    const result = detectGeoScope(['France', 'Germany', 'Italy', 'Spain', 'Netherlands']);
    expect(result.scope).toBe('EU');
    expect(result.geoLevel).toBe('country');
  });

  it('detects Australian states', () => {
    const result = detectGeoScope(['New South Wales', 'Victoria', 'Queensland']);
    expect(result.scope).toBe('AU');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects Japanese prefectures', () => {
    const result = detectGeoScope(['Tokyo', 'Osaka', 'Hokkaido', 'Kyoto', 'Fukuoka']);
    expect(result.scope).toBe('JP');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('returns detection confidence', () => {
    const result = detectGeoScope(['CA', 'TX', 'NY', 'FL', 'WA', 'OR', 'IL', 'OH']);
    expect(result.confidence).toBe('high');
  });

  it('resolves Georgia as US state when majority is US', () => {
    const result = detectGeoScope(['California', 'Texas', 'Georgia', 'Florida', 'New York']);
    expect(result.scope).toBe('us');
  });

  it('detects world scope for mixed-continent countries', () => {
    const result = detectGeoScope(['United States', 'China', 'Brazil', 'Nigeria', 'Australia']);
    expect(result.scope).toBe('world');
    expect(result.geoLevel).toBe('country');
  });

  it('detects South American countries', () => {
    const result = detectGeoScope(['Argentina', 'Brazil', 'Chile', 'Colombia', 'Peru']);
    expect(result.scope).toBe('SA');
    expect(result.geoLevel).toBe('country');
  });

  it('falls back when no threshold met', () => {
    const result = detectGeoScope(['apple', 'banana', 'cherry']);
    expect(result.scope).toBe('none');
    expect(result.geoLevel).toBeUndefined();
  });

  it('detects Canadian provinces', () => {
    const result = detectGeoScope(['Ontario', 'British Columbia', 'Alberta', 'Manitoba']);
    expect(result.scope).toBe('CA');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('detects Indian states', () => {
    const result = detectGeoScope(['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi']);
    expect(result.scope).toBe('IN');
    expect(result.geoLevel).toBe('subdivision');
  });
});

describe('column name hints', () => {
  it('column named "state" biases toward subdivision', () => {
    const result = detectGeoScope(['Victoria', 'Queensland'], {
      columnName: 'state',
    });
    expect(result.geoLevel).toBe('subdivision');
  });

  it('column named "country" biases toward country level with few values', () => {
    const result = detectGeoScope(['France', 'Germany'], {
      columnName: 'country',
    });
    expect(result.geoLevel).toBe('country');
  });

  it('column named "prefecture" hints at Japan', () => {
    const result = detectGeoScope(['Tokyo', 'Osaka'], {
      columnName: 'prefecture',
    });
    expect(result.scope).toBe('JP');
  });

  it('column named "bundesland" hints at Germany', () => {
    const result = detectGeoScope(['Berlin', 'Hamburg'], {
      columnName: 'bundesland',
    });
    expect(result.scope).toBe('DE');
  });
});

describe('intent hints', () => {
  it('"map of Europe" forces EU country scope', () => {
    const result = detectGeoScope(['France', 'Germany'], {
      intent: 'map of Europe',
    });
    expect(result.scope).toBe('EU');
    expect(result.geoLevel).toBe('country');
  });

  it('"Chinese province" hints at CN subdivision', () => {
    const result = detectGeoScope(['Beijing', 'Shanghai'], {
      intent: 'show data by Chinese province',
    });
    expect(result.scope).toBe('CN');
    expect(result.geoLevel).toBe('subdivision');
  });

  it('"African countries" hints at AF scope', () => {
    const result = detectGeoScope(['Nigeria', 'Kenya', 'Egypt'], {
      intent: 'compare African countries',
    });
    expect(result.scope).toBe('AF');
  });

  it('"South American" hints at SA scope', () => {
    const result = detectGeoScope(['Brazil', 'Argentina', 'Chile'], {
      intent: 'South American sales',
    });
    expect(result.scope).toBe('SA');
  });
});

describe('fuzzy suggestions', () => {
  it('suggests corrections for misspelled US states', () => {
    const values = ['California', 'Texs', 'Florida', 'New York', 'Ohio'];
    const result = detectGeoScope(values);
    expect(result.scope).toBe('us');
    expect(result.unmatchedValues).toContain('Texs');
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.find(s => s.value === 'Texs')?.suggestion).toBe('Texas');
  });

  it('suggests corrections for misspelled countries', () => {
    const values = ['France', 'Gemany', 'Italy', 'Spain', 'Netherlands'];
    const result = detectGeoScope(values);
    expect(result.geoLevel).toBe('country');
    expect(result.unmatchedValues).toContain('Gemany');
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.find(s => s.value === 'Gemany')?.suggestion).toBe('Germany');
  });

  it('no suggestions when all values match', () => {
    const values = ['California', 'Texas', 'Florida', 'New York', 'Ohio'];
    const result = detectGeoScope(values);
    expect(result.suggestions).toBeUndefined();
  });

  it('no suggestions when unmatched values are too different', () => {
    const values = ['California', 'Texas', 'Florida', 'XYZABC', 'Ohio'];
    const result = detectGeoScope(values);
    expect(result.unmatchedValues).toContain('XYZABC');
    const xyzSuggestion = result.suggestions?.find(s => s.value === 'XYZABC');
    expect(xyzSuggestion).toBeUndefined();
  });
});
