/**
 * Alluvial Diagram — categorical flow over time.
 *
 * Like a Sankey but with a temporal dimension. Shows how
 * entities move between categorical states across ordered
 * stages (often time periods). The flows between columns
 * reveal transitions, retention, and churn.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const alluvialPattern: VisualizationPattern = {
  id: 'alluvial',
  name: 'Alluvial Diagram',
  category: 'flow',
  description:
    'Flows between categorical columns ordered left-to-right (often time). Shows how entities transition between states across stages: retention, churn, and movement.',
  bestFor:
    'State transitions over time: customer segments changing over quarters, voting patterns across elections, career paths, cohort movement.',
  notFor:
    'Non-temporal flows (use Sankey), simple composition (use stacked bar), very many categories per stage (too many flows).',

  dataRequirements: {
    minRows: 5,
    maxRows: 500,
    requiredColumns: [
      { type: 'categorical', count: 2, description: 'States at different stages/time periods' },
      { type: 'numeric', count: 1, description: 'Flow quantity between states' },
    ],
  },

  selectionRules: [
    {
      condition: 'Temporal categorical transitions — alluvial shows state changes over time',
      weight: 80,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Intent mentions transitions, movement, or changes over stages',
      weight: 60,
      matches: (ctx) => {
        return /\b(transition|movement|churn|retention|cohort|switch|migrat|convert|stage|phase|path|alluvial|from.+to.+over)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Multiple categorical columns with an ordering — natural for alluvial',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 3 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Penalize when not temporal — use Sankey for static flows',
      weight: -20,
      matches: (ctx) => {
        return !ctx.dataShape.hasTimeSeries && ctx.dataShape.dateColumnCount === 0;
      },
    },
    {
      condition: 'Penalize for too many categories per stage — flows become unreadable',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 15;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const stageColumns = columns.filter((_, i) => i < columns.length - 1);
    const valueCol = columns[columns.length - 1];

    // If only two columns, treat first as combined "source_stage" info
    const stages = stageColumns.length >= 2
      ? stageColumns
      : [columns[0], columns.length > 1 ? columns[1] : columns[0]];

    const spec: VisualizationSpec = {
      pattern: 'alluvial',
      title: options?.title ?? `Flow across ${stages.join(' → ')}`,
      data,
      encoding: {
        stages: stages.map((col) => ({
          field: col,
          type: 'nominal' as const,
          title: col,
        })),
        size: {
          field: valueCol,
          type: 'quantitative' as const,
          title: valueCol,
          range: [1, 50] as [number, number],
        },
        color: {
          field: stages[0],
          type: 'nominal',
          title: stages[0],
        },
      },
      config: {
        stageFields: stages,
        valueField: valueCol,
        nodeWidth: options?.nodeWidth ?? 20,
        nodePadding: options?.nodePadding ?? 10,
        flowOpacity: options?.flowOpacity ?? 0.4,
        showLabels: options?.showLabels ?? true,
        showValues: options?.showValues ?? false,
        colorBy: options?.colorBy ?? 'source',
      },
    };

    return spec;
  },
};
