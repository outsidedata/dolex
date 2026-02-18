/**
 * Shared D3 rendering utilities — axes, scales, colors, margins, tooltips.
 */
import { categorical, sequential, diverging, colorSchemes, DARK_BG, AXIS_COLOR, GRID_COLOR, TEXT_COLOR, TEXT_MUTED, } from '../../theme/colors.js';
// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const DEFAULT_MARGINS = { top: 40, right: 30, bottom: 50, left: 60 };
export { categorical as DEFAULT_PALETTE } from '../../theme/colors.js';
export { DARK_BG, AXIS_COLOR, GRID_COLOR, TEXT_COLOR, TEXT_MUTED };
/**
 * Create an SVG element inside the container and return the root <g> group
 * translated by the margin. Also returns computed dimensions.
 */
export function createSvg(container, spec, marginOverrides) {
    const margin = { ...DEFAULT_MARGINS, ...marginOverrides };
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', DARK_BG)
        .style('border-radius', '8px');
    // Title (with auto-truncation to fit within SVG width)
    if (spec.title) {
        const titleEl = svg
            .append('text')
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
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    return { svg, g, dims: { width, height, innerWidth, innerHeight, margin } };
}
// ─── SCALES ──────────────────────────────────────────────────────────────────
export function buildXScale(encoding, data, innerWidth) {
    if (!encoding)
        return null;
    const field = encoding.field;
    switch (encoding.type) {
        case 'nominal':
        case 'ordinal': {
            const domain = [...new Set(data.map((d) => d[field]))];
            return d3.scaleBand().domain(domain).range([0, innerWidth]).padding(0.2);
        }
        case 'quantitative': {
            const values = data.map((d) => Number(d[field]));
            const extent = d3.extent(values);
            const padding = (extent[1] - extent[0]) * 0.05 || 1;
            return d3
                .scaleLinear()
                .domain([extent[0] - padding, extent[1] + padding])
                .range([0, innerWidth])
                .nice();
        }
        case 'temporal': {
            const dates = data.map((d) => new Date(d[field]));
            return d3
                .scaleTime()
                .domain(d3.extent(dates))
                .range([0, innerWidth])
                .nice();
        }
        default:
            return d3.scaleLinear().range([0, innerWidth]);
    }
}
export function buildYScale(encoding, data, innerHeight) {
    if (!encoding)
        return null;
    const field = encoding.field;
    switch (encoding.type) {
        case 'nominal':
        case 'ordinal': {
            const domain = [...new Set(data.map((d) => d[field]))];
            return d3.scaleBand().domain(domain).range([0, innerHeight]).padding(0.2);
        }
        case 'quantitative': {
            const values = data.map((d) => Number(d[field]));
            const max = d3.max(values);
            const min = Math.min(0, d3.min(values));
            return d3.scaleLinear().domain([min, max]).range([innerHeight, 0]).nice();
        }
        case 'temporal': {
            const dates = data.map((d) => new Date(d[field]));
            return d3
                .scaleTime()
                .domain(d3.extent(dates))
                .range([innerHeight, 0])
                .nice();
        }
        default:
            return d3.scaleLinear().range([innerHeight, 0]);
    }
}
const PALETTE_MAP = {
    categorical,
    ...sequential,
    ...diverging,
    ...colorSchemes,
};
/**
 * Resolve a named palette to an array of color strings.
 */
function resolvePalette(name) {
    const palette = PALETTE_MAP[name];
    return palette ? [...palette] : null;
}
function isSequentialPalette(name) {
    return !!name && name in sequential;
}
function isDivergingPalette(name) {
    return !!name && name in diverging;
}
export function buildColorScale(encoding, data, valueField) {
    if (!encoding || !encoding.field) {
        return () => categorical[0];
    }
    const field = encoding.field;
    // ── HIGHLIGHT MODE ──
    // Specific values get color, all others are muted gray
    // Only activate if at least one highlight value matches actual data
    if (encoding.highlight && encoding.highlight.values.length > 0) {
        const normalize = (v) => String(v).trim().toLowerCase();
        const dataValues = new Set(data.map(d => normalize(d[field])));
        const hasMatchingValues = encoding.highlight.values.some(v => dataValues.has(normalize(v)));
        if (hasMatchingValues) {
            const highlightSet = new Set(encoding.highlight.values.map(v => normalize(v)));
            const highlightColors = Array.isArray(encoding.highlight.color)
                ? encoding.highlight.color
                : encoding.highlight.color
                    ? [encoding.highlight.color]
                    : [categorical[0]];
            const mutedColor = encoding.highlight.mutedColor || '#6b7280';
            const mutedOpacity = encoding.highlight.mutedOpacity ?? 1.0;
            return (value) => {
                if (highlightSet.has(normalize(value))) {
                    const idx = encoding.highlight.values.findIndex(v => normalize(v) === normalize(value));
                    return highlightColors[idx % highlightColors.length];
                }
                if (mutedOpacity < 1.0) {
                    const hex = mutedColor.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    return `rgba(${r}, ${g}, ${b}, ${mutedOpacity})`;
                }
                return mutedColor;
            };
        }
        // No matching values — fall through to palette/default logic
    }
    // ── PALETTE SELECTION ──
    // Use a named palette from the theme
    if (encoding.palette) {
        const palette = resolvePalette(encoding.palette);
        if (palette) {
            // Diverging palette + quantitative → symmetric scale centered at zero
            // Returns a scale that takes a numeric value directly (e.g. -5.2 → red, +3.1 → green)
            if (isDivergingPalette(encoding.palette) && encoding.type === 'quantitative') {
                const values = data.map((d) => Number(d[field]));
                const maxAbs = Math.max(Math.abs(d3.min(values)), Math.abs(d3.max(values))) || 1;
                const mid = Math.floor(palette.length / 2);
                return d3
                    .scaleLinear()
                    .domain([-maxAbs, 0, maxAbs])
                    .range([palette[0], palette[mid], palette[palette.length - 1]])
                    .interpolate(d3.interpolateRgb)
                    .clamp(true);
            }
            // Sequential/diverging palettes with category-to-value mapping
            // (nominal field colored by a separate value field)
            if ((isSequentialPalette(encoding.palette) || isDivergingPalette(encoding.palette)) && valueField) {
                const valueExtent = d3.extent(data, (d) => Number(d[valueField]));
                const colorScale = d3
                    .scaleLinear()
                    .domain([valueExtent[0], valueExtent[1]])
                    .range([palette[0], palette[palette.length - 1]])
                    .interpolate(d3.interpolateRgb);
                // Return a function that maps category → color based on its value
                const categoryToValue = new Map(data.map(d => [d[field], Number(d[valueField])]));
                return (category) => {
                    const value = categoryToValue.get(category);
                    return value !== undefined ? colorScale(value) : palette[0];
                };
            }
            // Quantitative color encoding (for scatter plots, etc.)
            if (encoding.type === 'quantitative') {
                const extent = d3.extent(data, (d) => Number(d[field]));
                return d3
                    .scaleLinear()
                    .domain([extent[0], extent[1]])
                    .range([palette[0], palette[palette.length - 1]])
                    .interpolate(d3.interpolateRgb);
            }
            // Categorical/ordinal (for color schemes like traffic-light, profit-loss)
            const domain = [...new Set(data.map((d) => d[field]))];
            return d3.scaleOrdinal().domain(domain).range(palette);
        }
    }
    // ── CUSTOM SCALE ──
    if (encoding.scale?.domain && encoding.scale?.range) {
        if (encoding.type === 'quantitative') {
            return d3
                .scaleLinear()
                .domain(encoding.scale.domain)
                .range(encoding.scale.range)
                .interpolate(d3.interpolateRgb);
        }
        return d3.scaleOrdinal().domain(encoding.scale.domain).range(encoding.scale.range);
    }
    // ── DEFAULT ──
    // Quantitative: use viridis interpolator
    if (encoding.type === 'quantitative') {
        const extent = d3.extent(data, (d) => Number(d[field]));
        return d3.scaleSequential(d3.interpolateViridis).domain(extent);
    }
    // Categorical: use default categorical palette, extended for large domains
    const domain = [...new Set(data.map((d) => d[field]))];
    let palette = [...categorical];
    if (domain.length > palette.length) {
        const extra = d3.quantize(d3.interpolateRainbow, domain.length - palette.length + 1);
        palette = palette.concat(extra);
    }
    return d3.scaleOrdinal().domain(domain).range(palette);
}
// ─── CONTRAST TEXT COLOR ─────────────────────────────────────────────────────
/**
 * Return a readable text color (white or near-black) for a given background.
 * Uses WCAG relative luminance to pick the higher-contrast option.
 * Works with hex (#rgb, #rrggbb), rgb(), and rgba() strings.
 */
export function contrastText(bgColor) {
    const rgb = parseColor(bgColor);
    if (!rgb)
        return '#ffffff';
    const luminance = relativeLuminance(rgb[0], rgb[1], rgb[2]);
    // Threshold 0.18 gives white text on medium-dark and darker backgrounds,
    // dark text on medium-light and lighter backgrounds.
    return luminance > 0.18 ? '#1a1a2e' : '#ffffff';
}
/**
 * Return a muted/secondary text color appropriate for the given background.
 * Similar to contrastText but at reduced emphasis.
 */
export function contrastTextMuted(bgColor) {
    const rgb = parseColor(bgColor);
    if (!rgb)
        return 'rgba(255,255,255,0.7)';
    const luminance = relativeLuminance(rgb[0], rgb[1], rgb[2]);
    return luminance > 0.18 ? 'rgba(26,26,46,0.6)' : 'rgba(255,255,255,0.7)';
}
function parseColor(color) {
    // Hex: #rgb or #rrggbb
    const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16),
        ];
    }
    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
    }
    return null;
}
function relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
// ─── ADAPTIVE LAYOUT HELPERS ─────────────────────────────────────────────────
// See docs/standards/shared-utilities.md
/**
 * Calculate adaptive tick count based on available pixel space.
 * Prevents crowded ticks on small charts and sparse ticks on large ones.
 */
