/**
 * Ridgeline Plot — multiple overlapping distributions.
 *
 * Also called a "joy plot". Stacks density curves vertically,
 * allowing comparison of many distributions in a compact space.
 * Works beautifully when you have 5-30 groups to compare.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const ridgelinePattern: VisualizationPattern = {
  id: 'ridgeline',
  name: 'Ridgeline Plot',
  category: 'distribution',
  description:
    'Overlapping density curves stacked vertically. Compact way to compare many distributions simultaneously, revealing patterns across groups.',
  bestFor:
    'Comparing distributions across many groups (5-30): temperature by month, ratings by genre, scores by department.',
  notFor:
    'Few groups under 4 (use violin), single variable (use histogram), very small sample sizes per group.',

  dataRequirements: {
    minRows: 50,
    requiredColumns: [
      { type: 'numeric', count: 1, description: 'Value to show distribution of' },
      { type: 'categorical', count: 1, description: 'Group variable (5-30 groups ideal)' },
    ],
    minCategories: 4,
    maxCategories: 30,
  },

  selectionRules: [
    {
      condition: 'Many groups to compare (5-30) — ridgeline excels over violin',
      weight: 75,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.categoryCount >= 5 &&
          ctx.dataShape.categoryCount <= 30 &&
          ctx.dataShape.rowCount >= 50
        );
      },
    },
    {
      condition: 'Intent mentions multiple distributions or many groups',
      weight: 50,
      matches: (ctx) => {
        return /\b(ridgeline|joy\s*plot|all\s+(distribut|groups)|each\s+(month|year|group|category)|across\s+all|by\s+month|by\s+year)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Monthly or time-based grouping with enough data',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoryCount >= 5 &&
          ctx.dataShape.categoryCount <= 12 &&
          /\b(month|season|quarter|year)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Penalize for too few groups — use violin instead',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount < 4;
      },
    },
    {
      condition: 'Penalize for insufficient data per group',
      weight: -30,
      matches: (ctx) => {
        if (ctx.dataShape.categoryCount === 0) return false;
        const avgPerGroup = ctx.dataShape.rowCount / ctx.dataShape.categoryCount;
        return avgPerGroup < 10;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const valueCol = columns[0];
    const groupCol = columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'ridgeline',
      title: options?.title ?? `${valueCol} distribution by ${groupCol}`,
      data,
      encoding: {
        x: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        y: {
          field: groupCol,
          type: 'nominal',
          title: groupCol,
        },
        color: {
          field: groupCol,
          type: 'nominal',
        },
      },
      config: {
        valueField: valueCol,
        categoryField: groupCol,
        overlap: options?.overlap ?? 0.6,
        bandwidth: options?.bandwidth ?? 'auto',
        fillOpacity: options?.fillOpacity ?? 0.7,
        strokeWidth: options?.strokeWidth ?? 1.5,
      },
    };

    return spec;
  },
};
