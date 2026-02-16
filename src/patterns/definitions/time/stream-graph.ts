/**
 * Stream Graph — stacked area with flowing, organic baseline.
 *
 * Layers flow around a central axis using wiggle or silhouette offset,
 * creating an organic, flowing shape that emphasizes composition
 * evolution over time.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const streamGraphPattern: VisualizationPattern = {
  id: 'stream-graph',
  name: 'Stream Graph',
  category: 'time',
  description:
    'Stacked area chart with a flowing, organic baseline (centered or wiggle layout). Layers flow around a central axis, emphasizing how composition evolves over time.',
  bestFor:
    'Showing how composition evolves over time with an emphasis on flow and organic shape. Music genre popularity over decades, topic trends over time, seasonal patterns by category.',
  notFor:
    'Precise value reading (wiggle offset makes y values meaningless). Few series (<3). Non-temporal data.',

  dataRequirements: {
    minRows: 6,
    requiredColumns: [
      { type: 'date', count: 1, description: 'Time axis' },
      { type: 'numeric', count: 1, description: 'Value per series per time point' },
      { type: 'categorical', count: 1, description: 'Series/category identifier' },
    ],
    requiresTimeSeries: true,
    minCategories: 3,
    maxCategories: 15,
  },

  selectionRules: [
    {
      condition: 'Intent explicitly mentions stream graph or streamgraph',
      weight: 90,
      matches: (ctx) => {
        return /\b(stream\s*graph|streamgraph|stream\s*chart)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Temporal composition with many series and flow/organic/evolution intent',
      weight: 65,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.seriesCount >= 3 &&
          ctx.dataShape.seriesCount <= 15 &&
          /\b(flow|organic|evolut|trend|composition\s+over\s+time|how\s+.*\s+change|popularity|genre|topic)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Time series with many categories — stream graph handles visual density well',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.seriesCount >= 5 &&
          ctx.dataShape.seriesCount <= 15 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Penalize when no time dimension exists',
      weight: -50,
      matches: (ctx) => {
        return !ctx.dataShape.hasTimeSeries && ctx.dataShape.dateColumnCount === 0;
      },
    },
    {
      condition: 'Penalize for too few series — stacked area or line is better',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount < 3;
      },
    },
    {
      condition: 'Penalize for too many series — visual clutter',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount > 15;
      },
    },
    {
      condition: 'Penalize when precise value reading is needed',
      weight: -20,
      matches: (ctx) => {
        return /\b(exact|precise|compare\s+values|difference|rank)\b/i.test(ctx.intent);
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const dateCol = columns[0];
    const valueCol = columns.length > 1 ? columns[1] : columns[0];
    const seriesCol = columns.length > 2 ? columns[2] : undefined;

    const spec: VisualizationSpec = {
      pattern: 'stream-graph',
      title: options?.title ?? `${valueCol} streams over time`,
      data,
      encoding: {
        x: {
          field: dateCol,
          type: 'temporal',
          title: dateCol,
        },
        y: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        color: seriesCol
          ? {
              field: seriesCol,
              type: 'nominal',
              title: seriesCol,
            }
          : undefined,
      },
      config: {
        timeField: dateCol,
        valueField: valueCol,
        seriesField: seriesCol ?? null,
        offset: options?.offset ?? 'wiggle',
        curve: options?.curve ?? 'basis',
        interactive: options?.interactive ?? true,
      },
    };

    return spec;
  },
};