export function getAdaptiveTickCount(availableSpace, minSpacing = 60) {
    return Math.max(3, Math.floor(availableSpace / minSpacing));
}
/**
 * Calculate required left margin for horizontal bar charts
 * based on the longest category label.
 */
export function calculateLeftMargin(labels, fontSize = 11) {
    const charWidthLatin = fontSize * 0.55;
    const charWidthCJK = fontSize * 1.0;
    const maxWidth = Math.max(...labels.map((l) => {
        const s = String(l);
        let w = 0;
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            w += (code > 0x2E80 && code < 0x9FFF) || (code > 0xFF00 && code < 0xFFEF)
                ? charWidthCJK : charWidthLatin;
        }
        return w;
    }));
    return Math.max(80, Math.min(220, maxWidth + 20));
}
/**
 * Check if axis labels need rotation based on available width per bar.
 * Returns true when average label width exceeds 80% of bar width.
 */
export function shouldRotateLabels(labels, barWidth, fontSize = 11) {
    const avgLabelLength = labels.reduce((sum, l) => sum + String(l).length, 0) / labels.length;
    const estimatedLabelWidth = avgLabelLength * (fontSize * 0.6);
    return estimatedLabelWidth > barWidth * 0.8;
}
/**
 * Calculate required bottom margin for vertical bar charts.
 * When labels are rotated, they need more vertical space.
 */
