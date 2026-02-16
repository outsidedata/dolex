/**
 * Violin Plot — distribution shape comparison.
 *
 * Combines a box plot with a kernel density estimate, showing
 * the full shape of each distribution. Superior to box plots
 * because bimodal and multimodal distributions are clearly visible.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const violinPattern: VisualizationPattern = {
  id: 'violin',
  name: 'Violin Plot',
  category: 'distribution',
  description:
    'Mirrored density curves for each group, showing the full distribution shape. Reveals bimodality, skewness, and distribution differences that box plots hide.',
  bestFor:
    'Comparing distribution shapes across 2-8 groups. Finding bimodal distributions. Understanding where data is concentrated.',
  notFor:
    'Single group (use histogram), many groups over 10 (use ridgeline), small sample sizes under 30 per group (density estimate unreliable).',

  dataRequirements: {
    minRows: 30,
    requiredColumns: [
      { type: 'numeric', count: 1, description: 'Value to show distribution of' },
      { type: 'categorical', count: 1, description: 'Group variable (2-8 groups)' },
    ],
    minCategories: 2,
    maxCategories: 8,
  },

  selectionRules: [
    {
      condition: 'Comparing distributions across groups — violin shows shape',
      weight: 65,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.categoryCount >= 2 &&
          ctx.dataShape.categoryCount <= 8 &&
          ctx.dataShape.rowCount >= 30
        );
      },
    },
    {
      condition: 'Intent mentions distribution comparison or shape',
      weight: 50,
      matches: (ctx) => {
        return /\b(distribut|shape|compar.+(distribut|spread)|violin|density|bimodal|multimodal)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Enough data per group for reliable density estimation',
      weight: 30,
      matches: (ctx) => {
        if (ctx.dataShape.categoryCount === 0) return false;
        const avgPerGroup = ctx.dataShape.rowCount / ctx.dataShape.categoryCount;
        return avgPerGroup >= 20;
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
      condition: 'Penalize for too many groups — use ridgeline instead',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 8;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const valueCol = columns[0];
    const groupCol = columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'violin',
      title: options?.title ?? `Distribution of ${valueCol} by ${groupCol}`,
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
        sortBy: options?.sortBy ?? 'value',
        sortOrder: options?.sortOrder ?? 'descending',
        showBoxPlot: options?.showBoxPlot ?? true,
        showMedian: options?.showMedian ?? true,
        showQuartiles: options?.showQuartiles ?? true,
        bandwidth: options?.bandwidth ?? 'auto',
      },
    };

    return spec;
  },
};
