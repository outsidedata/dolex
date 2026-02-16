/**
 * Grouped Bar — side-by-side bars for multi-metric comparison.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const groupedBarPattern: VisualizationPattern = {
  id: 'grouped-bar',
  name: 'Grouped Bar Chart',
  category: 'comparison',
  description:
    'Side-by-side bars for comparing multiple metrics or series across categories. Nested groups with color-coded series.',
  bestFor:
    'Direct comparison of 2-4 metrics per category: revenue vs cost by department, male vs female enrollment by year, Q1 vs Q2 sales by product.',
  notFor:
    'Single metric (use bar), part-to-whole (use stacked-bar), >5 series (too many bars per group), time series (use line).',

  dataRequirements: {
    minRows: 4,
    maxRows: 100,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Group category' },
      { type: 'numeric', count: 1, description: 'Value to compare' },
    ],
    minCategories: 2,
    maxCategories: 20,
  },

  selectionRules: [
    {
      condition: 'Intent explicitly mentions grouped bar or side-by-side bar',
      weight: 90,
      matches: (ctx) => {
        return /\b(grouped?\s*bar|side[\s-]*by[\s-]*side\s*bar|clustered?\s*bar)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Two categorical columns + one numeric — classic grouped bar shape',
      weight: 55,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          !ctx.dataShape.hasTimeSeries
        );
      },
    },
    {
      condition: 'Multiple numeric columns with categories — compare metrics side by side',
      weight: 50,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.numericColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount <= 5 &&
          !ctx.dataShape.hasTimeSeries
        );
      },
    },
    {
      condition: 'Intent mentions comparing multiple metrics',
      weight: 25,
      matches: (ctx) => {
        return /\b(compar\w+\s+(multiple|several|different)\s+(metric|measure|value|series)|side[\s-]*by[\s-]*side|grouped)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Penalize for single numeric column with single categorical — regular bar is simpler',
      weight: -30,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount === 1 &&
          ctx.dataShape.categoricalColumnCount === 1
        );
      },
    },
    {
      condition: 'Penalize for too many series (>5)',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount > 5;
      },
    },
    {
      condition: 'Penalize for time series data',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const seriesCol = columns.length > 2 ? columns[1] : undefined;
    const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'grouped-bar',
      title: options?.title ?? `Comparison by ${categoryCol}`,
      data,
      encoding: {
        x: { field: categoryCol, type: 'nominal', title: categoryCol },
        y: { field: valueCol, type: 'quantitative', title: valueCol },
        color: seriesCol
          ? { field: seriesCol, type: 'nominal', scale: {} }
          : { field: categoryCol, type: 'nominal', scale: {} },
      },
      config: {
        categoryField: categoryCol,
        seriesField: seriesCol,
        valueField: valueCol,
        orientation: options?.orientation ?? 'vertical',
      },
    };

    return spec;
  },
};