export function calculateBottomMargin(labels, willRotate, fontSize = 11) {
    if (!willRotate)
        return 60;
    const maxLength = Math.max(...labels.map((l) => String(l).length));
    const charWidth = fontSize * 0.6;
    // At 45° rotation, vertical space ≈ labelWidth × sin(45°) ≈ labelWidth × 0.7
    const estimatedHeight = maxLength * charWidth * 0.7;
    return Math.max(70, Math.min(150, estimatedHeight + 35));
}
/**
 * Truncate label if it exceeds max length, preserving full text for tooltips.
 * Uses Unicode ellipsis character.
 */
export function truncateLabel(label, maxLength = 25) {
    const str = String(label);
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 1) + '\u2026';
}
/**
 * Truncate an SVG <text> element in-place if it exceeds maxWidth pixels.
 * Uses getComputedTextLength() for accurate measurement.
 * Adds an SVG <title> tooltip with the full text when truncated.
 */
export function truncateTitle(textEl, fullText, maxWidth) {
    const node = textEl.node();
    if (!node || !node.getComputedTextLength)
        return;
    if (node.getComputedTextLength() <= maxWidth)
        return;
    let lo = 0;
    let hi = fullText.length;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        node.textContent = fullText.slice(0, mid) + '\u2026';
        if (node.getComputedTextLength() <= maxWidth) {
            lo = mid;
        }
        else {
            hi = mid - 1;
        }
    }
    node.textContent = lo > 0 ? fullText.slice(0, lo) + '\u2026' : '\u2026';
    textEl.append('title').text(fullText);
}
/**
 * Render an "All values are zero" empty state centered in the chart area.
 * Returns true if empty state was rendered (caller should return early).
 */
