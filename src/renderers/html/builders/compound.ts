/**
 * Self-contained HTML builder for compound visualizations.
 *
 * Produces a single HTML document with:
 * - CSS grid layout for multiple views
 * - Chart view delegating to existing pattern renderers
 * - Data table view with sort, hover, and formatting
 * - Interaction bus wiring linked highlights between views
 */

import type { CompoundVisualizationSpec, VisualizationSpec } from '../../../types.js';
import { buildChartHtml } from '../index.js';

/**
 * JavaScript code for the data table renderer.
 * Renders a sortable, hoverable table matching the dark design system.
 */
const TABLE_RENDER_JS = `
function renderTable(container, data, tableSpec, interactionBus) {
  tableSpec = tableSpec || {};
  var columns = tableSpec.columns;
  var sortState = tableSpec.sort || null;
  var pageSize = tableSpec.pageSize || 200;

  // Auto-detect columns from data if not specified
  if (!columns || columns.length === 0) {
    var keys = data.length > 0 ? Object.keys(data[0]) : [];
    columns = keys.map(function(k) {
      return { field: k, title: k };
    });
  }

  // Detect numeric columns for right-alignment
  var numericFields = new Set();
  if (data.length > 0) {
    columns.forEach(function(col) {
      var sample = data.slice(0, 10).map(function(d) { return d[col.field]; });
      var numCount = sample.filter(function(v) {
        return v != null && typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));
      }).length;
      if (numCount > sample.length * 0.7) numericFields.add(col.field);
    });
  }

  function formatCell(value, col) {
    if (value == null) return '';
    if (col.format && typeof d3 !== 'undefined' && d3.format) {
      try { return d3.format(col.format)(Number(value)); } catch(e) {}
    }
    if (numericFields.has(col.field) && typeof value === 'number') {
      if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
      if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
      if (Math.abs(value) < 1 && value !== 0) return value.toFixed(2);
      return value.toLocaleString();
    }
    return String(value);
  }

  function getAlign(col) {
    if (col.align) return col.align;
    return numericFields.has(col.field) ? 'right' : 'left';
  }

  function getWidth(col) {
    if (typeof col.width === 'number') return col.width + 'px';
    switch (col.width) {
      case 'narrow': return '80px';
      case 'wide': return '200px';
      case 'medium': default: return 'auto';
    }
  }

  var sortedData = data.slice();
  function applySort() {
    if (!sortState) return;
    var field = sortState.field;
    var dir = sortState.direction === 'asc' ? 1 : -1;
    sortedData.sort(function(a, b) {
      var va = a[field], vb = b[field];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
      return dir * String(va).localeCompare(String(vb));
    });
  }
  applySort();

  // Limit rows
  var displayData = sortedData.slice(0, pageSize);

  function render() {
    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;overflow:auto;';

    var table = document.createElement('table');
    table.style.cssText =
      'width:100%;border-collapse:collapse;font-family:Inter,system-ui,sans-serif;' +
      'font-size:12px;color:#d1d5db;';

    // Header
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    columns.forEach(function(col) {
      var th = document.createElement('th');
      th.textContent = col.title || col.field;
      var isSorted = sortState && sortState.field === col.field;
      var arrow = isSorted ? (sortState.direction === 'asc' ? ' \\u25B2' : ' \\u25BC') : '';
      th.textContent = (col.title || col.field) + arrow;
      th.style.cssText =
        'padding:8px 12px;text-align:' + getAlign(col) + ';border-bottom:2px solid #2d3041;' +
        'color:#9ca3af;font-weight:600;cursor:pointer;user-select:none;' +
        'position:sticky;top:0;background:#0f1117;white-space:nowrap;' +
        'width:' + getWidth(col) + ';';
      th.addEventListener('click', function() {
        if (sortState && sortState.field === col.field) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState = { field: col.field, direction: numericFields.has(col.field) ? 'desc' : 'asc' };
        }
        applySort();
        displayData = sortedData.slice(0, pageSize);
        render();
      });
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement('tbody');
    displayData.forEach(function(row, rowIdx) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-row-index', rowIdx);
      tr.style.cssText = 'transition:background 0.1s;';

      // Interaction hover
      tr.addEventListener('mouseenter', function() {
        tr.style.background = '#1a1d2e';
        if (interactionBus) interactionBus.highlight(row);
      });
      tr.addEventListener('mouseleave', function() {
        tr.style.background = '';
        if (interactionBus) interactionBus.clearHighlight();
      });

      columns.forEach(function(col) {
        var td = document.createElement('td');
        td.textContent = formatCell(row[col.field], col);
        td.style.cssText =
          'padding:6px 12px;text-align:' + getAlign(col) + ';' +
          'border-bottom:1px solid #1f2937;white-space:nowrap;';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Row count footer
    if (data.length > pageSize) {
      var tfoot = document.createElement('tfoot');
      var footRow = document.createElement('tr');
      var footCell = document.createElement('td');
      footCell.colSpan = columns.length;
      footCell.style.cssText =
        'padding:8px 12px;color:#6b7280;font-size:11px;border-top:1px solid #2d3041;';
      footCell.textContent = 'Showing ' + displayData.length + ' of ' + data.length + ' rows';
      footRow.appendChild(footCell);
      tfoot.appendChild(footRow);
      table.appendChild(tfoot);
    }

    wrapper.appendChild(table);
    container.appendChild(wrapper);

    // Store reference for interaction highlighting
    container._tableBody = tbody;
    container._tableColumns = columns;
  }

  render();

  // Interaction bus subscriber: highlight matching rows
  if (interactionBus) {
    interactionBus.onHighlight(function(highlightRow) {
      var tbody = container._tableBody;
      if (!tbody) return;
      var rows = tbody.querySelectorAll('tr');
      rows.forEach(function(tr, i) {
        var dataRow = displayData[i];
        if (!dataRow) return;
        var match = interactionBus.matchRow(dataRow, highlightRow);
        tr.style.background = match ? '#1a1d2e' : '';
      });
    });

    interactionBus.onClearHighlight(function() {
      var tbody = container._tableBody;
      if (!tbody) return;
      var rows = tbody.querySelectorAll('tr');
      rows.forEach(function(tr) { tr.style.background = ''; });
    });
  }
}
`;

