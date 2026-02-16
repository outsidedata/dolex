/**
 * Box Plot — compact distribution summary.
 *
 * Shows quartiles, median, whiskers, and outliers for numeric data
 * across groups. The fundamental distribution summary chart.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const boxPlotPattern: VisualizationPattern = {
  id: 'box-plot',
  name: 'Box Plot',
  category: 'distribution',
  description:
    'Quartile summary showing median, Q1/Q3 box, whiskers, and outliers. Compact distribution comparison across groups.',
  bestFor:
    'Comparing distributions across 2-12 groups with a compact summary. Salary by department, test scores by school, response times by endpoint.',
  notFor:
    'Single group with no comparison (use histogram). Showing distribution shape detail (use violin). Very few data points per group under 5.',

  dataRequirements: {
    minRows: 10,
    requiredColumns: [
      { type: 'numeric', count: 1, description: 'Value to analyze' },
      { type: 'categorical', count: 1, description: 'Group variable (2-12 groups)' },
    ],
    minCategories: 2,
    maxCategories: 20,
  },

  selectionRules: [
    {
      condition: 'Numeric values grouped by categories — box plot summarizes distribution',
      weight: 55,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.categoryCount >= 2 &&
          ctx.dataShape.categoryCount <= 12 &&
          ctx.dataShape.rowCount >= 10
        );
      },
    },
    {
      condition: 'Intent mentions box plot, quartile, outlier, or compact distribution summary',
      weight: 60,
      matches: (ctx) => {
        return /\b(box\s*plot|boxplot|quartile|outlier|whisker|iqr|interquartile)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Medium-sized groups with enough data for meaningful quartiles',
      weight: 25,
      matches: (ctx) => {
        if (ctx.dataShape.categoryCount === 0) return false;
        const avgPerGroup = ctx.dataShape.rowCount / ctx.dataShape.categoryCount;
        return avgPerGroup >= 5 && avgPerGroup <= 500;
      },
    },
    {
      condition: 'Penalize for single group — use histogram instead',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount === 0 || ctx.dataShape.categoryCount < 2;
      },
    },
    {
      condition: 'Penalize for too many groups — consider ridgeline or violin',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 12;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const valueCol = columns[0];
    const groupCol = columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'box-plot',
      title: options?.title ?? `${valueCol} by ${groupCol}`,
      data,
      encoding: {
        x: {
          field: groupCol,
          type: 'nominal',
          title: groupCol,
        },
        y: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        color: {
          field: groupCol,
          type: 'nominal',
        },
      },
      config: {
        valueField: valueCol,
        categoryField: groupCol,
        orientation: options?.orientation ?? 'vertical',
        sortBy: options?.sortBy ?? 'value',
        sortOrder: options?.sortOrder ?? 'descending',
        whiskerType: options?.whiskerType ?? 'iqr',
        showOutliers: options?.showOutliers ?? true,
        showMean: options?.showMean ?? false,
      },
    };

    return spec;
  },
};