export function renderEmptyState(g, dims, message = 'All values are zero') {
    g.append('text')
        .attr('x', dims.innerWidth / 2)
        .attr('y', dims.innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '14px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(message);
}
/**
 * Check if all numeric values for a given field are zero.
 */
export function isAllZeros(data, field) {
    return data.every(d => Number(d[field]) === 0);
}
/**
 * Determine if value labels should be shown based on bar dimensions.
 * Explicit `config.showLabels` takes precedence; otherwise auto-enable
 * when bars are large enough to fit text.
 *
 * For horizontal bars: check bandwidth (height) >= 20px
 * For vertical bars: check bandwidth (width) >= 35px
 */
export function shouldShowValueLabels(config, barDimension, isHorizontal) {
    if (config.showLabels !== undefined)
        return config.showLabels;
    return isHorizontal ? barDimension >= 20 : barDimension >= 35;
}
// ─── AXES ────────────────────────────────────────────────────────────────────
export function drawXAxis(g, xScale, innerHeight, _label, isOrdinal = false) {
    const axis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .ticks(isOrdinal ? null : 6)
        .tickSize(-innerHeight)
        .tickPadding(8));
    styleAxis(axis);
}
export function drawYAxis(g, yScale, innerWidth, _label) {
    const axis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerWidth).tickPadding(8));
    styleAxis(axis);
}
/**
 * Apply consistent axis styling: grid lines, domain stroke, tick text.
 * Also applies smart formatting to fix tiny-decimal "0.00" labels and
 * deduplicates tick labels when the domain is narrow.
 * All renderers should use this instead of styling axes manually.
 */
export function styleAxis(axis) {
    axis.selectAll('.domain').attr('stroke', AXIS_COLOR).attr('stroke-width', 0.5);
    axis
        .selectAll('.tick line')
        .attr('stroke', GRID_COLOR)
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '2,2');
    axis
        .selectAll('.tick text')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif');
    fixTickLabels(axis);
}
/**
 * Smart-format axis tick labels: detects tiny-decimal "0.00" repetition
 * and reformats with sufficient precision, then deduplicates identical labels.
 */
