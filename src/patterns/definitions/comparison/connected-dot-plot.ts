/**
 * Connected Dot Plot — two metrics per category.
 *
 * Also called a "dumbbell chart" or "Cleveland dot plot".
 * Shows two values per category connected by a line, making
 * the gap between them the primary visual. Far clearer than
 * grouped bars for comparing two measures.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const connectedDotPlotPattern: VisualizationPattern = {
  id: 'connected-dot-plot',
  name: 'Connected Dot Plot',
  category: 'comparison',
  description:
    'Two dots per category connected by a line. The length of the connecting line encodes the gap between two values, making differences immediately visible.',
  bestFor:
    'Comparing two metrics per category: budget vs actual, male vs female, 2020 vs 2024, target vs achieved.',
  notFor:
    'Single metric (use bar), more than 2 metrics (use parallel coordinates or radar), time series with many points (use line).',

  dataRequirements: {
    minRows: 3,
    maxRows: 30,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Category labels' },
      { type: 'numeric', count: 2, description: 'Two values to compare per category' },
    ],
    minCategories: 3,
    maxCategories: 20,
  },

  selectionRules: [
    {
      condition: 'Exactly 2 numeric columns — connected dot plot is superior to grouped bar',
      weight: 70,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount === 2 &&
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.categoryCount >= 3 &&
          ctx.dataShape.categoryCount <= 20
        );
      },
    },
    {
      condition: 'Intent mentions comparing two things per category',
      weight: 50,
      matches: (ctx) => {
        return /\b(budget\s*vs|actual\s*vs|male\s*(and|vs)|female\s*(and|vs)|gap|both|two\s+metric|dual|paired|dumbbell)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Intent mentions range or span between values',
      weight: 40,
      matches: (ctx) => {
        return /\b(range|span|min.+max|low.+high|start.+end)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Penalize for single metric',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount < 2;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const metric1Col = columns.length > 1 ? columns[1] : columns[0];
    const metric2Col = columns.length > 2 ? columns[2] : metric1Col;

    const spec: VisualizationSpec = {
      pattern: 'connected-dot-plot',
      title: options?.title ?? `${metric1Col} vs ${metric2Col} by ${categoryCol}`,
      data,
      encoding: {
        y: {
          field: categoryCol,
          type: 'nominal',
          title: categoryCol,
          sort: null,
        },
        x: {
          field: metric1Col,
          type: 'quantitative',
          title: `${metric1Col} / ${metric2Col}`,
        },
        color: {
          scale: {
            domain: [metric1Col, metric2Col],
            range: options?.colors ?? ['#4e79a7', '#e15759'],
          },
        },
      },
      config: {
        metric1Field: metric1Col,
        metric2Field: metric2Col,
        categoryField: categoryCol,
        showLabels: options?.showLabels ?? true,
        showDifference: options?.showDifference ?? true,
        sortBy: options?.sortBy ?? 'gap',
        sortOrder: options?.sortOrder ?? 'descending',
      },
    };

    return spec;
  },
};
