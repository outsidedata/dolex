/**
 * Slope Chart — two-point comparison.
 *
 * Shows change between exactly two time points or conditions.
 * Far more effective than side-by-side bars for showing direction
 * and magnitude of change. The slope of each line tells the story.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const slopeChartPattern: VisualizationPattern = {
  id: 'slope-chart',
  name: 'Slope Chart',
  category: 'comparison',
  description:
    'Lines connecting two points per category, showing change between two states. The angle of each slope communicates direction and magnitude of change at a glance.',
  bestFor:
    'Before/after comparisons, two-year trends, start vs end, A/B test results, policy change impacts.',
  notFor:
    'More than 2 time points (use line chart), single time point (use bar), more than 15 categories (too cluttered).',

  dataRequirements: {
    minRows: 4,
    maxRows: 60,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Category (each gets a slope line)' },
      { type: 'numeric', count: 1, description: 'Value metric' },
    ],
    minCategories: 2,
    maxCategories: 15,
  },

  selectionRules: [
    {
      condition: 'Exactly 2 time points or conditions — slope chart is the best choice',
      weight: 80,
      matches: (ctx) => {
        // Look for exactly 2 unique values in a date or secondary categorical column
        const { dateColumnCount, categoricalColumnCount } = ctx.dataShape;
        if (dateColumnCount >= 1) {
          const dateCol = ctx.columns.find((c) => c.type === 'date');
          if (dateCol && dateCol.uniqueCount === 2) return true;
        }
        if (categoricalColumnCount >= 2) {
          // Check if any categorical column has exactly 2 values (e.g., "before"/"after")
          const secondaryCats = ctx.columns.filter((c) => c.type === 'categorical');
          if (secondaryCats.some((c) => c.uniqueCount === 2)) return true;
        }
        return false;
      },
    },
    {
      condition: 'Intent mentions before/after, start/end, or two-point comparison',
      weight: 60,
      matches: (ctx) => {
        return /\b(before|after|start|end|then|now|initial|final|first|last|two\s*(year|point|period)|vs\.?\s|versus|a\s*\/\s*b|change\s+from|compared\s+to)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Penalize for many time points — use line chart instead',
      weight: -50,
      matches: (ctx) => {
        const dateCols = ctx.columns.filter((c) => c.type === 'date');
        return dateCols.some((c) => c.uniqueCount > 3);
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];
    const periodCol = columns.length > 2 ? columns[1] : columns.length > 1 ? columns[0] : columns[0];

    // Determine the two periods
    const periods = [...new Set(data.map((d) => d[periodCol]))].slice(0, 2);

    const spec: VisualizationSpec = {
      pattern: 'slope-chart',
      title: options?.title ?? `${valueCol}: ${periods[0]} vs ${periods[1]}`,
      data,
      encoding: {
        x: {
          field: periodCol,
          type: 'ordinal',
          title: periodCol,
        },
        y: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        color: {
          field: categoryCol,
          type: 'nominal',
        },
      },
      config: {
        periods,
        categoryField: categoryCol,
        valueField: valueCol,
        timeField: periodCol,
        showLabels: true,
      },
    };

    return spec;
  },
};