function fixTickLabels(axis) {
    const ticks = axis.selectAll('.tick text');
    const nodes = [];
    ticks.each(function () { nodes.push(this); });
    if (nodes.length < 2)
        return;
    const texts = nodes.map((n) => n.textContent || '');
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size < Math.min(nodes.length, 3)) {
        const values = [];
        ticks.each(function (d) { values.push(Number(d)); });
        const validValues = values.filter(v => !isNaN(v));
        if (validValues.length < 2)
            return;
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const span = max - min;
        if (span > 0) {
            const precision = span >= 1 ? 1 : Math.max(2, Math.ceil(-Math.log10(span)) + 2);
            const fmt = (v) => {
                if (Math.abs(v) >= 1e6)
                    return (v / 1e6).toFixed(1) + 'M';
                if (Math.abs(v) >= 1e3)
                    return (v / 1e3).toFixed(1) + 'K';
                if (Number.isInteger(v) && Math.abs(v) < 1e3)
                    return v.toFixed(0);
                return v.toFixed(precision);
            };
            ticks.each(function (d) {
                const v = Number(d);
                if (!isNaN(v))
                    this.textContent = fmt(v);
            });
        }
        const reformattedTexts = nodes.map((n) => n.textContent || '');
        const seen = new Set();
        reformattedTexts.forEach((t, i) => {
            if (seen.has(t)) {
                nodes[i].style.display = 'none';
                const line = nodes[i].parentNode?.querySelector('line');
                if (line)
                    line.style.display = 'none';
            }
            else {
                seen.add(t);
            }
        });
    }
}
// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
let tooltipEl = null;
let tooltipContainer = null;
export function createTooltip(container) {
    tooltipContainer = container;
    if (tooltipEl && document.body.contains(tooltipEl)) {
        return tooltipEl;
    }
    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = `
    position: fixed;
    pointer-events: none;
    background: #1e2028;
    color: ${TEXT_COLOR};
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: Inter, system-ui, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    border: 1px solid #2d3041;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.15s;
    max-width: 300px;
    line-height: 1.5;
  `;
    document.body.appendChild(tooltipEl);
    return tooltipEl;
}
export function positionTooltip(tooltip, event) {
    const gap = 12;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const vh = window.innerHeight;
    const rect = tooltipContainer?.getBoundingClientRect();
    const midX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    let left = event.clientX > midX
        ? event.clientX - tw - gap
        : event.clientX + gap;
    let top = event.clientY - gap;
    if (top + th > vh)
        top = event.clientY - th - gap;
    if (left < 0)
        left = 0;
    if (top < 0)
        top = 0;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}
export function showTooltip(tooltip, html, event) {
    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';
    positionTooltip(tooltip, event);
}
export function hideTooltip(tooltip) {
    tooltip.style.opacity = '0';
}
/**
 * Create a standardised HTML flex-wrap legend.
 *
 * Accepts either a d3 color scale (domain → colors) or an explicit array of
 * `LegendEntry` objects for one-off legends (e.g. waterfall, connected-dot-plot).
 */
