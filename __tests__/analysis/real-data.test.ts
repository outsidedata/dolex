// __tests__/analysis/real-data.test.ts
import { describe, it, expect } from 'vitest';
import { buildAnalysisPlan } from '../../src/analysis/planner.js';
import type { DataColumn } from '../../src/types.js';

describe('real-data integration', () => {
  it('analyzes a sales-style dataset (date + region + revenue + quantity)', () => {
    const columns: DataColumn[] = [
      { name: 'date', type: 'date', sampleValues: ['2024-01-01'], uniqueCount: 365, nullCount: 0, totalCount: 10000 },
      { name: 'region', type: 'categorical', sampleValues: ['North', 'South', 'East', 'West'], uniqueCount: 4, nullCount: 0, totalCount: 10000 },
      { name: 'product', type: 'categorical', sampleValues: ['Widget A'], uniqueCount: 25, nullCount: 0, totalCount: 10000 },
      { name: 'revenue', type: 'numeric', sampleValues: [], uniqueCount: 5000, nullCount: 0, totalCount: 10000,
        stats: { min: 5, max: 10000, mean: 500, median: 350, stddev: 400, p25: 150, p75: 700 } },
      { name: 'quantity', type: 'numeric', sampleValues: [], uniqueCount: 100, nullCount: 0, totalCount: 10000 },
    ];

    const plan = buildAnalysisPlan(columns, 'sales', 'sales-data');
    expect(plan.steps.length).toBeGreaterThanOrEqual(4);

    const categories = plan.steps.map(s => s.category);
    expect(categories).toContain('trend');
    expect(categories).toContain('comparison');
    expect(categories).toContain('distribution');
  });

  it('analyzes a single-measure dataset', () => {
    const columns: DataColumn[] = [
      { name: 'temperature', type: 'numeric', sampleValues: [], uniqueCount: 200, nullCount: 0, totalCount: 1000,
        stats: { min: -10, max: 45, mean: 22, median: 21, stddev: 8, p25: 15, p75: 28 } },
    ];

    const plan = buildAnalysisPlan(columns, 'weather', 'temps');
    expect(plan.steps.length).toBe(1);
    expect(plan.steps[0].category).toBe('distribution');
  });

  it('analyzes a dataset with only categoricals — returns empty plan', () => {
    const columns: DataColumn[] = [
      { name: 'country', type: 'categorical', sampleValues: ['US', 'UK'], uniqueCount: 30, nullCount: 0, totalCount: 500 },
      { name: 'language', type: 'categorical', sampleValues: ['en', 'fr'], uniqueCount: 10, nullCount: 0, totalCount: 500 },
    ];

    const plan = buildAnalysisPlan(columns, 'users', 'user-data');
    expect(plan.steps.length).toBe(0);
  });

  it('analyzes a two-numeric dataset — gets distribution + relationship', () => {
    const columns: DataColumn[] = [
      { name: 'height', type: 'numeric', sampleValues: [], uniqueCount: 150, nullCount: 0, totalCount: 500 },
      { name: 'weight', type: 'numeric', sampleValues: [], uniqueCount: 120, nullCount: 0, totalCount: 500 },
    ];

    const plan = buildAnalysisPlan(columns, 'people', 'body-measurements');
    const categories = plan.steps.map(s => s.category);
    expect(categories).toContain('distribution');
    expect(categories).toContain('relationship');
  });

  it('all generated SQL queries are valid strings', () => {
    const columns: DataColumn[] = [
      { name: 'date', type: 'date', sampleValues: ['2024-01-01'], uniqueCount: 90, nullCount: 0, totalCount: 1000 },
      { name: 'category', type: 'categorical', sampleValues: ['A', 'B', 'C'], uniqueCount: 3, nullCount: 0, totalCount: 1000 },
      { name: 'amount', type: 'numeric', sampleValues: [], uniqueCount: 500, nullCount: 0, totalCount: 1000 },
      { name: 'score', type: 'numeric', sampleValues: [], uniqueCount: 100, nullCount: 0, totalCount: 1000 },
    ];

    const plan = buildAnalysisPlan(columns, 'data', 'test-data');
    for (const step of plan.steps) {
      expect(typeof step.sql).toBe('string');
      expect(step.sql.length).toBeGreaterThan(0);
      expect(step.sql.toUpperCase()).toContain('SELECT');
      expect(step.table).toBe('data');
      expect(step.suggestedPatterns.length).toBeGreaterThan(0);
      expect(step.intent).toBeTruthy();
      expect(step.title).toBeTruthy();
    }
  });

  it('handles dataset with IDs gracefully — ignores ID columns', () => {
    const columns: DataColumn[] = [
      { name: 'user_id', type: 'id', sampleValues: ['1', '2', '3'], uniqueCount: 1000, nullCount: 0, totalCount: 1000 },
      { name: 'age', type: 'numeric', sampleValues: [], uniqueCount: 70, nullCount: 5, totalCount: 1000 },
      { name: 'city', type: 'categorical', sampleValues: ['NYC', 'LA'], uniqueCount: 15, nullCount: 0, totalCount: 1000 },
    ];

    const plan = buildAnalysisPlan(columns, 'users', 'user-data');
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    // Should not reference user_id in any step's SQL
    for (const step of plan.steps) {
      expect(step.sql).not.toContain('user_id');
    }
  });
});