/**
 * JavaScript code for the interaction bus.
 * Lightweight pub/sub for linked highlighting between views.
 */
const INTERACTION_BUS_JS = `
function createInteractionBus(interactions) {
  var highlightCallbacks = [];
  var clearCallbacks = [];
  var fields = [];

  // Collect all highlight interaction fields
  (interactions || []).forEach(function(interaction) {
    if (interaction.type === 'highlight' && interaction.field) {
      fields.push(interaction.field);
    }
  });

  return {
    fields: fields,

    highlight: function(row) {
      highlightCallbacks.forEach(function(cb) { cb(row); });
    },

    clearHighlight: function() {
      clearCallbacks.forEach(function(cb) { cb(); });
    },

    onHighlight: function(cb) {
      highlightCallbacks.push(cb);
    },

    onClearHighlight: function(cb) {
      clearCallbacks.push(cb);
    },

    matchRow: function(candidateRow, highlightRow) {
      if (!highlightRow) return false;
      return fields.some(function(field) {
        return candidateRow[field] != null &&
               highlightRow[field] != null &&
               String(candidateRow[field]) === String(highlightRow[field]);
      });
    }
  };
}
`;

/**
 * Build a self-contained HTML document for a compound visualization.
 *
 * Embeds the chart view (via iframe srcdoc from the existing builder) and
 * the table view in a CSS grid layout with interaction wiring.
 */
export function buildCompoundHtml(spec: CompoundVisualizationSpec): string {
  const layout = spec.layout || { type: 'rows' };
  const sizes = layout.sizes || getDefaultSizes(spec.views);
  const gap = layout.gap || 12;

  // Find chart and table views
  const chartView = spec.views.find(v => v.type === 'chart');
  const tableView = spec.views.find(v => v.type === 'table');

  // Build chart HTML from the chart view's spec
  let chartHtml = '';
  if (chartView?.chart) {
    const fullChartSpec: VisualizationSpec = {
      ...chartView.chart,
      data: spec.data,
    } as VisualizationSpec;
    chartHtml = buildChartHtml(fullChartSpec);
    // Strip min-height so the chart fills its compound grid cell instead of
    // forcing 500px (which overflows and clips legends/axes).
    chartHtml = chartHtml
      .replace(/min-height:\s*500px/g, 'height: 100%');
  }

  // Escape the chart HTML for embedding as srcdoc.
  // CRITICAL: Replace </  with <\/ so the HTML parser doesn't find </script>
  // inside the JS string literal and prematurely close the <script> block.
  // In JS strings, \/ is equivalent to / (no-op escape), so values are preserved.
  const safeJson = (v: unknown) => JSON.stringify(v).replace(/<\//g, '<\\/');

  const chartHtmlEscaped = safeJson(chartHtml);

  const gridTemplate = layout.type === 'columns'
    ? `grid-template-columns: ${sizes.map(s => s + 'fr').join(' ')};grid-template-rows:1fr;`
    : `grid-template-rows: ${sizes.map(s => s + 'fr').join(' ')};grid-template-columns:1fr;`;

  const MAX_EMBED_ROWS = 10_000;
  const tableSpecJson = safeJson(tableView?.table || {});
  const cappedData = spec.data && spec.data.length > MAX_EMBED_ROWS ? spec.data.slice(0, MAX_EMBED_ROWS) : spec.data;
  const dataJson = safeJson(cappedData);
  const interactionsJson = safeJson(spec.interactions || []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(spec.title || 'Compound Visualization')}</title>
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: #0f1117; color: #d1d5db;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
#compound-root {
  width: 100%; height: 100%;
  display: grid;
  ${gridTemplate}
  gap: ${gap}px;
  padding: ${gap}px;
}
#chart-view {
  min-height: 0; min-width: 0; overflow: hidden;
  border-radius: 8px;
}
#chart-view iframe {
  width: 100%; height: 100%; border: none;
  border-radius: 8px;
}
#table-view {
  min-height: 0; min-width: 0; overflow: hidden;
  border-radius: 8px;
  background: #0f1117;
}
</style>
</head>
<body>
<div id="compound-root">
  <div id="chart-view"></div>
  <div id="table-view"></div>