export function smartTruncateLabels(labels, maxLen) {
    if (labels.every(l => l.length <= maxLen))
        return labels;
    const prefixLen = findCommonAffixLength(labels, 'prefix');
    const suffixLen = findCommonAffixLength(labels, 'suffix');
    const hasSharedAffix = (prefixLen + suffixLen) > 5;
    if (hasSharedAffix) {
        return labels.map(l => {
            if (l.length <= maxLen)
                return l;
            const uniquePart = l.slice(prefixLen, l.length - suffixLen || undefined);
            if (uniquePart.length <= maxLen - 2) {
                return '\u2026' + uniquePart + '\u2026';
            }
            const keep = maxLen - 2;
            return '\u2026' + uniquePart.slice(0, keep) + '\u2026';
        });
    }
    return labels.map(l => {
        if (l.length <= maxLen)
            return l;
        const keep = maxLen - 1;
        const front = Math.ceil(keep * 0.5);
        const back = keep - front;
        return back > 0
            ? l.slice(0, front) + '\u2026' + l.slice(-back)
            : l.slice(0, keep) + '\u2026';
    });
}
function findCommonAffixLength(strings, direction) {
    if (strings.length <= 1)
        return 0;
    const get = direction === 'prefix'
        ? (s, i) => s[i]
        : (s, i) => s[s.length - 1 - i];
    const minLen = Math.min(...strings.map(s => s.length));
    let len = 0;
    for (let i = 0; i < minLen; i++) {
        const ch = get(strings[0], i);
        if (strings.every(s => get(s, i) === ch)) {
            len++;
        }
        else {
            break;
        }
    }
    return len;
}
export function createLegend(source, options) {
    const shape = options?.shape ?? 'square';
    const callbacks = options?.callbacks;
    let entries;
    if (Array.isArray(source) && source.length > 0 && source[0]?.label !== undefined) {
        entries = source;
    }
    else {
        const domain = source.domain?.() ?? [];
        entries = domain.map((label) => ({
            label: String(label),
            color: source(label),
        }));
    }
    if (!entries.length) {
        return document.createElement('div');
    }
    const maxItems = options?.maxItems ?? 12;
    let overflowCount = 0;
    if (entries.length > maxItems) {
        overflowCount = entries.length - (maxItems - 1);
        entries = entries.slice(0, maxItems - 1);
    }
    const maxLabelLen = 20;
    const displayLabels = smartTruncateLabels(entries.map(e => e.label), maxLabelLen);
    const legend = document.createElement('div');
    legend.style.cssText = `
    display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px;
    padding: 6px 12px 8px; font-family: Inter, system-ui, sans-serif;
    font-size: 11px; line-height: 1;
  `;
    entries.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.style.cssText = callbacks
            ? 'display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; cursor: pointer; transition: opacity 0.15s;'
            : 'display: flex; align-items: center; gap: 5px; white-space: nowrap;';
        item.setAttribute('data-series', entry.label);
        const swatch = document.createElement('span');
        if (shape === 'circle') {
            swatch.style.cssText = `
        width: 8px; height: 8px; border-radius: 50%;
        background: ${entry.color}; flex-shrink: 0; transition: transform 0.15s;
      `;
        }
        else if (shape === 'line') {
            swatch.style.cssText = `
        width: 16px; height: 3px; border-radius: 1px;
        background: ${entry.color}; flex-shrink: 0; transition: transform 0.15s;
      `;
        }
        else if (shape === 'line-dot') {
            swatch.style.cssText = `
        width: 16px; height: 2px; border-radius: 1px;
        background: ${entry.color}; flex-shrink: 0; position: relative;
        transition: transform 0.15s;
      `;
            const dot = document.createElement('span');
            dot.style.cssText = `
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 6px; height: 6px; border-radius: 50%;
        background: ${entry.color}; border: 1px solid ${DARK_BG};
      `;
            swatch.appendChild(dot);
        }
        else {
            swatch.style.cssText = `
        width: 10px; height: 10px; border-radius: 2px;
        background: ${entry.color}; flex-shrink: 0; transition: transform 0.15s;
      `;
        }
        const text = document.createElement('span');
        text.style.color = TEXT_MUTED;
        text.textContent = displayLabels[idx];
        if (entry.label.length > maxLabelLen)
            text.title = entry.label;
        item.appendChild(swatch);
        item.appendChild(text);
        if (entry.extra) {
            const extra = document.createElement('span');
            extra.style.color = TEXT_MUTED;
            extra.style.opacity = '0.7';
            extra.textContent = entry.extra;
            item.appendChild(extra);
        }
        if (callbacks) {
            item.addEventListener('mouseenter', () => {
                swatch.style.transform = shape === 'line' || shape === 'line-dot' ? 'scaleY(2)' : 'scale(1.4)';
                callbacks.onHover?.(entry.label);
            });
            item.addEventListener('mouseleave', () => {
                swatch.style.transform = '';
                callbacks.onLeave?.();
            });
        }
        legend.appendChild(item);
    });
    if (overflowCount > 0) {
        const more = document.createElement('div');
        more.style.cssText = 'display: flex; align-items: center; gap: 5px; white-space: nowrap;';
        const moreText = document.createElement('span');
        moreText.style.cssText = `color: ${TEXT_MUTED}; opacity: 0.6; font-style: italic;`;
        moreText.textContent = `+${overflowCount} more`;
        more.appendChild(moreText);
        legend.appendChild(more);
    }
    return legend;
}
/**
 * Highlight a single legend item by fading others.
 * Pass empty string or null to reset all to full opacity.
 */
