/**
 * Self-contained HTML template builder for Dolex visualization specs.
 *
 * Produces a complete HTML document string that can be rendered inside
 * a sandboxed iframe in MCP Apps (Claude Desktop, ChatGPT, VS Code).
 *
 * Each document embeds:
 *   - D3 v7 via CDN
 *   - All shared rendering utilities (scales, axes, tooltips, colors)
 *   - The visualization spec as inline JSON
 *   - Pattern-specific rendering code
 */

import type { VisualizationSpec } from '../../types.js';

/**
 * Shared rendering utilities as standalone JavaScript.
 *
 * This is a self-contained copy of the logic from `src/renderers/d3/shared.ts`,
 * rewritten as plain JS (no imports, no TypeScript) so it can be embedded
 * directly in a `<script>` block. All functions and constants that the
 * pattern-specific render functions depend on are included here.
 */
const SHARED_UTILITIES_JS = `
// ─── CONSTANTS ──────────────────────────────────────────────────────────────

var DEFAULT_MARGINS = { top: 40, right: 30, bottom: 50, left: 60 };

var DEFAULT_PALETTE = [
  '#6280c1', '#c99a3e', '#48a882', '#c46258', '#5ea4c8',
  '#9e74bf', '#c88450', '#3ea898', '#b85e78', '#85a63e',
  '#807cba', '#b09838'
];

// Theme palettes
var CATEGORICAL_PALETTE = DEFAULT_PALETTE;

var SEQUENTIAL_PALETTES = {
  blue: ['#e8f0fe','#c5d9fc','#9cbcf8','#6e9cf4','#4a7eec','#2f63d9','#1d4cb8','#143893','#0d2668'],
  green: ['#e2f5ec','#b6e6d0','#7ed4ae','#4cc08c','#2ba86f','#1e8d58','#157244','#0d5833','#084024'],
  purple: ['#f0e8ff','#d8c6fd','#bd9efa','#a278f3','#8755e8','#6d3dd1','#5630ab','#402485','#2d1961'],
  warm: ['#fef0e2','#fdd9b4','#fbbd7e','#f79e4d','#ef7e25','#d4620f','#ac4a0a','#843608','#5e2506']
};

var DIVERGING_PALETTES = {
  blueRed: ['#2166ac','#4393c3','#6db4d5','#a6d1e8','#e0e0e0','#f1b0a0','#e07060','#ca3832','#b2182b'],
  greenPurple: ['#1b7837','#41a055','#73c378','#a8dda0','#e0e0e0','#c4a5d9','#9970be','#7640a0','#5e2d84'],
  tealOrange: ['#0d6b6e','#2a9191','#54b4b0','#92d4cc','#e0e0e0','#f5c28a','#e69b44','#c87422','#a35212']
};

var COLOR_SCHEMES = {
  'traffic-light': ['#ef4444', '#f59e0b', '#10b981'],
  'profit-loss': ['#ef4444', '#6b7280', '#10b981'],
  'temperature': ['#3b82f6', '#9ca3af', '#f59e0b']
};

var DARK_BG    = '#0f1117';
var AXIS_COLOR = '#4b5563';
var GRID_COLOR = '#1f2937';
var TEXT_COLOR  = '#d1d5db';
var TEXT_MUTED  = '#9ca3af';

// ─── SVG SETUP ──────────────────────────────────────────────────────────────

function createSvg(container, spec, marginOverrides) {
  var margin = Object.assign({}, DEFAULT_MARGINS, marginOverrides || {});
  var width  = container.clientWidth  || 800;
  var height = container.clientHeight || 500;
  var innerWidth  = width - margin.left - margin.right;
  var innerHeight = height - margin.top  - margin.bottom;

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', DARK_BG)
    .style('border-radius', '8px');

  if (spec.title) {
    var titleEl = svg.append('text')
      .attr('x', width / 2)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(spec.title);
    truncateTitle(titleEl, spec.title, width - 20);
  }

  var g = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  return {
    svg: svg,
    g: g,
    dims: {
      width: width,
      height: height,
      innerWidth: innerWidth,
      innerHeight: innerHeight,
      margin: margin
    }
  };
}

// ─── SCALES ─────────────────────────────────────────────────────────────────

function resolvePalette(name) {
  switch (name) {
    case 'categorical': return CATEGORICAL_PALETTE;
    case 'blue': return SEQUENTIAL_PALETTES.blue;
    case 'green': return SEQUENTIAL_PALETTES.green;
    case 'purple': return SEQUENTIAL_PALETTES.purple;
    case 'warm': return SEQUENTIAL_PALETTES.warm;
    case 'blueRed': return DIVERGING_PALETTES.blueRed;
    case 'greenPurple': return DIVERGING_PALETTES.greenPurple;
    case 'tealOrange': return DIVERGING_PALETTES.tealOrange;
    case 'traffic-light': return COLOR_SCHEMES['traffic-light'];
    case 'profit-loss': return COLOR_SCHEMES['profit-loss'];
    case 'temperature': return COLOR_SCHEMES.temperature;
    default: return null;
  }
}

function isSequentialPalette(name) {
  return name && ['blue', 'green', 'purple', 'warm'].indexOf(name) !== -1;
}

function isDivergingPalette(name) {
  return name && ['blueRed', 'greenPurple', 'tealOrange'].indexOf(name) !== -1;
}

function buildXScale(encoding, data, innerWidth) {
  if (!encoding) return null;
  var field = encoding.field;
  switch (encoding.type) {
    case 'nominal':
    case 'ordinal': {
      var domain = Array.from(new Set(data.map(function(d) { return d[field]; })));
      return d3.scaleBand().domain(domain).range([0, innerWidth]).padding(0.2);
    }
    case 'quantitative': {
      var values = data.map(function(d) { return Number(d[field]); });
      var extent = d3.extent(values);
      var padding = (extent[1] - extent[0]) * 0.05 || 1;
      return d3.scaleLinear()
        .domain([extent[0] - padding, extent[1] + padding])
        .range([0, innerWidth])
        .nice();
    }
    case 'temporal': {
      var dates = data.map(function(d) { return new Date(d[field]); });
      return d3.scaleTime()
        .domain(d3.extent(dates))
        .range([0, innerWidth])
        .nice();
    }
    default:
      return d3.scaleLinear().range([0, innerWidth]);
  }
}

function buildYScale(encoding, data, innerHeight) {
  if (!encoding) return null;
  var field = encoding.field;
  switch (encoding.type) {
    case 'nominal':
    case 'ordinal': {
      var domain = Array.from(new Set(data.map(function(d) { return d[field]; })));
      return d3.scaleBand().domain(domain).range([0, innerHeight]).padding(0.2);
    }
    case 'quantitative': {
      var values = data.map(function(d) { return Number(d[field]); });
      var max = d3.max(values);
      var min = Math.min(0, d3.min(values));
      return d3.scaleLinear().domain([min, max]).range([innerHeight, 0]).nice();
    }
    case 'temporal': {
      var dates = data.map(function(d) { return new Date(d[field]); });
      return d3.scaleTime()
        .domain(d3.extent(dates))
        .range([innerHeight, 0])
        .nice();
    }
    default:
      return d3.scaleLinear().range([innerHeight, 0]);
  }
}

function buildColorScale(encoding, data, valueField) {
  if (!encoding || !encoding.field) {
    return function() { return CATEGORICAL_PALETTE[0]; };
  }
  var field = encoding.field;

  // ── HIGHLIGHT MODE ──
  // Only activate if at least one highlight value matches actual data
  if (encoding.highlight && encoding.highlight.values && encoding.highlight.values.length > 0) {
    var dataValues = new Set(data.map(function(d) { return d[field]; }));
    var hasMatchingValues = encoding.highlight.values.some(function(v) { return dataValues.has(v); });

    if (hasMatchingValues) {
      var highlightSet = new Set(encoding.highlight.values);
      var highlightColors = Array.isArray(encoding.highlight.color)
        ? encoding.highlight.color
        : encoding.highlight.color
        ? [encoding.highlight.color]
        : [CATEGORICAL_PALETTE[0]];
      var mutedColor = encoding.highlight.mutedColor || '#6b7280';
      var mutedOpacity = encoding.highlight.mutedOpacity !== undefined
        ? encoding.highlight.mutedOpacity
        : 1.0;

      return function(value) {
        if (highlightSet.has(value)) {
          var highlightArray = Array.from(highlightSet);
          var idx = highlightArray.indexOf(value);
          return highlightColors[idx % highlightColors.length];
        }
        if (mutedOpacity < 1.0) {
          var hex = mutedColor.replace('#', '');
          var r = parseInt(hex.substring(0, 2), 16);
          var g = parseInt(hex.substring(2, 4), 16);
          var b = parseInt(hex.substring(4, 6), 16);
          return 'rgba(' + r + ',' + g + ',' + b + ',' + mutedOpacity + ')';
        }
        return mutedColor;
      };
    }
    // No matching values — fall through to palette/default logic
  }

  // ── PALETTE SELECTION ──
  if (encoding.palette) {
    var palette = resolvePalette(encoding.palette);
    if (palette) {
      // Sequential/diverging palettes should be value-based
      if ((isSequentialPalette(encoding.palette) || isDivergingPalette(encoding.palette)) && valueField) {
        var valueExtent = d3.extent(data, function(d) { return Number(d[valueField]); });
        var colorScale = d3.scaleLinear()
          .domain([valueExtent[0], valueExtent[1]])
          .range([palette[0], palette[palette.length - 1]])
          .interpolate(d3.interpolateRgb);

        var categoryToValue = new Map();
        data.forEach(function(d) { categoryToValue.set(d[field], Number(d[valueField])); });

        return function(category) {
          var value = categoryToValue.get(category);
          return value !== undefined ? colorScale(value) : palette[0];
        };
      }

      // Quantitative color encoding
      if (encoding.type === 'quantitative') {
        var extent = d3.extent(data, function(d) { return Number(d[field]); });
        return d3.scaleLinear()
          .domain([extent[0], extent[1]])
          .range([palette[0], palette[palette.length - 1]])
          .interpolate(d3.interpolateRgb);
      }

      // Categorical/ordinal
      var domain = Array.from(new Set(data.map(function(d) { return d[field]; })));
      return d3.scaleOrdinal().domain(domain).range(palette);
    }
  }

  // ── CUSTOM SCALE ──
  if (encoding.scale && encoding.scale.domain && encoding.scale.range) {
    if (encoding.type === 'quantitative') {
      return d3.scaleLinear()
        .domain(encoding.scale.domain)
        .range(encoding.scale.range)
        .interpolate(d3.interpolateRgb);
    }
    return d3.scaleOrdinal().domain(encoding.scale.domain).range(encoding.scale.range);
  }

  // ── DEFAULT ──
  if (encoding.type === 'quantitative') {
    var extent = d3.extent(data, function(d) { return Number(d[field]); });
    return d3.scaleSequential(d3.interpolateViridis).domain(extent);
  }

  var domain = Array.from(new Set(data.map(function(d) { return d[field]; })));
  return d3.scaleOrdinal().domain(domain).range(CATEGORICAL_PALETTE);
}

// ─── AXES ───────────────────────────────────────────────────────────────────

function styleAxis(axis) {
  axis.selectAll('.domain')
    .attr('stroke', AXIS_COLOR)
    .attr('stroke-width', 0.5);
  axis.selectAll('.tick line')
    .attr('stroke', GRID_COLOR)
    .attr('stroke-width', 0.5)
    .attr('stroke-dasharray', '2,2');
  axis.selectAll('.tick text')
    .attr('fill', TEXT_MUTED)
    .attr('font-size', '11px')
    .attr('font-family', 'Inter, system-ui, sans-serif');
  fixTickLabels(axis);
}

function fixTickLabels(axis) {
  var ticks = axis.selectAll('.tick text');
  var nodes = [];
  ticks.each(function() { nodes.push(this); });
  if (nodes.length < 2) return;
  var texts = nodes.map(function(n) { return n.textContent || ''; });
  var uniqueTexts = new Set(texts);
  if (uniqueTexts.size < Math.min(nodes.length, 3)) {
    var values = [];
    ticks.each(function(d) { values.push(Number(d)); });
    var validValues = values.filter(function(v) { return !isNaN(v); });
    if (validValues.length < 2) return;
    var mn = Math.min.apply(null, validValues);
    var mx = Math.max.apply(null, validValues);
    var span = mx - mn;
    if (span > 0) {
      var precision = span >= 1 ? 1 : Math.max(2, Math.ceil(-Math.log10(span)) + 2);
      ticks.each(function(d) {
        var v = Number(d);
        if (!isNaN(v)) {
          if (Math.abs(v) >= 1e6) this.textContent = (v / 1e6).toFixed(1) + 'M';
          else if (Math.abs(v) >= 1e3) this.textContent = (v / 1e3).toFixed(1) + 'K';
          else if (v === Math.floor(v) && Math.abs(v) < 1e3) this.textContent = v.toFixed(0);
          else this.textContent = v.toFixed(precision);
        }
      });
    }
    var seen = {};
    nodes.forEach(function(n) {
      var t = n.textContent || '';
      if (seen[t]) {
        n.style.display = 'none';
        var line = n.parentNode ? n.parentNode.querySelector('line') : null;
        if (line) line.style.display = 'none';
      } else {
        seen[t] = true;
      }
    });
  }
}

function drawXAxis(g, xScale, innerHeight, label, isOrdinal) {
  var axis = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', 'translate(0,' + innerHeight + ')')
    .call(
      d3.axisBottom(xScale)
        .ticks(isOrdinal ? null : 6)
        .tickSize(-innerHeight)
        .tickPadding(8)
    );
  styleAxis(axis);

  if (label) {
    var gNode = g.node();
    var bboxWidth = gNode && gNode.getBBox ? gNode.getBBox().width : 700;
    g.append('text')
      .attr('class', 'x-label')
      .attr('x', bboxWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '12px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(label);
  }
}

function drawYAxis(g, yScale, innerWidth, label) {
  var axis = g.append('g')
    .attr('class', 'y-axis')
    .call(
      d3.axisLeft(yScale)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickPadding(8)
    );
  styleAxis(axis);

  if (label) {
    var gNode = g.node();
    var bboxHeight = gNode && gNode.getBBox ? gNode.getBBox().height : 400;
    g.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(bboxHeight / 2))
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '12px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(label);
  }
}

// ─── TOOLTIP ────────────────────────────────────────────────────────────────

var _tooltipEl = null;

function getTooltip() {
  if (_tooltipEl && document.body.contains(_tooltipEl)) return _tooltipEl;
  _tooltipEl = document.createElement('div');
  _tooltipEl.style.cssText =
    'position:fixed;pointer-events:none;background:#1e2028;' +
    'color:' + TEXT_COLOR + ';padding:8px 12px;border-radius:6px;' +
    'font-size:12px;font-family:Inter,system-ui,sans-serif;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.5);border:1px solid #2d3041;' +
    'z-index:10000;opacity:0;transition:opacity 0.15s;' +
    'max-width:300px;line-height:1.5;';
  document.body.appendChild(_tooltipEl);
  return _tooltipEl;
}

function showTip(html, event) {
  var t = getTooltip();
  t.innerHTML = html;
  t.style.opacity = '1';
  t.style.left = (event.clientX + 12) + 'px';
  t.style.top = (event.clientY - 12) + 'px';
}

function moveTip(event) {
  var t = getTooltip();
  t.style.left = (event.clientX + 12) + 'px';
  t.style.top = (event.clientY - 12) + 'px';
}

function hideTip() {
  var t = getTooltip();
  t.style.opacity = '0';
}

// Legacy aliases for backwards compatibility
function createTooltip(container) { return getTooltip(); }
function showTooltip(tooltip, html, event) { showTip(html, event); }
function hideTooltip(tooltip) { hideTip(); }

// ─── LEGEND ─────────────────────────────────────────────────────────────────

function drawLegend(svg, colorScale, dims, position) {
  position = position || 'top-right';
  var domain = colorScale.domain ? colorScale.domain() : [];
  if (!domain.length || domain.length > 12) return;

  var legend = svg.append('g').attr('class', 'legend');

  if (position === 'top-right') {
    legend.attr('transform',
      'translate(' + (dims.width - dims.margin.right - 120) + ',' + (dims.margin.top + 10) + ')');

    domain.forEach(function(label, i) {
      var row = legend.append('g').attr('transform', 'translate(0,' + (i * 20) + ')');
      row.append('rect')
        .attr('width', 12).attr('height', 12).attr('rx', 2)
        .attr('fill', colorScale(label));
      row.append('text')
        .attr('x', 18).attr('y', 10)
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(String(label).length > 16 ? String(label).slice(0, 15) + '...' : String(label));
    });
  }
}

// ─── ADAPTIVE LAYOUT HELPERS ────────────────────────────────────────────────
// Shared across all chart renderers. Do NOT redefine these in individual
// builder render code — they are available automatically.

function getAdaptiveTickCount(space, minSpacing) {
  minSpacing = minSpacing || 60;
  return Math.max(3, Math.floor(space / minSpacing));
}

function calculateLeftMargin(labels) {
  var maxLen = 0;
  for (var i = 0; i < labels.length; i++) {
    var len = String(labels[i]).length;
    if (len > maxLen) maxLen = len;
  }
  return Math.max(80, Math.min(200, maxLen * 6 + 20));
}

function shouldRotateLabels(labels, barW, fontSize) {
  fontSize = fontSize || 11;
  var totalLen = 0;
  for (var i = 0; i < labels.length; i++) totalLen += String(labels[i]).length;
  var avgLen = totalLen / labels.length;
  return avgLen * (fontSize * 0.6) > barW * 0.8;
}

function calculateBottomMargin(labels, willRotate, fontSize) {
  fontSize = fontSize || 11;
  if (!willRotate) return 60;
  var maxLen = 0;
  for (var i = 0; i < labels.length; i++) {
    var len = String(labels[i]).length;
    if (len > maxLen) maxLen = len;
  }
  var charWidth = fontSize * 0.6;
  return Math.max(70, Math.min(150, maxLen * charWidth * 0.7 + 35));
}

function truncateLabel(label, maxLen) {
  maxLen = maxLen || 25;
  var s = String(label);
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + '\\u2026';
}

function truncateTitle(textEl, fullText, maxWidth) {
  var node = textEl.node();
  if (!node || !node.getComputedTextLength) return;
  if (node.getComputedTextLength() <= maxWidth) return;
  var lo = 0, hi = fullText.length;
  while (lo < hi) {
    var mid = (lo + hi + 1) >> 1;
    node.textContent = fullText.slice(0, mid) + '\\u2026';
    if (node.getComputedTextLength() <= maxWidth) { lo = mid; }
    else { hi = mid - 1; }
  }
  node.textContent = lo > 0 ? fullText.slice(0, lo) + '\\u2026' : '\\u2026';
  textEl.append('title').text(fullText);
}

function shouldShowValueLabels(cfg, dim, isHoriz) {
  if (cfg && cfg.showLabels !== undefined) return cfg.showLabels;
  return isHoriz ? dim >= 20 : dim >= 35;
}

// ─── UTILITIES ──────────────────────────────────────────────────────────────

function formatValue(v) {
  if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(1) + 'T';
  if (Math.abs(v) >= 1e9)  return (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6)  return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3)  return (v / 1e3).toFixed(1) + 'K';
  if (Math.abs(v) < 1 && v !== 0) {
    var p = Math.max(2, Math.ceil(-Math.log10(Math.abs(v))) + 1);
    return v.toFixed(Math.min(p, 6));
  }
  return v === Math.floor(v) ? v.toFixed(0) : v.toFixed(1);
}
`;