</div>

<script src="https://d3js.org/d3.v7.min.js"><\/script>

<script>
${INTERACTION_BUS_JS}
${TABLE_RENDER_JS}
</script>

<script>
(function() {
  var data = ${dataJson};
  var tableSpec = ${tableSpecJson};
  var interactions = ${interactionsJson};
  var chartHtml = ${chartHtmlEscaped};

  var bus = createInteractionBus(interactions);

  // ── Render chart view ───────────────────────────────────────────────────
  var chartContainer = document.getElementById('chart-view');
  if (chartHtml) {
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;';
    iframe.srcdoc = chartHtml;
    chartContainer.appendChild(iframe);

    // Wire interaction bus into the chart iframe
    iframe.addEventListener('load', function() {
      var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      var iframeWin = iframe.contentWindow;

      // Inject highlight behavior into chart SVG elements
      function wireChartInteractions() {
        if (!iframeDoc) return;
        var svg = iframeDoc.querySelector('svg');
        if (!svg) return;

        // Find hoverable elements (rects, circles, paths with data)
        var elements = svg.querySelectorAll('rect[data-value], circle[data-value], rect.bar, circle.dot, path.line-segment');

        // Also look for common D3 rendered elements
        var allRects = svg.querySelectorAll('rect');
        var allCircles = svg.querySelectorAll('circle');

        // Attach listeners to all interactive elements
        [].forEach.call(allRects, function(el) {
          el.addEventListener('mouseenter', function() {
            // Try to find which data row this element corresponds to
            var datum = findDatum(el, data, bus.fields);
            if (datum) bus.highlight(datum);
          });
          el.addEventListener('mouseleave', function() {
            bus.clearHighlight();
          });
        });

        [].forEach.call(allCircles, function(el) {
          el.addEventListener('mouseenter', function() {
            var datum = findDatum(el, data, bus.fields);
            if (datum) bus.highlight(datum);
          });
          el.addEventListener('mouseleave', function() {
            bus.clearHighlight();
          });
        });

        // Listen for highlight events from the bus to highlight chart elements
        bus.onHighlight(function(row) {
          [].forEach.call(allRects, function(el) {
            var datum = findDatum(el, data, bus.fields);
            if (datum && bus.matchRow(datum, row)) {
              el.style.opacity = '1';
              el.style.filter = 'brightness(1.3)';
            } else if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') {
              el.style.opacity = '0.3';
              el.style.filter = '';
            }
          });
          [].forEach.call(allCircles, function(el) {
            var datum = findDatum(el, data, bus.fields);
            if (datum && bus.matchRow(datum, row)) {
              el.style.opacity = '1';
              el.style.filter = 'brightness(1.3)';
            } else if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none' && el.getAttribute('r')) {
              el.style.opacity = '0.3';
              el.style.filter = '';
            }
          });
        });

        bus.onClearHighlight(function() {
          [].forEach.call(allRects, function(el) {
            el.style.opacity = '';
            el.style.filter = '';
          });
          [].forEach.call(allCircles, function(el) {
            el.style.opacity = '';
            el.style.filter = '';
          });
        });
      }

      // Data-element matching heuristic
      function findDatum(el, data, fields) {
        // Try to match element text content or position to data
        // This uses a heuristic: check the element's __data__ if D3 bound it
        if (iframeWin && iframeWin.d3) {
          var d3Data = iframeWin.d3.select(el).datum();
          if (d3Data && typeof d3Data === 'object') return d3Data;
        }
        return null;
      }

      // D3 renders async, wait a tick
      setTimeout(wireChartInteractions, 200);
    });
  }

  // ── Render table view ──────────────────────────────────────────────────
  var tableContainer = document.getElementById('table-view');
  renderTable(tableContainer, data, tableSpec, bus);
})();
<\/script>
</body>
</html>`;
}

/** Default size ratios: chart gets 3, table gets 2 */
function getDefaultSizes(views: CompoundVisualizationSpec['views']): number[] {
  return views.map(v => v.type === 'chart' ? 3 : 2);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
