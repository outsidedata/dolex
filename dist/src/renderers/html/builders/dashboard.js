/**
 * Self-contained HTML builder for dashboard visualizations.
 *
 * Produces a single HTML document with:
 * - Header bar with title + global filter controls
 * - CSS grid body with N chart panels
 * - Each chart rendered via buildChartHtml() embedded as srcdoc iframe
 * - Global filters operate client-side on pre-fetched data
 * - Cross-filter interaction bus between views
 */
import { buildChartHtml } from '../index.js';
/**
 * Build a self-contained HTML document for a dashboard.
 *
 * @param dashboardSpec - The dashboard specification
 * @param viewData - Pre-resolved data + specs for each view
 * @returns Complete HTML document string
 */
export function buildDashboardHtml(dashboardSpec, viewData) {
    const layout = dashboardSpec.layout || { columns: 2 };
    const cols = layout.columns;
    const gap = 12;
    const theme = dashboardSpec.theme || 'dark';
    const isDark = theme === 'dark';
    // Build chart HTML for each view
    const viewHtmlEntries = [];
    for (const vd of viewData) {
        let chartHtml = buildChartHtml(vd.spec);
        // Strip min-height so chart fills its panel
        chartHtml = chartHtml.replace(/min-height:\s*500px/g, 'height: 100%');
        viewHtmlEntries.push({
            viewId: vd.viewId,
            chartHtml,
            title: dashboardSpec.views.find(v => v.id === vd.viewId)?.title || vd.viewId,
        });
    }
    // Grid template: auto-fill rows based on view count and column count
    const rows = Math.ceil(viewHtmlEntries.length / cols);
    // Build view size CSS overrides
    const viewSizeCss = buildViewSizeCss(dashboardSpec, viewHtmlEntries);
    // Safely encode data for embedding in script
    const safeJson = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
    const MAX_EMBED_ROWS = 10_000;
    const viewDataJson = safeJson(viewData.map(vd => ({
        viewId: vd.viewId,
        data: vd.data && vd.data.length > MAX_EMBED_ROWS ? vd.data.slice(0, MAX_EMBED_ROWS) : vd.data,
        spec: vd.spec,
    })));
    const filtersJson = safeJson(dashboardSpec.globalFilters || []);
    const interactionsJson = safeJson(dashboardSpec.interactions || []);
    // Build chart HTML map for embedding
    const chartHtmlMapJson = safeJson(Object.fromEntries(viewHtmlEntries.map(e => [e.viewId, e.chartHtml])));
    // Colors
    const bg = isDark ? '#0f1117' : '#ffffff';
    const headerBg = isDark ? '#161822' : '#f8f9fa';
    const panelBg = isDark ? '#161822' : '#ffffff';
    const borderColor = isDark ? '#2d3041' : '#e2e8f0';
    const textColor = isDark ? '#d1d5db' : '#1a202c';
    const mutedText = isDark ? '#9ca3af' : '#718096';
    const filterBg = isDark ? '#1e2028' : '#f1f5f9';
    const filterBorder = isDark ? '#374151' : '#cbd5e0';
    const panelHtml = viewHtmlEntries.map((entry, i) => `
      <div class="panel" id="panel-${entry.viewId}" data-view-id="${escapeAttr(entry.viewId)}"${viewSizeCss[i] || ''}>
        <div class="panel-header">${escapeHtml(entry.title)}</div>
        <div class="panel-body">
          <iframe class="chart-frame" data-view-id="${escapeAttr(entry.viewId)}"></iframe>
        </div>
      </div>`).join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(dashboardSpec.title || 'Dashboard')}</title>
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 100%; height: 100%; overflow: auto;
  background: ${bg}; color: ${textColor};
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
#dashboard-root {
  width: 100%; min-height: 100%;
  display: flex; flex-direction: column;
}
#dashboard-header {
  padding: 16px 20px;
  background: ${headerBg};
  border-bottom: 1px solid ${borderColor};
  flex-shrink: 0;
}
#dashboard-title {
  font-size: 18px; font-weight: 700;
  margin-bottom: 4px;
}
#dashboard-description {
  font-size: 13px; color: ${mutedText};
  margin-bottom: 0;
}
#filter-bar {
  display: flex; gap: 12px; flex-wrap: wrap;
  padding: 12px 20px;
  background: ${headerBg};
  border-bottom: 1px solid ${borderColor};
  flex-shrink: 0;
}
#filter-bar:empty { display: none; }
.filter-group {
  display: flex; flex-direction: column; gap: 4px;
}
.filter-label {
  font-size: 11px; font-weight: 600; color: ${mutedText};
  text-transform: uppercase; letter-spacing: 0.5px;
}
.filter-control {
  padding: 6px 10px; border-radius: 6px;
  background: ${filterBg}; border: 1px solid ${filterBorder};
  color: ${textColor}; font-size: 13px;
  font-family: Inter, system-ui, sans-serif;
  min-width: 140px;
}
.filter-control:focus {
  outline: none; border-color: #3366AA;
  box-shadow: 0 0 0 2px rgba(51,102,170,0.2);
}
#dashboard-grid {
  display: grid;
  grid-template-columns: repeat(${cols}, 1fr);
  gap: ${gap}px;
  padding: ${gap}px;
  flex: 1;
}
.panel {
  display: flex; flex-direction: column;
  min-height: 320px;
  overflow: hidden;
}
.panel-header {
  display: none;
}
.panel-body {
  flex: 1; min-height: 0; overflow: hidden;
}
.chart-frame {
  width: 100%; height: 100%; border: none;
}
</style>
</head>
<body>
<div id="dashboard-root">
  <div id="dashboard-header">
    <div id="dashboard-title">${escapeHtml(dashboardSpec.title || 'Dashboard')}</div>
    ${dashboardSpec.description ? `<div id="dashboard-description">${escapeHtml(dashboardSpec.description)}</div>` : ''}
  </div>
  <div id="filter-bar"></div>
  <div id="dashboard-grid">
    ${panelHtml}
  </div>