/**
 * Build a complete, self-contained HTML document that renders a chart.
 *
 * The returned string is a full `<!DOCTYPE html>` document that can be
 * loaded into an iframe or written to a file. It includes:
 *   - Dark-theme CSS reset and responsive sizing
 *   - D3 v7 loaded from CDN
 *   - All shared rendering utilities inlined as JS
 *   - The VisualizationSpec embedded as `window.__SPEC__`
 *   - The pattern-specific render function body
 *   - Auto-invocation on DOMContentLoaded
 *
 * @param spec - The VisualizationSpec describing the chart
 * @param renderFunctionBody - JavaScript code string that renders the chart.
 *   It receives the variables `container` (HTMLElement), `spec` (the spec object),
 *   and has access to all shared utility functions (createSvg, buildXScale, etc.).
 * @returns A complete HTML document string
 */
const MAX_EMBED_ROWS = 10_000;

export function buildHtml(spec: VisualizationSpec, renderFunctionBody: string): string {
  const cappedSpec = capDataRows(spec);
  const specJson = JSON.stringify(cappedSpec);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(spec.title || 'Chart')}</title>
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f1117;
  color: #d1d5db;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
#chart {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
</head>
<body>
<div id="chart"></div>

<script src="https://d3js.org/d3.v7.min.js"><\/script>

