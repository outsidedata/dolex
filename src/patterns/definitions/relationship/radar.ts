/**
 * Radar Chart (Spider Chart) — multivariate profile.
 *
 * A radial chart where each axis extends from the center,
 * one per variable. The resulting polygon shows the "shape"
 * of an entity's profile. Best for comparing 1-3 entities
 * across 5-10 dimensions.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const radarPattern: VisualizationPattern = {
  id: 'radar',
  name: 'Radar Chart',
  category: 'relationship',
  description:
    'Radial axes extending from a center point, one per variable. Each entity forms a polygon. The shape reveals strengths, weaknesses, and overall profile.',
  bestFor:
    'Comparing 1-3 entity profiles across 5-10 dimensions: player stat comparison, product feature comparison, skill assessment, balanced scorecard.',
  notFor:
    'Many entities over 4 (polygons overlap), many dimensions over 12 (too dense), precise value comparison (radial distorts area).',

  dataRequirements: {
    minRows: 1,
    maxRows: 12,
    requiredColumns: [
      { type: 'numeric', count: 3, description: 'Three or more metrics forming the profile' },
    ],
  },

  selectionRules: [
    {
      condition: 'Few entities (1-3) with many metrics — radar shows the full profile shape',
      weight: 75,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 4 &&
          ctx.dataShape.numericColumnCount <= 12 &&
          ctx.dataShape.rowCount >= 1 &&
          ctx.dataShape.rowCount <= 4
        );
      },
    },
    {
      condition: 'Intent mentions profile, strengths/weaknesses, or radar',
      weight: 60,
      matches: (ctx) => {
        return /\b(profile|strength|weakness|radar|spider|skill|balanced|assessment|scorecard|attribute|stat|characteristic)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Comparing exactly 2 entities across multiple metrics — radar overlay is powerful',
      weight: 50,
      matches: (ctx) => {
        return (
          ctx.dataShape.rowCount === 2 &&
          ctx.dataShape.numericColumnCount >= 4
        );
      },
    },
    {
      condition: 'Penalize for many entities — polygons become unreadable',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.rowCount > 4;
      },
    },
    {
      condition: 'Penalize for few dimensions — scatter or bar is clearer',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount < 4;
      },
    },
    {
      condition: 'Penalize for many dimensions — too dense to read',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount > 12;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const entityCol = columns.find((_col, i) => {
      // First column is often the entity label
      return i === 0 && data.length > 1;
    }) ?? columns[0];

    // All other columns are metric dimensions
    const metricCols = columns.filter((col) => col !== entityCol);

    // Normalize values to 0-1 range for each metric
    const normalizedData = data.map((row) => {
      const normalized: Record<string, any> = { ...row };
      for (const col of metricCols) {
        const values = data.map((d) => Number(d[col]) || 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        normalized[`_norm_${col}`] = ((Number(row[col]) || 0) - min) / range;
      }
      return normalized;
    });

    const spec: VisualizationSpec = {
      pattern: 'radar',
      title: options?.title ?? `Profile comparison`,
      data: normalizedData,
      encoding: {
        angle: {
          field: '_dimension',
          type: 'nominal',
        },
        radius: {
          field: '_value',
          type: 'quantitative',
        },
        color: data.length > 1
          ? {
              field: entityCol,
              type: 'nominal',
              title: entityCol,
            }
          : undefined,
      },
      config: {
        categoryField: entityCol,
        dimensions: metricCols,
        showLabels: options?.showLabels ?? true,
        showGrid: options?.showGrid ?? true,
        gridLevels: options?.gridLevels ?? 5,
        fillOpacity: options?.fillOpacity ?? 0.2,
        strokeWidth: options?.strokeWidth ?? 2,
        dotRadius: options?.dotRadius ?? 4,
      },
    };

    return spec;
  },
};
