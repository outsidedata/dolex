import { describe, it, expect } from 'vitest';
import { buildAnalysisPlan } from '../../src/analysis/planner.js';
import type { DataColumn } from '../../src/types.js';

function col(name: string, type: DataColumn['type'], overrides: Partial<DataColumn> = {}): DataColumn {
  return {
    name, type, sampleValues: [], uniqueCount: 10, nullCount: 0, totalCount: 100,
    ...overrides,
  };
}

describe('buildAnalysisPlan', () => {
  it('generates a plan from a typical sales dataset', () => {
    const columns: DataColumn[] = [
      col('order_date', 'date', { uniqueCount: 365 }),
      col('region', 'categorical', { uniqueCount: 5 }),
      col('revenue', 'numeric', { uniqueCount: 80, stats: { min: 10, max: 5000, mean: 500, median: 400, stddev: 300, p25: 200, p75: 700 } }),
    ];
    const plan = buildAnalysisPlan(columns, 'sales', 'sales');
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(plan.steps.length).toBeLessThanOrEqual(6);
    expect(plan.summary).toContain('sales');
    const categories = plan.steps.map(s => s.category);
    expect(categories).toContain('trend');
  });

  it('respects maxSteps', () => {
    const columns: DataColumn[] = [
      col('date', 'date', { uniqueCount: 365 }),
      col('region', 'categorical', { uniqueCount: 5 }),
      col('product', 'categorical', { uniqueCount: 30 }),
      col('revenue', 'numeric', { uniqueCount: 80 }),
      col('quantity', 'numeric', { uniqueCount: 50 }),
    ];
    const plan = buildAnalysisPlan(columns, 'sales', 'sales', 3);
    expect(plan.steps.length).toBeLessThanOrEqual(3);
  });

  it('diversifies categories — no two steps have the same category', () => {
    const columns: DataColumn[] = [
      col('date', 'date', { uniqueCount: 365 }),
      col('region', 'categorical', { uniqueCount: 5 }),
      col('product', 'categorical', { uniqueCount: 30 }),
      col('revenue', 'numeric', { uniqueCount: 80 }),
      col('quantity', 'numeric', { uniqueCount: 50 }),
    ];
    const plan = buildAnalysisPlan(columns, 'sales', 'sales');
    const categories = plan.steps.map(s => s.category);
    const uniqueCategories = new Set(categories);
    expect(uniqueCategories.size).toBe(categories.length);
  });

  it('handles no-measure datasets gracefully', () => {
    const columns: DataColumn[] = [
      col('name', 'categorical', { uniqueCount: 50 }),
      col('category', 'categorical', { uniqueCount: 5 }),
    ];
    const plan = buildAnalysisPlan(columns, 'items', 'items');
    expect(plan.steps.length).toBe(0);
    expect(plan.summary).toBeTruthy();
  });

  it('handles single-column datasets', () => {
    const columns: DataColumn[] = [
      col('value', 'numeric', { uniqueCount: 80 }),
    ];
    const plan = buildAnalysisPlan(columns, 'data', 'data');
    expect(plan.steps.length).toBeGreaterThanOrEqual(1);
    expect(plan.steps[0].category).toBe('distribution');
  });

  it('all step queries have valid table field', () => {
    const columns: DataColumn[] = [
      col('date', 'date', { uniqueCount: 90 }),
      col('region', 'categorical', { uniqueCount: 6 }),
      col('amount', 'numeric', { uniqueCount: 70 }),
    ];
    const plan = buildAnalysisPlan(columns, 'orders', 'orders');
    for (const step of plan.steps) {
      expect(step.table).toBe('orders');
    }
  });
});
