/**
 * Bullet Chart — compact horizontal bar with target marker and qualitative range bands.
 *
 * The bullet chart replaces dashboard gauges and meters with a compact,
 * information-dense display. Shows a primary measure (actual) against a
 * comparative measure (target) with qualitative ranges providing context
 * (poor / satisfactory / good).
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const bulletPattern: VisualizationPattern = {
  id: 'bullet',
  name: 'Bullet Chart',
  category: 'comparison',
  description:
    'Compact horizontal bar showing a primary measure against a target with qualitative range bands (poor/satisfactory/good). Stephen Few\'s replacement for gauges and meters.',
  bestFor:
    'Dashboard KPI tracking with context: actual vs target vs qualitative assessment. Revenue vs quota, CPU usage vs threshold, NPS score vs benchmark.',
  notFor:
    'Many categories without targets (use bar chart), composition or part-to-whole (use stacked bar or donut), time series (use line or sparkline).',

  dataRequirements: {
    minRows: 1,
    maxRows: 12,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Metric name (label for each bullet)' },
      { type: 'numeric', count: 2, description: 'Actual value and target value (plus optional range thresholds)' },
    ],
    minCategories: 1,
    maxCategories: 12,
  },

  selectionRules: [
    {
      condition: 'Intent explicitly mentions bullet chart',
      weight: 90,
      matches: (ctx) => {
        return /\b(bullet\s*chart|bullet)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Intent mentions actual vs target, KPI tracking, or performance against benchmark',
      weight: 70,
      matches: (ctx) => {
        return /\b(vs\.?\s*target|versus\s*target|actual\s*vs|against\s*(target|benchmark|quota|threshold|goal)|kpi\s*(track|dashboard|monitor)|performance\s*(vs|against|to)\s*(target|benchmark|quota))\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Data has target-like columns — suggests actual vs target comparison',
      weight: 55,
      matches: (ctx) => {
        const colNames = ctx.columns.map((c) => c.name.toLowerCase());
        const hasActual = colNames.some((n) => /\b(actual|current|value|score|result)\b/.test(n));
        const hasTarget = colNames.some((n) => /\b(target|goal|benchmark|quota|threshold|budget)\b/.test(n));
        return hasActual && hasTarget;
      },
    },
    {
      condition: 'Few metrics with multiple numeric columns — good bullet chart candidate',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.rowCount >= 1 &&
          ctx.dataShape.rowCount <= 8 &&
          ctx.dataShape.numericColumnCount >= 2 &&
          ctx.dataShape.categoricalColumnCount >= 1
        );
      },
    },
    {
      condition: 'Penalize for time series data — use line or sparkline instead',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
    {
      condition: 'Penalize for too many rows — bullet charts are for few KPIs',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.rowCount > 12;
      },
    },
    {
      condition: 'Penalize when only one numeric column — need at least actual and target',
      weight: -50,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount < 2;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const numericCols = columns.filter((col) => {
      const sample = data[0]?.[col];
      return sample !== undefined && !isNaN(Number(sample));
    });

    const actualCol = options?.actualField ?? numericCols[0] ?? columns[1];
    const targetCol = options?.targetField ?? numericCols[1] ?? columns[2];
    const rangeFields = options?.rangeFields ?? numericCols.slice(2);

    const spec: VisualizationSpec = {
      pattern: 'bullet',
      title: options?.title ?? 'Performance vs Target',
      data,
      encoding: {
        x: {
          field: actualCol,
          type: 'quantitative',
          title: actualCol,
        },
        color: {
          field: categoryCol,
          type: 'nominal',
        },
      },
      config: {
        metricField: categoryCol,
        actualField: actualCol,
        targetField: targetCol,
        rangeFields: rangeFields.length > 0 ? rangeFields : undefined,
        sortBy: options?.sortBy ?? 'value',
        sortOrder: options?.sortOrder ?? 'descending',
        rangeLabels: options?.rangeLabels,
        showLabels: options?.showLabels ?? true,
      },
    };

    return spec;
  },
};
