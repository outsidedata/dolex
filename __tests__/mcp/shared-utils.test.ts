import { describe, it, expect } from 'vitest';
import type { VisualizationSpec } from '../../src/types.js';
import { inferColumns, applyTimeBucketColumnTypes, enhanceIntentForTimeBucket, applyColorPreferences } from '../../src/mcp/tools/shared.js';

describe('inferColumns', () => {
  it('infers date type from column name containing "date"', () => {
    const data = [
      { date_month: '2023-01', count: 10 },
      { date_month: '2023-02', count: 20 },
    ];
    const cols = inferColumns(data);
    const dateCol = cols.find(c => c.name === 'date_month');
    expect(dateCol?.type).toBe('date');
  });

  it('infers numeric type for plain numbers', () => {
    const data = [
      { value: 10, label: 'a' },
      { value: 20, label: 'b' },
    ];
    const cols = inferColumns(data);
    expect(cols.find(c => c.name === 'value')?.type).toBe('numeric');
    expect(cols.find(c => c.name === 'label')?.type).toBe('categorical');
  });

  describe('year detection', () => {
    it('classifies "cohort" column with year values as date', () => {
      const data = [
        { cohort: 2018, value: 10 },
        { cohort: 2019, value: 20 },
        { cohort: 2020, value: 30 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'cohort')?.type).toBe('date');
    });

    it('classifies "fiscal_year" column with year values as date', () => {
      const data = [
        { fiscal_year: 2020, amount: 100 },
        { fiscal_year: 2021, amount: 200 },
        { fiscal_year: 2022, amount: 300 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'fiscal_year')?.type).toBe('date');
    });

    it('classifies "vintage" column with year values as date', () => {
      const data = [
        { vintage: 1995, count: 5 },
        { vintage: 2000, count: 10 },
        { vintage: 2005, count: 15 },
        { vintage: 2010, count: 20 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'vintage')?.type).toBe('date');
    });

    it('keeps "score" column as numeric (name does not match year pattern)', () => {
      const data = [
        { score: 1950 },
        { score: 1980 },
        { score: 2010 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'score')?.type).toBe('numeric');
    });

    it('keeps "employee_count" as numeric (name does not match year pattern)', () => {
      const data = [
        { employee_count: 1950 },
        { employee_count: 1975 },
        { employee_count: 2000 },
        { employee_count: 2025 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'employee_count')?.type).toBe('numeric');
    });

    it('keeps "notify_status" as numeric (word boundary prevents "fy" match)', () => {
      const data = [
        { notify_status: 2000 },
        { notify_status: 2001 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'notify_status')?.type).toBe('numeric');
    });

    it('keeps column as numeric when values are outside year range', () => {
      const data = [
        { cohort: 2020 },
        { cohort: 2021 },
        { cohort: 9999 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'cohort')?.type).toBe('numeric');
    });

    it('keeps "cohort" with string values as categorical', () => {
      const data = [
        { cohort: 'A' },
        { cohort: 'B' },
        { cohort: 'C' },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'cohort')?.type).toBe('categorical');
    });

    it('classifies "year" column via existing isDate pattern (not year heuristic)', () => {
      const data = [
        { year: 2018, sales: 100 },
        { year: 2019, sales: 200 },
        { year: 2020, sales: 300 },
      ];
      const cols = inferColumns(data);
      expect(cols.find(c => c.name === 'year')?.type).toBe('date');
    });
  });
});

describe('applyTimeBucketColumnTypes', () => {
  it('marks bucketed columns as date type', () => {
    const cols = inferColumns([
      { date_month: '2023-01', insults: 42 },
      { date_month: '2023-02', insults: 55 },
    ]);
    applyTimeBucketColumnTypes(cols, [{ field: 'date', bucket: 'month' }]);
    expect(cols.find(c => c.name === 'date_month')?.type).toBe('date');
  });

  it('marks year-bucketed columns as date', () => {
    const cols = inferColumns([
      { season_year: '2020', total: 100 },
      { season_year: '2021', total: 200 },
    ]);
    // Without bucket info, season_year could be numeric
    applyTimeBucketColumnTypes(cols, [{ field: 'season', bucket: 'year' }]);
    expect(cols.find(c => c.name === 'season_year')?.type).toBe('date');
  });

  it('does nothing without groupBy', () => {
    const cols = inferColumns([{ x: 1, y: 2 }]);
    applyTimeBucketColumnTypes(cols, undefined);
    expect(cols.find(c => c.name === 'x')?.type).toBe('numeric');
  });
});

describe('enhanceIntentForTimeBucket', () => {
  it('adds time series context when bucket present', () => {
    const intent = enhanceIntentForTimeBucket('compare insults', [{ field: 'date', bucket: 'month' }]);
    expect(intent).toContain('time series');
  });

  it('does not double-add if intent already mentions time', () => {
    const intent = enhanceIntentForTimeBucket('show time series of insults', [{ field: 'date', bucket: 'month' }]);
    expect(intent).toBe('show time series of insults');
  });

  it('returns intent unchanged without groupBy', () => {
    const intent = enhanceIntentForTimeBucket('compare insults', undefined);
    expect(intent).toBe('compare insults');
  });

  it('returns intent unchanged with non-bucketed groupBy', () => {
    const intent = enhanceIntentForTimeBucket('compare insults', ['region']);
    expect(intent).toBe('compare insults');
  });
});

describe('applyColorPreferences', () => {
  function makeBarSpec(): VisualizationSpec {
    return {
      pattern: 'bar',
      title: 'Test',
      data: [
        { region: 'North', revenue: 100 },
        { region: 'South', revenue: 200 },
      ],
      encoding: {
        x: { field: 'region', type: 'nominal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
      config: {},
    };
  }

  it('auto-infers colorField from nominal x-axis when palette set', () => {
    const spec = makeBarSpec();
    const result = applyColorPreferences(spec, { palette: 'warm' }, spec.data);
    expect(spec.encoding.color?.field).toBe('region');
    expect(spec.encoding.color?.palette).toBe('warm');
    expect(result.notes).toContainEqual(expect.stringContaining('auto-detected'));
  });

  it('returns note when no categorical column found for palette', () => {
    const spec: VisualizationSpec = {
      pattern: 'scatter',
      title: 'Test',
      data: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
      config: {},
    };
    const result = applyColorPreferences(spec, { palette: 'warm' }, spec.data);
    expect(spec.encoding.color?.field).toBeUndefined();
    expect(result.notes).toContainEqual(expect.stringContaining('ignored'));
  });

  it('returns note for unmatched highlight values', () => {
    const spec = makeBarSpec();
    spec.encoding.color = { field: 'region', type: 'nominal' };
    const result = applyColorPreferences(
      spec,
      { highlight: { values: ['North', 'Mars'] } },
      spec.data,
    );
    expect(result.notes).toContainEqual(expect.stringContaining("'Mars'"));
  });

  it('returns empty notes when no prefs provided', () => {
    const spec = makeBarSpec();
    const result = applyColorPreferences(spec, undefined);
    expect(result.notes).toEqual([]);
  });

  it('sets colorField directly when provided', () => {
    const spec = makeBarSpec();
    const result = applyColorPreferences(spec, { colorField: 'region' });
    expect(spec.encoding.color?.field).toBe('region');
    expect(spec.encoding.color?.type).toBe('nominal');
    expect(result.notes).toEqual([]);
  });
});
