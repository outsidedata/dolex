/**
 * Calendar Heatmap D3 renderer.
 *
 * GitHub-style contribution graph. Grid of small rounded rectangles.
 * Automatically switches between horizontal (weeks → columns, days → rows)
 * and vertical (days → columns, weeks → rows) orientation based on
 * container aspect ratio to maximize cell size.
 */
import { createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, isAllZeros, DARK_BG, TEXT_COLOR, TEXT_MUTED, truncateTitle, } from '../shared.js';
import { sequential, diverging } from '../../../theme/colors.js';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EMPTY_COLOR = '#1b2028';
const EMPTY_STROKE = '#252d3a';
export function renderCalendarHeatmap(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.color?.field || encoding.y?.field;
    const showMonthLabels = config.showMonthLabels ?? true;
    const showDayLabels = config.showDayLabels ?? true;
    // ── Parse dates and build lookup ──
    const dateValueMap = new Map();
    let minDate = null;
    let maxDate = null;
    for (const row of data) {
        const dateStr = String(row[timeField]);
        const d = parseDate(dateStr);
        if (!d)
            continue;
        const key = formatDateKey(d);
        const val = Number(row[valueField]) || 0;
        dateValueMap.set(key, (dateValueMap.get(key) || 0) + val);
        if (!minDate || d < minDate)
            minDate = new Date(d);
        if (!maxDate || d > maxDate)
            maxDate = new Date(d);
    }
    if (!minDate || !maxDate) {
        container.innerHTML = '<p style="color:#ef4444;padding:20px;">No valid dates found</p>';
        return;
    }
    // Check if all values are zero
    if (isAllZeros(data, valueField)) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${TEXT_MUTED};font-size:14px;font-family:Inter,system-ui,sans-serif">All values are zero</div>`;
        return;
    }
    // ── Week boundaries ──
    const startSunday = new Date(minDate);
    startSunday.setDate(startSunday.getDate() - startSunday.getDay());
    const endSaturday = new Date(maxDate);
    endSaturday.setDate(endSaturday.getDate() + (6 - endSaturday.getDay()));
    const totalDays = Math.round((endSaturday.getTime() - startSunday.getTime()) / 86400000) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);
    // ── Container ──
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;
    const titleHeight = spec.title ? 40 : 0;
    const legendHeight = 36;
    const bottomPad = 8;
    const maxCellSize = 40;
    const preferredCellSize = config.cellSize ?? 14;
    const cellGapDefault = config.cellGap ?? 2;
    // ── Orientation decision ──
    const dayLabelWidth = showDayLabels ? 32 : 0;
    const monthLabelHeight = showMonthLabels ? 20 : 0;
    // Horizontal: weeks across, days down
    const hAvailW = containerWidth - dayLabelWidth - 24;
    const hAvailH = containerHeight - titleHeight - monthLabelHeight - legendHeight - bottomPad - 16;
    const hCellW = Math.max(2, Math.floor(hAvailW / totalWeeks) - cellGapDefault);
    const hCellH = Math.max(2, Math.floor(hAvailH / 7) - cellGapDefault);
    const hCellLimit = totalWeeks <= 12 ? maxCellSize : preferredCellSize;
    const hCell = Math.min(hCellLimit, hCellW, hCellH);
    // Vertical: days across, weeks down
    const vAvailW = containerWidth - 24;
    const vAvailH = containerHeight - titleHeight - legendHeight - bottomPad - 16;
    const vCellW = Math.max(2, Math.floor(vAvailW / 7) - cellGapDefault);
    const vCellH = Math.max(2, Math.floor(vAvailH / totalWeeks) - cellGapDefault);
    const vCellLimit = totalWeeks <= 12 ? maxCellSize : preferredCellSize;
    const vCell = Math.min(vCellLimit, vCellW, vCellH);
    const vertical = vCell > hCell && hCell < preferredCellSize;
    const cellSize = Math.max(2, vertical ? vCell : hCell);
    const cellGap = cellSize <= 4 ? 1 : cellGapDefault;
    const cellStep = cellSize + cellGap;
    // Grid dimensions
    const gridCols = vertical ? 7 : totalWeeks;
    const gridRows = vertical ? totalWeeks : 7;
    const gridWidth = gridCols * cellStep - cellGap;
    const gridHeight = gridRows * cellStep - cellGap;
    // Center the grid both horizontally and vertically
    const labelSpace = vertical ? 0 : dayLabelWidth;
    const totalGridArea = labelSpace + gridWidth;
    const gridOffsetX = Math.max(labelSpace, (containerWidth - totalGridArea) / 2 + labelSpace);
    const topLabelSpace = vertical ? (showDayLabels && cellSize >= 6 ? 18 : 0) : (showMonthLabels ? 18 : 0);
    // SVG fills the container minus legend
    const svgWidth = containerWidth;
    const svgHeight = containerHeight - legendHeight - bottomPad;
    // Vertical centering: total content height = title + label gap + grid
    const contentHeight = titleHeight + topLabelSpace + gridHeight;
    const gridOffsetY = Math.max(titleHeight + topLabelSpace + 4, (svgHeight - contentHeight) / 2 + titleHeight + topLabelSpace);
    const svg = d3
        .select(container)
        .append('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight);
    // ── Title ──
    if (spec.title) {
        const titleEl = svg
            .append('text')
            .attr('x', svgWidth / 2)
            .attr('y', 26)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_COLOR)
            .attr('font-size', '14px')
            .attr('font-weight', '600')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(spec.title);
        truncateTitle(titleEl, spec.title, svgWidth - 20);
    }
    const g = svg.append('g').attr('transform', `translate(${gridOffsetX},${gridOffsetY})`);
    // ── Color scale ──
    const colorEncoding = encoding.color;
    let colorScale;
    const allValues = Array.from(dateValueMap.values());
    const nonZeroValues = allValues.filter(v => v !== 0);
    const dataMin = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
    const dataMax = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 1;
    const hasMixedSign = dataMin < 0 && dataMax > 0;
    const allNegative = dataMax <= 0 && dataMin < 0;
    const paletteMap = {
        blue: sequential.blue,
        green: sequential.green,
        purple: sequential.purple,
        warm: sequential.warm,
    };
    const paletteName = colorEncoding?.palette || 'blue';
    if (hasMixedSign) {
        const maxAbs = Math.max(Math.abs(dataMin), Math.abs(dataMax));
        const divPalette = diverging.blueRed;
        colorScale = d3.scaleLinear()
            .domain([-maxAbs, -maxAbs * 0.5, 0, maxAbs * 0.5, maxAbs])
            .range([divPalette[0], divPalette[2], divPalette[4], divPalette[6], divPalette[8]])
            .clamp(true);
    }
    else if (allNegative) {
        const absMin = Math.abs(dataMax);
        const absMax = Math.abs(dataMin);
        const warmPalette = sequential.warm;
        colorScale = d3.scaleLinear()
            .domain([dataMin, dataMin * 0.5, dataMax])
            .range([warmPalette[1], warmPalette[3], warmPalette[7]])
            .clamp(true);
    }
    else {
        const maxValue = dataMax || 1;
        const rawPalette = paletteMap[paletteName];
        if (rawPalette) {
            colorScale = d3.scaleLinear()
                .domain([0, maxValue * 0.25, maxValue * 0.5, maxValue])
                .range([rawPalette[7], rawPalette[5], rawPalette[3], rawPalette[1]])
                .clamp(true);
        }
        else {
            colorScale = d3.scaleLinear()
                .domain([0, maxValue * 0.25, maxValue * 0.5, maxValue])
                .range(['#143893', '#2f63d9', '#6e9cf4', '#c5d9fc'])
                .clamp(true);
        }
    }
    const tooltip = createTooltip(container);
    // ── Build day data ──
    const dayData = [];
    const cursor = new Date(startSunday);
    for (let i = 0; i < totalDays; i++) {
        const key = formatDateKey(cursor);
        const weekCol = Math.floor(i / 7);
        const dayRow = cursor.getDay();
        const value = dateValueMap.get(key) || 0;
        dayData.push({ date: new Date(cursor), key, weekCol, dayRow, value });
        cursor.setDate(cursor.getDate() + 1);
    }
    // ── Month boundary data (for separators) ──
    const monthBoundaries = [];
    for (const dd of dayData) {
        if (dd.date.getDate() === 1 && dd.date >= minDate && dd.date <= maxDate) {
            monthBoundaries.push({ weekCol: dd.weekCol, dayRow: dd.dayRow });
        }
    }
    // ── Draw month separator lines ──
    if (showMonthLabels && cellSize >= 4 && !vertical) {
        for (const mb of monthBoundaries) {
            const pathParts = [];
            const x = mb.weekCol * cellStep - cellGap / 2;
            const yTop = mb.dayRow * cellStep - cellGap / 2;
            const yBottom = 7 * cellStep - cellGap / 2;
            // Vertical line from day row to bottom, horizontal jog at the top
            if (mb.dayRow > 0) {
                pathParts.push(`M ${x} ${yTop}`);
                pathParts.push(`L ${x} ${-cellGap / 2}`); // up to top
                // This is simplified - just draw a vertical line at the week boundary
                // with a step at the day-of-week where the month starts
            }
            // Simple vertical line
            g.append('line')
                .attr('x1', x)
                .attr('y1', mb.dayRow > 0 ? yTop : -cellGap / 2)
                .attr('x2', x)
                .attr('y2', yBottom)
                .attr('stroke', '#2a3344')
                .attr('stroke-width', 1)
                .attr('shape-rendering', 'crispEdges');
            // Horizontal jog from the month-start day to the left edge of the week column
            if (mb.dayRow > 0) {
                g.append('line')
                    .attr('x1', x)
                    .attr('y1', yTop)
                    .attr('x2', x + cellStep)
                    .attr('y2', yTop)
                    .attr('stroke', '#2a3344')
                    .attr('stroke-width', 1)
                    .attr('shape-rendering', 'crispEdges');
            }
        }
    }
    // ── Draw cells ──
    const cells = g.selectAll('.cal-cell')
        .data(dayData)
        .join('rect')
        .attr('class', 'cal-cell')
        .attr('x', (d) => (vertical ? d.dayRow : d.weekCol) * cellStep)
        .attr('y', (d) => (vertical ? d.weekCol : d.dayRow) * cellStep)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', cellSize >= 6 ? 2 : 1)
        .attr('fill', (d) => {
        if (d.date < minDate || d.date > maxDate)
            return 'transparent';
        return d.value !== 0 ? colorScale(d.value) : EMPTY_COLOR;
    })
        .attr('stroke', (d) => {
        if (d.date < minDate || d.date > maxDate)
            return 'transparent';
        return d.value !== 0 ? 'none' : EMPTY_STROKE;
    })
        .attr('stroke-width', 0.5)
        .style('cursor', (d) => (d.date >= minDate && d.date <= maxDate) ? 'pointer' : 'default');
    // ── Hover interactions ──
    cells
        .on('mouseover', function (event, d) {
        if (d.date < minDate || d.date > maxDate)
            return;
        d3.select(this)
            .attr('stroke', '#58a6ff')
            .attr('stroke-width', 1.5)
            .raise();
        const dateStr = d.date.toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        });
        showTooltip(tooltip, `<strong>${dateStr}</strong><br/>${valueField}: ${d.value !== 0 ? formatValue(d.value) : 'No data'}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function (_event, d) {
        if (d.date < minDate || d.date > maxDate)
            return;
        d3.select(this)
            .attr('stroke', d.value !== 0 ? 'none' : EMPTY_STROKE)
            .attr('stroke-width', 0.5);
        hideTooltip(tooltip);
    });
    // ── Labels ──
    if (vertical) {
        if (showDayLabels && cellSize >= 6) {
            drawDayLabelsTop(g, cellStep, cellSize);
        }
        if (showMonthLabels && cellSize >= 4) {
            drawMonthLabelsLeft(g, startSunday, totalWeeks, cellStep, minDate, maxDate);
        }
    }
    else {
        if (showMonthLabels) {
            drawMonthLabelsTop(g, startSunday, totalWeeks, cellStep, cellSize, minDate, maxDate);
        }
        if (showDayLabels && cellSize >= 6) {
            drawDayLabelsLeft(g, cellStep, cellSize);
        }
    }
    // ── HTML legend ──
    buildHtmlLegend(container, colorScale, dataMin, dataMax, hasMixedSign, allNegative, cellSize);
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseDate(v) {
    if (v instanceof Date)
        return isNaN(v.getTime()) ? null : v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
// ─── HORIZONTAL LABELS ───────────────────────────────────────────────────────
/** Month labels across the top (standard horizontal layout) */
function drawMonthLabelsTop(g, startSunday, totalWeeks, cellStep, cellSize, minDate, maxDate) {
    const months = getMonthBreaks(startSunday, totalWeeks, minDate, maxDate);
    // Filter out labels that would overlap (need at least ~30px between them)
    const minSpacing = 30;
    const filtered = [];
    let lastX = -Infinity;
    for (const m of months) {
        const x = m.weekCol * cellStep;
        if (x - lastX >= minSpacing) {
            filtered.push(m);
            lastX = x;
        }
    }
    g.selectAll('.month-label')
        .data(filtered)
        .join('text')
        .attr('class', 'month-label')
        .attr('x', (d) => d.weekCol * cellStep)
        .attr('y', -8)
        .attr('fill', TEXT_MUTED)
        .attr('font-size', cellSize >= 8 ? '10px' : '8px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => d.name);
}
/** Day labels down the left side (standard horizontal layout) */
function drawDayLabelsLeft(g, cellStep, cellSize) {
    const labelDays = [1, 3, 5]; // Mon, Wed, Fri
    g.selectAll('.day-label')
        .data(labelDays)
        .join('text')
        .attr('class', 'day-label')
        .attr('x', -6)
        .attr('y', (d) => d * cellStep + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', cellSize >= 10 ? '9px' : '7px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => cellSize >= 10 ? DAY_LABELS[d] : DAY_LABELS[d].charAt(0));
}
// ─── VERTICAL LABELS ─────────────────────────────────────────────────────────
/** Day labels across the top (vertical layout) */
function drawDayLabelsTop(g, cellStep, cellSize) {
    g.selectAll('.day-label')
        .data(DAY_LABELS.map((name, i) => ({ name, i })))
        .join('text')
        .attr('class', 'day-label')
        .attr('x', (d) => d.i * cellStep + cellSize / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', cellSize >= 10 ? '9px' : '7px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => cellSize >= 10 ? d.name : d.name.charAt(0));
}
/** Month labels down the left side (vertical layout) */
function drawMonthLabelsLeft(g, startSunday, totalWeeks, cellStep, minDate, maxDate) {
    const months = getMonthBreaks(startSunday, totalWeeks, minDate, maxDate);
    g.selectAll('.month-label')
        .data(months)
        .join('text')
        .attr('class', 'month-label')
        .attr('x', -8)
        .attr('y', (d) => d.weekCol * cellStep + cellStep / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '9px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => d.name);
}
// ─── SHARED LABEL HELPERS ────────────────────────────────────────────────────
function getMonthBreaks(startSunday, totalWeeks, minDate, maxDate) {
    const months = [];
    let lastMonth = -1;
    const cursor = new Date(startSunday);
    for (let week = 0; week < totalWeeks; week++) {
        const month = cursor.getMonth();
        if (month !== lastMonth) {
            // Skip months that are entirely before the data range
            const monthEnd = new Date(cursor.getFullYear(), month + 1, 0);
            const inRange = !minDate || !maxDate || (monthEnd >= minDate && cursor <= maxDate);
            if (inRange) {
                months.push({
                    name: MONTH_NAMES[month],
                    weekCol: week,
                });
            }
            lastMonth = month;
        }
        cursor.setDate(cursor.getDate() + 7);
    }
    return months;
}
// ─── HTML LEGEND ─────────────────────────────────────────────────────────────
function buildHtmlLegend(container, colorScale, dataMin, dataMax, hasMixedSign, allNegative, cellSize) {
    const legendDiv = document.createElement('div');
    legendDiv.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 10px 16px;
    font-family: Inter, system-ui, sans-serif;
    font-size: 11px;
    color: ${TEXT_MUTED};
    flex-shrink: 0;
  `;
    const steps = 5;
    const swatchSize = Math.max(10, Math.min(cellSize, 14));
    if (hasMixedSign) {
        const maxAbs = Math.max(Math.abs(dataMin), Math.abs(dataMax));
        const startLabel = document.createElement('span');
        startLabel.textContent = formatValue(-maxAbs);
        startLabel.style.marginRight = '2px';
        legendDiv.appendChild(startLabel);
        for (let i = 0; i < steps; i++) {
            const val = -maxAbs + (2 * maxAbs / (steps - 1)) * i;
            const swatch = document.createElement('span');
            swatch.style.cssText = `
        display: inline-block;
        width: ${swatchSize}px;
        height: ${swatchSize}px;
        border-radius: 2px;
        background: ${colorScale(val)};
      `;
            legendDiv.appendChild(swatch);
        }
        const endLabel = document.createElement('span');
        endLabel.textContent = formatValue(maxAbs);
        endLabel.style.marginLeft = '2px';
        legendDiv.appendChild(endLabel);
    }
    else {
        const rangeStart = allNegative ? dataMin : 0;
        const rangeEnd = allNegative ? dataMax : (dataMax || 1);
        const startLabel = document.createElement('span');
        startLabel.textContent = allNegative ? formatValue(rangeStart) : 'Less';
        startLabel.style.marginRight = '2px';
        legendDiv.appendChild(startLabel);
        for (let i = 0; i < steps; i++) {
            const swatch = document.createElement('span');
            const val = rangeStart + ((rangeEnd - rangeStart) / (steps - 1)) * i;
            const color = i === 0 && !allNegative ? EMPTY_COLOR : colorScale(val);
            swatch.style.cssText = `
        display: inline-block;
        width: ${swatchSize}px;
        height: ${swatchSize}px;
        border-radius: 2px;
        background: ${color};
        border: 1px solid ${i === 0 && !allNegative ? EMPTY_STROKE : 'transparent'};
      `;
            legendDiv.appendChild(swatch);
        }
        const endLabel = document.createElement('span');
        endLabel.textContent = allNegative ? formatValue(rangeEnd) : 'More';
        endLabel.style.marginLeft = '2px';
        legendDiv.appendChild(endLabel);
    }
    container.appendChild(legendDiv);
}
//# sourceMappingURL=calendar-heatmap.js.map