<script>
window.__SPEC__ = ${specJson};
<\/script>

<script>
${SHARED_UTILITIES_JS}
<\/script>

<script>
function renderChart(container, spec) {
${renderFunctionBody}
}

document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('chart');
  var spec = window.__SPEC__;

  if (!spec || !spec.data || !spec.data.length) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">No data provided</p>';
    return;
  }

  var lastWidth = 0;

  function doRender() {
    try {
      container.innerHTML = '';
      renderChart(container, spec);
      lastWidth = container.clientWidth;
      try {
        var h = document.documentElement.scrollHeight || document.body.scrollHeight;
        if (h > 0 && window.parent !== window) {
          window.parent.postMessage({ type: 'dolex-resize', height: h }, '*');
        }
      } catch(e) {}
    } catch (err) {
      console.error('Render error:', err);
      container.innerHTML =
        '<div style="color:#ef4444;padding:20px;font-family:monospace;">' +
        '<p><strong>Render error:</strong> ' + spec.pattern + '</p>' +
        '<pre style="font-size:11px;opacity:0.8;white-space:pre-wrap;">' +
        err.message + '\\n' + err.stack + '</pre></div>';
    }
  }

  requestAnimationFrame(doRender);

  var resizeTimer;
  var ro = new ResizeObserver(function(entries) {
    var w = entries[0].contentRect.width;
    if (w > 0 && Math.abs(w - lastWidth) > 20) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doRender, 150);
    }
  });
  ro.observe(container);
});
<\/script>
</body>
</html>`;
}

/**
 * Build a complete, self-contained HTML document from a pre-bundled renderer.
 *
 * Unlike `buildHtml()`, this does NOT inject `SHARED_UTILITIES_JS` because the
 * bundled code already contains all shared utilities (inlined by esbuild).
 * The bundle exposes `renderChart` as a global function.
 *
 * @param spec - The VisualizationSpec describing the chart
 * @param bundleCode - Self-contained IIFE string from _generated/bundles.ts
 * @param options - Extra scripts (e.g. topojson CDN for geo patterns)
 * @returns A complete HTML document string
 */
export function buildHtmlFromBundle(
  spec: VisualizationSpec,
  bundleCode: string,
  options?: { extraScripts?: string[] }
): string {
  const cappedSpec = capDataRows(spec);
  const specJson = JSON.stringify(cappedSpec);
  const extraScriptTags = (options?.extraScripts || [])
    .map(src => `<script src="${src}"><\/script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(spec.title || 'Chart')}</title>
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f1117;
  color: #d1d5db;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