</div>

<script>
(function() {
  var viewData = ${viewDataJson};
  var chartHtmlMap = ${chartHtmlMapJson};
  var filters = ${filtersJson};
  var interactions = ${interactionsJson};

  // ── State ─────────────────────────────────────────────────────────────────
  var filterState = {};
  filters.forEach(function(f) {
    if (f.currentValue != null) filterState[f.field] = f.currentValue;
  });

  // ── Render Filter Controls ────────────────────────────────────────────────
  var filterBar = document.getElementById('filter-bar');
  filters.forEach(function(f) {
    var group = document.createElement('div');
    group.className = 'filter-group';

    var label = document.createElement('label');
    label.className = 'filter-label';
    label.textContent = f.label || f.field;
    group.appendChild(label);

    if (f.type === 'select') {
      var sel = document.createElement('select');
      sel.className = 'filter-control';
      sel.setAttribute('data-field', f.field);

      // "All" option
      var allOpt = document.createElement('option');
      allOpt.value = '__all__';
      allOpt.textContent = 'All';
      sel.appendChild(allOpt);

      // Get values from spec or derive from data
      var vals = f.values || deriveValues(f.field);
      vals.forEach(function(v) {
        var opt = document.createElement('option');
        opt.value = String(v);
        opt.textContent = String(v);
        if (f.currentValue != null && String(f.currentValue) === String(v)) {
          opt.selected = true;
        }
        sel.appendChild(opt);
      });

      sel.addEventListener('change', function() {
        var val = sel.value;
        if (val === '__all__') {
          delete filterState[f.field];
        } else {
          filterState[f.field] = val;
        }
        applyFilters();
      });
      group.appendChild(sel);
    } else if (f.type === 'multi-select') {
      var sel = document.createElement('select');
      sel.className = 'filter-control';
      sel.setAttribute('data-field', f.field);
      sel.multiple = true;
      sel.style.minHeight = '60px';

      var vals = f.values || deriveValues(f.field);
      vals.forEach(function(v) {
        var opt = document.createElement('option');
        opt.value = String(v);
        opt.textContent = String(v);
        sel.appendChild(opt);
      });

      sel.addEventListener('change', function() {
        var selected = [];
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].selected) selected.push(sel.options[i].value);
        }
        if (selected.length === 0) {
          delete filterState[f.field];
        } else {
          filterState[f.field] = selected;
        }
        applyFilters();
      });
      group.appendChild(sel);
    } else if (f.type === 'range') {
      var range = document.createElement('input');
      range.type = 'range';
      range.className = 'filter-control';
      range.setAttribute('data-field', f.field);
      var numVals = (f.values || deriveNumericRange(f.field));
      if (numVals.length >= 2) {
        range.min = String(numVals[0]);
        range.max = String(numVals[numVals.length - 1]);
        range.value = String(f.currentValue || numVals[numVals.length - 1]);
      }
      range.addEventListener('input', function() {
        filterState[f.field] = Number(range.value);
        applyFilters();
      });
      group.appendChild(range);
    }

    filterBar.appendChild(group);
  });

  // ── Derive filter values from all view data ───────────────────────────────
  function deriveValues(field) {
    var seen = {};
    var vals = [];
    viewData.forEach(function(vd) {
      vd.data.forEach(function(row) {
        var v = row[field];
        if (v != null && !seen[String(v)]) {
          seen[String(v)] = true;
          vals.push(v);
        }
      });
    });
    return vals.sort();
  }

  function deriveNumericRange(field) {
    var min = Infinity, max = -Infinity;
    viewData.forEach(function(vd) {
      vd.data.forEach(function(row) {
        var v = Number(row[field]);
        if (!isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      });
    });
    return [min, max];
  }

  // ── Apply global filters to all views ─────────────────────────────────────
  function applyFilters() {
    viewData.forEach(function(vd) {
      var filtered = filterData(vd.data);
      var updatedSpec = JSON.parse(JSON.stringify(vd.spec));
      updatedSpec.data = filtered;
      rerenderView(vd.viewId, updatedSpec);
    });
  }

  function filterData(data) {
    var fields = Object.keys(filterState);
    if (fields.length === 0 || data.length === 0) return data;
    // Only filter on fields that exist in this view's data
    var dataKeys = Object.keys(data[0]);
    var applicableFields = fields.filter(function(f) { return dataKeys.indexOf(f) !== -1; });
    if (applicableFields.length === 0) return data;
    return data.filter(function(row) {
      return applicableFields.every(function(field) {
        var val = filterState[field];
        var rowVal = row[field];
        if (rowVal == null) return false;
        if (Array.isArray(val)) {
          return val.indexOf(String(rowVal)) !== -1;
        }
        if (typeof val === 'number') {
          return Number(rowVal) <= val;
        }
        return String(rowVal) === String(val);
      });
    });
  }

  // ── Cross-filter interaction bus ──────────────────────────────────────────
  var crossfilterFields = [];
  var highlightCallbacks = [];
  var clearCallbacks = [];

  (interactions || []).forEach(function(ix) {
    if (ix.field) crossfilterFields.push(ix.field);
  });

  var bus = {
    fields: crossfilterFields,
    highlight: function(row, sourceViewId) {
      highlightCallbacks.forEach(function(cb) { cb(row, sourceViewId); });
    },
    clearHighlight: function(sourceViewId) {
      clearCallbacks.forEach(function(cb) { cb(sourceViewId); });
    },
    onHighlight: function(cb) { highlightCallbacks.push(cb); },
    onClearHighlight: function(cb) { clearCallbacks.push(cb); },
  };

  // ── Render views ──────────────────────────────────────────────────────────
  function renderAllViews() {
    viewData.forEach(function(vd) {
      var iframe = document.querySelector('iframe[data-view-id="' + vd.viewId + '"]');
      if (!iframe) return;
      iframe.srcdoc = chartHtmlMap[vd.viewId] || '';
    });
  }

  function rerenderView(viewId, updatedSpec) {
    var iframe = document.querySelector('iframe[data-view-id="' + viewId + '"]');
    if (!iframe) return;
    var originalHtml = chartHtmlMap[viewId];
    if (!originalHtml) return;

    // The chart HTML embeds: window.__SPEC__ = {JSON}; then a script close tag.
    // We find the marker, replace the JSON blob, then re-attach the closing tag.
    try {
      var marker = 'window.__SPEC__ = ';
      var start = originalHtml.indexOf(marker);
      if (start === -1) { iframe.srcdoc = originalHtml; return; }
      var jsonStart = start + marker.length;
      var scriptClose = '<' + '/script>';
      var scriptEnd = originalHtml.indexOf(scriptClose, jsonStart);
      if (scriptEnd === -1) { iframe.srcdoc = originalHtml; return; }
      var newSpecJson = JSON.stringify(updatedSpec).replace(/<\\//g, '<\\\\/');
      var html = originalHtml.substring(0, jsonStart) + newSpecJson + ';\\n' + originalHtml.substring(scriptEnd);
      iframe.srcdoc = html;
    } catch (e) {
      iframe.srcdoc = originalHtml;
    }
  }

  // Initial render
  renderAllViews();
})();
<\/script>
</body>
</html>`;
}
function buildViewSizeCss(spec, entries) {
    const sizes = spec.layout?.viewSizes || {};
    return entries.map(e => {
        const s = sizes[e.viewId];
        if (!s)
            return '';
        const parts = [];
        if (s.colSpan)
            parts.push(`grid-column: span ${s.colSpan}`);
        if (s.rowSpan)
            parts.push(`grid-row: span ${s.rowSpan}`);
        return parts.length > 0 ? ` style="${parts.join(';')}"` : '';
    });
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
//# sourceMappingURL=dashboard.js.map