export function highlightLegendItem(legendDiv, activeKey) {
    const items = legendDiv.querySelectorAll('[data-series]');
    items.forEach((el) => {
        const element = el;
        const isActive = !activeKey || element.getAttribute('data-series') === activeKey;
        element.style.opacity = isActive ? '1' : '0.3';
    });
}
// ─── PLACEHOLDER ─────────────────────────────────────────────────────────────
export function renderPlaceholder(container, spec) {
    const { svg, g, dims } = createSvg(container, spec);
    g.append('rect')
        .attr('x', dims.innerWidth / 2 - 160)
        .attr('y', dims.innerHeight / 2 - 50)
        .attr('width', 320)
        .attr('height', 100)
        .attr('rx', 8)
        .attr('fill', '#1e2028')
        .attr('stroke', '#2d3041')
        .attr('stroke-width', 1);
    g.append('text')
        .attr('x', dims.innerWidth / 2)
        .attr('y', dims.innerHeight / 2 - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_COLOR)
        .attr('font-size', '16px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(`Pattern: ${spec.pattern}`);
    g.append('text')
        .attr('x', dims.innerWidth / 2)
        .attr('y', dims.innerHeight / 2 + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '12px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(`${spec.data.length} rows, ${Object.keys(spec.data[0] || {}).length} columns`);
    g.append('text')
        .attr('x', dims.innerWidth / 2)
        .attr('y', dims.innerHeight / 2 + 34)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text('Renderer not yet implemented');
}
// ─── SORT CONTROLS ──────────────────────────────────────────────────────────
/**
 * Add minimal interactive sort controls to any categorical chart.
 * Positioned in the top-right corner, on the same line as the title.
 * Controls are hidden by default and appear on chart hover.
 *
 * @param svg - The D3 SVG selection
 * @param container - The DOM container (cleared + re-rendered on sort)
 * @param spec - The visualization spec (mutated with new sortBy/sortOrder)
 * @param dims - Chart dimensions
 * @param renderFn - The render function to call after sorting (e.g. renderBar, renderStackedBar)
 */
export function addSortControls(svg, container, spec, dims, renderFn) {
    const currentSortBy = spec.config.sortBy || 'value';
    const currentSortOrder = spec.config.sortOrder || 'descending';
    // Position in top-right corner, aligned with title
    const xPos = dims.width - dims.margin.right - 40;
    const yPos = 24;
    const controls = svg
        .append('g')
        .attr('class', 'sort-controls')
        .attr('transform', `translate(${xPos}, ${yPos})`)
        .style('opacity', 0)
        .style('cursor', 'pointer')
        .style('transition', 'opacity 0.2s')
        .style('user-select', 'none')
        .style('-webkit-user-select', 'none');
    controls
        .append('rect')
        .attr('x', -26)
        .attr('y', -10)
        .attr('width', 52)
        .attr('height', 20)
        .attr('rx', 4)
        .attr('fill', '#1e2028')
        .attr('stroke', '#2d3041')
        .attr('stroke-width', 1);
    controls
        .append('text')
        .attr('x', -8)
        .attr('y', 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('font-weight', '600')
        .attr('fill', TEXT_MUTED)
        .text(currentSortBy === 'category' ? 'ABC' : '123');
    controls
        .append('text')
        .attr('x', 14)
        .attr('y', 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', TEXT_MUTED)
        .text(currentSortOrder === 'descending' ? '▼' : '▲');
    svg
        .on('mouseenter', () => { controls.style('opacity', 1); })
        .on('mouseleave', () => { controls.style('opacity', 0); });
    controls.on('click', (event) => {
        event.stopPropagation();
        const curSortBy = spec.config.sortBy || 'value';
        const curSortOrder = spec.config.sortOrder || 'descending';
        let newSortBy;
        let newSortOrder;
        if (curSortBy === 'value' && curSortOrder === 'descending') {
            newSortBy = 'value';
            newSortOrder = 'ascending';
        }
        else if (curSortBy === 'value' && curSortOrder === 'ascending') {
            newSortBy = 'category';
            newSortOrder = 'ascending';
        }
        else if (curSortBy === 'category' && curSortOrder === 'ascending') {
            newSortBy = 'category';
            newSortOrder = 'descending';
        }
        else {
            newSortBy = 'value';
            newSortOrder = 'descending';
        }
        spec.config.sortBy = newSortBy;
        spec.config.sortOrder = newSortOrder;
        container.innerHTML = '';
        renderFn(container, spec);
    });
}
// ─── UTILITIES ───────────────────────────────────────────────────────────────
export function formatValue(v) {
    if (Math.abs(v) >= 1e12)
        return (v / 1e12).toFixed(1) + 'T';
    if (Math.abs(v) >= 1e9)
        return (v / 1e9).toFixed(1) + 'B';
    if (Math.abs(v) >= 1e6)
        return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3)
        return (v / 1e3).toFixed(1) + 'K';
    if (Math.abs(v) < 1 && v !== 0) {
        const precision = Math.max(2, Math.ceil(-Math.log10(Math.abs(v))) + 1);
        return v.toFixed(Math.min(precision, 6));
    }
    return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
}
//# sourceMappingURL=shared.js.map