#chart {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
</head>
<body>
<div id="chart"></div>

<script src="https://d3js.org/d3.v7.min.js"><\/script>
${extraScriptTags}
<script>
window.__SPEC__ = ${specJson};
<\/script>

<script>
${bundleCode}
<\/script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('chart');
  var spec = window.__SPEC__;

  if (!spec || !spec.data || !spec.data.length) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">No data provided</p>';
    return;
  }

  var lastWidth = 0;

  function doRender() {
    try {
      container.innerHTML = '';
      renderChart(container, spec);
      lastWidth = container.clientWidth;
      try {
        var h = document.documentElement.scrollHeight || document.body.scrollHeight;
        if (h > 0 && window.parent !== window) {
          window.parent.postMessage({ type: 'dolex-resize', height: h }, '*');
        }
      } catch(e) {}
    } catch (err) {
      console.error('Render error:', err);
      container.innerHTML =
        '<div style="color:#ef4444;padding:20px;font-family:monospace;">' +
        '<p><strong>Render error:</strong> ' + spec.pattern + '</p>' +
        '<pre style="font-size:11px;opacity:0.8;white-space:pre-wrap;">' +
        err.message + '\\n' + err.stack + '</pre></div>';
    }
  }

  requestAnimationFrame(doRender);

  var resizeTimer;
  var ro = new ResizeObserver(function(entries) {
    var w = entries[0].contentRect.width;
    if (w > 0 && Math.abs(w - lastWidth) > 20) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doRender, 150);
    }
  });
  ro.observe(container);
});
<\/script>
</body>
</html>`;
}

function capDataRows(spec: VisualizationSpec): VisualizationSpec {
  if (!spec.data || spec.data.length <= MAX_EMBED_ROWS) return spec;
  return { ...spec, data: spec.data.slice(0, MAX_EMBED_ROWS) };
}

/** Escape HTML special characters for safe embedding in attributes/text. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
