/**
 * MCP Tool: list_patterns
 * Returns all available visualization patterns with their descriptions,
 * best-for hints, data requirements, per-pattern capabilities, and
 * full color system documentation.
 */

import type { VisualizationPattern } from '../../types.js';
import { jsonResponse } from './shared.js';

// ─── PER-PATTERN CAPABILITIES ───────────────────────────────────────────────

interface PatternCapability {
  colorEncoding: string;
  configOptions?: Record<string, string>;
}

const PATTERN_CAPABILITIES: Record<string, PatternCapability> = {
  'bar': {
    colorEncoding: 'Supports palette, highlight (emphasize specific bars), color.field for multi-series',
  },
  'diverging-bar': {
    colorEncoding: 'Automatic positive/negative coloring. Supports palette (diverging palettes recommended: blueRed, greenPurple, tealOrange)',
  },
  'stacked-bar': {
    colorEncoding: 'Color mapped to series field. Supports palette, highlight specific series',
  },
  'slope-chart': {
    colorEncoding: 'Color mapped to category. Supports palette, highlight specific categories',
  },
  'connected-dot-plot': {
    colorEncoding: 'Color distinguishes start/end points. Supports palette, highlight specific categories',
  },
  'bump-chart': {
    colorEncoding: 'Color mapped to entity/series. Supports palette, highlight specific entities',
  },
  'histogram': {
    colorEncoding: 'Single-color bars by default. Supports palette for fill color',
  },
  'beeswarm': {
    colorEncoding: 'Supports palette, highlight, color.field for group coloring',
  },
  'violin': {
    colorEncoding: 'Color mapped to group. Supports palette',
    configOptions: { bandwidth: 'number (kernel bandwidth, default: auto-calculated)' },
  },
  'ridgeline': {
    colorEncoding: 'Color per distribution row. Supports palette',
    configOptions: { bandwidth: 'number (kernel bandwidth, default: auto-calculated)' },
  },
  'strip-plot': {
    colorEncoding: 'Supports palette, highlight, color.field for group coloring',
  },
  'box-plot': {
    colorEncoding: 'Color mapped to group. Supports palette',
    configOptions: {
      whiskerType: '"iqr" | "minmax" (whisker extent, default: "iqr")',
      showOutliers: 'boolean (show outlier dots beyond whiskers, default: true)',
      showMean: 'boolean (show diamond mean marker, default: false)',
    },
  },
  'waffle': {
    colorEncoding: 'Color mapped to category. Supports palette, highlight',
  },
  'treemap': {
    colorEncoding: 'Color mapped to category/parent. Supports palette, highlight',
  },
  'sunburst': {
    colorEncoding: 'Color mapped to hierarchy level. Supports palette',
  },
  'circle-pack': {
    colorEncoding: 'Color mapped to group/parent. Supports palette, highlight',
  },
  'metric': {
    colorEncoding: 'Minimal color support (dark background with light text, green/red for delta indicators)',
    configOptions: {
      labelField: 'string (field name for metric labels)',
      valueField: 'string (field name for metric values)',
      previousValueField: 'string | null (field name for previous/comparison values — enables delta % indicators)',
      abbreviate: 'boolean (auto-abbreviate large numbers e.g. 1.2M, 450K — default: true)',
      format: '"currency" | "percent" | "integer" | "decimal" | "auto" (default: "auto")',
      prefix: 'string (prepended to value, e.g. "$" — default: "")',
      suffix: 'string (appended to value, e.g. " units" — default: "")',
      columns: 'number | "auto" (grid columns 1-4, or "auto" to choose based on count — default: "auto")',
    },
  },
  'line': {
    colorEncoding: 'Color mapped to series. Supports palette, highlight specific series',
  },
  'area': {
    colorEncoding: 'Color mapped to series. Supports palette, highlight specific series',
    configOptions: {
      stacked: 'boolean (stack series on top of each other, default: false)',
      normalized: 'boolean (100% stacked showing proportions, requires stacked, default: false)',
      curve: '"linear" | "monotone" | "step" | "curve" | "cardinal" | "catmullRom" (interpolation mode — step=staircase, curve=smooth rounded, default: "monotone")',
      opacity: 'number (fill opacity 0-1, default: 0.7)',
    },
  },
  'small-multiples': {
    colorEncoding: 'Color mapped to series within panels. Supports palette',
  },
  'sparkline-grid': {
    colorEncoding: 'Supports palette for line colors',
  },
  'calendar-heatmap': {
    colorEncoding: 'Sequential color scale for values. Supports palette (sequential palettes recommended: blue, green, purple, warm)',
  },
  'scatter': {
    colorEncoding: 'Supports palette, highlight, color.field for group coloring',
  },
  'connected-scatter': {
    colorEncoding: 'Color mapped to series. Supports palette, highlight',
  },
  'parallel-coordinates': {
    colorEncoding: 'Color mapped to a chosen dimension. Supports palette, highlight',
  },
  'radar': {
    colorEncoding: 'Color mapped to entity. Supports palette, highlight',
  },
  'heatmap': {
    colorEncoding: 'Sequential or diverging color scale for cell values. Supports palette (sequential: blue, green, purple, warm; diverging: blueRed, greenPurple, tealOrange)',
    configOptions: {
      showValues: 'boolean (show numeric values in cells, auto-enabled when cells are large enough)',
      sortRows: '"ascending" | "descending" (sort row categories alphabetically)',
      sortCols: '"ascending" | "descending" (sort column categories alphabetically)',
    },
  },
  'sankey': {
    colorEncoding: 'Color by source or target node. Supports palette',
    configOptions: { colorBy: '"source" | "target" (which node determines link color)' },
  },
  'alluvial': {
    colorEncoding: 'Color by source or target. Supports palette',
    configOptions: { colorBy: '"source" | "target" (which node determines flow color)' },
  },
  'chord': {
    colorEncoding: 'Color mapped to source group. Supports palette',
    configOptions: { colorBy: '"source" | "target"' },
  },
  'donut': {
    colorEncoding: 'Color mapped to category slices. Supports palette, highlight',
    configOptions: {
      innerRadius: 'number (0 = pie, 0.5-0.7 = donut, default: 0.55)',
      showLabels: 'boolean (show percentage labels on slices, default: true)',
      showPercentages: 'boolean (labels show % vs absolute values, default: true)',
      centerLabel: 'string (text displayed in the donut hole, default: empty — shows total)',
    },
  },
  'choropleth': {
    colorEncoding: 'Sequential or diverging color scale for map regions. Supports palette',
    configOptions: {
      topojsonUrl: 'string (URL to custom TopoJSON file)',
      objectName: 'string (TopoJSON object to extract features from)',
      nameProperty: 'string (feature property to match data, default: "name")',
    },
  },
  'proportional-symbol': {
    colorEncoding: 'Supports palette for symbol fill, color.field for grouping',
    configOptions: {
      topojsonUrl: 'string (URL to custom TopoJSON file)',
      objectName: 'string (TopoJSON object to extract features from)',
      nameProperty: 'string (feature property to match data, default: "name")',
    },
  },
  'lollipop': {
    colorEncoding: 'Color mapped to category. Supports palette, highlight',
    configOptions: {
      orientation: '"horizontal" | "vertical" (default: "horizontal")',
    },
  },
  'bullet': {
    colorEncoding: 'Color ranges for qualitative bands. Supports palette',
    configOptions: {
      targetField: 'string (field for target/goal marker)',
      rangeFields: 'string[] (fields for qualitative range bands)',
    },
  },
  'density-plot': {
    colorEncoding: 'Color mapped to group. Supports palette',
    configOptions: {
      bandwidth: 'number (kernel bandwidth, default: auto-calculated)',
      kernel: '"gaussian" | "epanechnikov" (kernel function, default: "gaussian")',
    },
  },
  'marimekko': {
    colorEncoding: 'Color mapped to sub-category. Supports palette, highlight',
    configOptions: {
      categoryField: 'string (field for column categories)',
      subCategoryField: 'string (field for row segments within columns)',
      valueField: 'string (field for segment values)',
    },
  },
  'icicle': {
    colorEncoding: 'Color mapped to top-level ancestor. Supports palette',
    configOptions: {
      orientation: '"horizontal" | "vertical" (default: "horizontal")',
      showValues: 'boolean (show values in cells, default: true)',
    },
  },
  'stream-graph': {
    colorEncoding: 'Color mapped to series/layer. Supports palette',
    configOptions: {
      offset: '"wiggle" | "silhouette" | "expand" | "none" (stacking offset, default: "wiggle")',
      curve: '"basis" | "cardinal" | "monotone" (interpolation, default: "basis")',
    },
  },
  'horizon-chart': {
    colorEncoding: 'Sequential color bands for value layers. Supports palette',
    configOptions: {
      bands: 'number (number of horizon bands, default: 4)',
      mode: '"mirror" | "offset" (negative value handling, default: "mirror")',
    },
  },
  'funnel': {
    colorEncoding: 'Color mapped to stage. Supports palette, highlight',
    configOptions: {
      showConversion: 'boolean (show conversion rates between stages, default: true)',
      orientation: '"vertical" | "horizontal" (default: "vertical")',
    },
  },
  'grouped-bar': {
    colorEncoding: 'Color mapped to series. Supports palette, highlight specific series',
    configOptions: {
      orientation: '"vertical" | "horizontal" (default: "vertical")',
      categoryField: 'string (field for group categories)',
      seriesField: 'string (field for series within groups)',
      valueField: 'string (field for bar values)',
    },
  },
  'waterfall': {
    colorEncoding: 'Automatic positive (green) / negative (red) / total (blue) coloring',
    configOptions: {
      totalColumns: 'string[] | "first" | "last" (which bars are totals anchored to zero, default: ["first", "last"])',
      showConnectors: 'boolean (show dashed connector lines between bars, default: true)',
      positiveColor: 'string (CSS color for increases, default: "#3dd9a0")',
      negativeColor: 'string (CSS color for decreases, default: "#ff6b5e")',
      totalColor: 'string (CSS color for total bars, default: theme blue)',
    },
  },
};

// ─── COLOR SYSTEM DOCUMENTATION ─────────────────────────────────────────────

const COLOR_SYSTEM_DOCS = {
  palettes: {
    categorical: ['categorical — 10 distinct colors for nominal categories'],
    sequential: [
      'blue — light-to-dark blue ramp',
      'green — light-to-dark green ramp',
      'purple — light-to-dark purple ramp',
      'warm — light-to-dark warm (orange/red) ramp',
    ],
    diverging: [
      'blueRed — blue↔red for +/- values',
      'greenPurple — green↔purple diverging',
      'tealOrange — teal↔orange diverging',
      'redGreen — red↔green diverging',
    ],
    semantic: [
      'traffic-light — red/yellow/green for status',
      'profit-loss — green (profit) / red (loss)',
      'temperature — cold-blue to hot-red',
    ],
  },
  highlightMode: {
    description: 'Emphasize specific data values while muting all others to gray. Works with any pattern that has categorical color mapping.',
    usage: 'Set encoding.color.highlight.values to an array of values to emphasize. Optionally set color (CSS color or array), mutedColor (default: #6b7280), mutedOpacity (default: 1.0).',
    examples: [
      'highlight: { values: ["Offer"] } — highlight one value, others gray',
      'highlight: { values: ["North", "South"], color: "#ff6b6b" } — highlight with custom color',
      'highlight: { values: ["Q1"], mutedOpacity: 0.3 } — stronger de-emphasis',
    ],
  },
  howToApply: {
    visualize: 'Pass palette, highlight, colorField as top-level params in the visualize tool input',
    refine: 'Pass structured params: palette, highlight: { values: [...] }, colorField, etc.',
  },
};

// ─── HANDLER ────────────────────────────────────────────────────────────────

export function handleListPatterns(getPatterns: () => VisualizationPattern[]) {
  return async () => {
    const patterns = getPatterns();

    const listing = patterns.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      bestFor: p.bestFor,
      notFor: p.notFor,
      dataRequirements: p.dataRequirements,
      capabilities: PATTERN_CAPABILITIES[p.id] || {
        colorEncoding: 'Supports palette',
      },
    }));

    return jsonResponse({ patterns: listing, colorSystem: COLOR_SYSTEM_DOCS });
  };
}
