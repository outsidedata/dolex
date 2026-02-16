/**
 * Icicle Chart D3 renderer.
 *
 * Linear (rectangular) hierarchy chart using d3.partition().
 * Depth maps to position along one axis, size maps to extent along the other.
 * Supports horizontal (depth left-to-right) and vertical (depth top-to-bottom).
 */
import { buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, contrastText, isAllZeros, TEXT_COLOR, TEXT_MUTED, DARK_BG, truncateLabel, createLegend, } from '../shared.js';
export function renderIcicle(container, spec) {
    const { config, encoding, data } = spec;
    const levelFields = config.levelFields || [];
    const valueField = config.valueField || '';
    const orientation = config.orientation || 'horizontal';
    const showValues = config.showValues !== false;
    const isHorizontal = orientation === 'horizontal';
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const titleHeight = spec.title ? 36 : 0;
    const contentPad = 8;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    container.style.fontFamily = 'Inter, system-ui, sans-serif';
    if (spec.title) {
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
      text-align: center;
      color: ${TEXT_COLOR};
      font-size: 14px;
      font-weight: 600;
      line-height: 36px;
      height: 36px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 10px;
    `;
        titleDiv.textContent = spec.title;
        titleDiv.title = spec.title;
        container.appendChild(titleDiv);
    }
    // Check if all values are zero
    if (valueField && isAllZeros(data, valueField)) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: ${TEXT_MUTED};
      font-size: 14px;
    `;
        emptyDiv.textContent = 'All values are zero';
        container.appendChild(emptyDiv);
        return;
    }
    const root = buildHierarchyFromFields(data, levelFields, valueField);
    const totalValue = root.value || 1;
    const topLevelNames = root.children ? root.children.map((c) => c.data.name) : [];
    const colorScale = encoding.color
        ? buildColorScale(encoding.color, data)
        : d3.scaleOrdinal().domain(topLevelNames).range([
            '#6280c1', '#c99a3e', '#48a882', '#c46258', '#5ea4c8',
            '#9e74bf', '#c88450', '#3ea898', '#b85e78', '#85a63e',
            '#807cba', '#b09838',
        ]);
    const showLegend = topLevelNames.length > 1 && height > 200;
    const legendHeight = showLegend ? 28 : 0;
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `flex: 1; min-height: 0; position: relative;`;
    container.appendChild(chartWrapper);
    const chartWidth = width - contentPad * 2;
    const chartHeight = height - titleHeight - legendHeight - contentPad * 2;
    const svg = d3
        .select(chartWrapper)
        .append('svg')
        .attr('width', width)
        .attr('height', chartHeight + contentPad * 2);
    const g = svg.append('g')
        .attr('transform', `translate(${contentPad},${contentPad})`);
    const tooltip = createTooltip(container);
    const partPad = 1;
    if (isHorizontal) {
        d3.partition().size([chartHeight, chartWidth]).padding(partPad)(root);
    }
    else {
        d3.partition().size([chartWidth, chartHeight]).padding(partPad)(root);
    }
    const depthExtent = isHorizontal ? chartWidth : chartHeight;
    const rootY1 = root.y1;
    if (rootY1 > 0 && rootY1 < depthExtent) {
        const scale = depthExtent / (depthExtent - rootY1);
        for (const node of root.descendants()) {
            if (node.depth === 0)
                continue;
            node.y0 = (node.y0 - rootY1) * scale;
            node.y1 = (node.y1 - rootY1) * scale;
        }
    }
    const descendants = root.descendants().filter((d) => d.depth > 0);
    const rects = g
        .selectAll('.icicle-rect')
        .data(descendants)
        .join('rect')
        .attr('class', 'icicle-rect')
        .attr('x', (d) => isHorizontal ? d.y0 : d.x0)
        .attr('y', (d) => isHorizontal ? d.x0 : d.y0)
        .attr('width', (d) => {
        const w = isHorizontal ? d.y1 - d.y0 : d.x1 - d.x0;
        return Math.max(0, w);
    })
        .attr('height', (d) => {
        const h = isHorizontal ? d.x1 - d.x0 : d.y1 - d.y0;
        return Math.max(0, h);
    })
        .attr('fill', (d) => getNodeColor(d, colorScale))
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 0.5)
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        rects.attr('opacity', (n) => {
            if (n === d)
                return 1;
            if (isAncestor(n, d) || isAncestor(d, n))
                return 1;
            return 0.3;
        });
        d3.select(this)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2);
        const path = getAncestorPath(d);
        const pct = ((d.value / totalValue) * 100).toFixed(1);
        showTooltip(tooltip, `<strong>${path}</strong><br/>${valueField}: ${formatValue(d.value)}<br/>${pct}% of total`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        rects
            .attr('opacity', 1)
            .attr('stroke', DARK_BG)
            .attr('stroke-width', 0.5);
        hideTooltip(tooltip);
    })
        .on('click', function (_event, d) {
        zoomTo(d);
    });
    const labels = g
        .selectAll('.icicle-label')
        .data(descendants)
        .join('text')
        .attr('class', 'icicle-label')
        .attr('pointer-events', 'none')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('dominant-baseline', 'central')
        .each(function (d) {
        positionLabel(d3.select(this), d, isHorizontal, colorScale, showValues, valueField);
    });
    let currentRoot = root;
    function zoomTo(target) {
        if (target === currentRoot && target.parent) {
            target = target.parent.depth === 0 ? root : target.parent;
        }
        currentRoot = target;
        const x0 = isHorizontal ? target.y0 : target.x0;
        const x1 = isHorizontal ? target.y1 : target.x1;
        const y0 = isHorizontal ? target.x0 : target.y0;
        const y1 = isHorizontal ? target.x1 : target.y1;
        const xScale = d3.scaleLinear().domain([x0, x1]).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain([y0, y1]).range([0, chartHeight]);
        rects
            .transition()
            .duration(500)
            .attr('x', (d) => {
            const v = isHorizontal ? d.y0 : d.x0;
            return xScale(v);
        })
            .attr('y', (d) => {
            const v = isHorizontal ? d.x0 : d.y0;
            return yScale(v);
        })
            .attr('width', (d) => {
            const v0 = isHorizontal ? d.y0 : d.x0;
            const v1 = isHorizontal ? d.y1 : d.x1;
            return Math.max(0, xScale(v1) - xScale(v0));
        })
            .attr('height', (d) => {
            const v0 = isHorizontal ? d.x0 : d.y0;
            const v1 = isHorizontal ? d.x1 : d.y1;
            return Math.max(0, yScale(v1) - yScale(v0));
        })
            .attr('opacity', (d) => {
            if (!isDescendantOrSelf(d, target))
                return 0;
            return 1;
        });
        labels
            .transition()
            .duration(500)
            .attr('opacity', 0)
            .on('end', function (d) {
            const el = d3.select(this);
            if (!isDescendantOrSelf(d, target)) {
                el.attr('visibility', 'hidden');
                return;
            }
            const rectW = isHorizontal
                ? xScale(d.y1) - xScale(d.y0)
                : xScale(d.x1) - xScale(d.x0);
            const rectH = isHorizontal
                ? yScale(d.x1) - yScale(d.x0)
                : yScale(d.y1) - yScale(d.y0);
            const px = isHorizontal ? xScale(d.y0) : xScale(d.x0);
            const py = isHorizontal ? yScale(d.x0) : yScale(d.y0);
            positionLabelAt(el, d, px, py, rectW, rectH, isHorizontal, colorScale, showValues, valueField);
            el.transition().duration(200).attr('opacity', 1);
        });
    }
    if (showLegend) {
        const legendDiv = createLegend(colorScale);
        container.appendChild(legendDiv);
    }
}
function positionLabelAt(el, d, px, py, rectW, rectH, isHorizontal, colorScale, showValues, valueField) {
    const textPadding = 6;
    const availW = rectW - textPadding * 2;
    const availH = rectH - textPadding * 2;
    if (availW < 20 || availH < 14) {
        el.attr('visibility', 'hidden');
        return;
    }
    el.attr('visibility', 'visible');
    const fillColor = getNodeColor(d, colorScale);
    const textColor = contrastText(fillColor);
    const fontSize = Math.max(9, Math.min(12, availH * 0.35, availW * 0.08));
    if (isHorizontal) {
        el.attr('x', px + textPadding)
            .attr('y', py + rectH / 2)
            .attr('text-anchor', 'start');
    }
    else {
        el.attr('x', px + rectW / 2)
            .attr('y', py + rectH / 2)
            .attr('text-anchor', 'middle');
    }
    el.attr('fill', textColor)
        .attr('font-size', fontSize + 'px')
        .attr('font-weight', '600');
    const name = String(d.data.name);
    const maxChars = Math.max(3, Math.floor(availW / (fontSize * 0.6)));
    if (showValues && availW > 60 && availH > 22) {
        const valStr = formatValue(d.value);
        const combinedMax = Math.max(3, Math.floor(availW / (fontSize * 0.6)) - valStr.length - 3);
        el.text(truncateLabel(name, combinedMax) + '  ' + valStr);
    }
    else {
        el.text(truncateLabel(name, maxChars));
    }
}
function positionLabel(el, d, isHorizontal, colorScale, showValues, valueField) {
    const rectW = isHorizontal ? d.y1 - d.y0 : d.x1 - d.x0;
    const rectH = isHorizontal ? d.x1 - d.x0 : d.y1 - d.y0;
    const px = isHorizontal ? d.y0 : d.x0;
    const py = isHorizontal ? d.x0 : d.y0;
    positionLabelAt(el, d, px, py, rectW, rectH, isHorizontal, colorScale, showValues, valueField);
}
function buildHierarchyFromFields(data, levelFields, valueField) {
    if (!levelFields.length) {
        return d3.hierarchy({ name: 'root', children: [] }).sum((d) => d.value || 0);
    }
    // Compute min-visible threshold: 2% of max ensures extreme-range items stay visible
    const allVals = data.map((d) => Number(d[valueField]) || 0).filter((v) => v > 0);
    const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
    const minVisible = maxVal * 0.02;
    const clampVal = (v) => (v > 0 && v < minVisible ? minVisible : v);
    if (levelFields.length === 1) {
        const field = levelFields[0];
        const hierarchy = {
            name: 'root',
            children: data.map((d) => ({
                name: String(d[field] ?? 'Unknown'),
                value: clampVal(Math.max(0, Number(d[valueField]) || 0)),
                _data: d,
            })),
        };
        return d3.hierarchy(hierarchy)
            .sum((d) => d.value)
            .sort((a, b) => b.value - a.value);
    }
    function buildLevel(items, depth) {
        if (depth >= levelFields.length) {
            return items.map((d) => ({
                name: String(d[levelFields[levelFields.length - 1]] ?? 'Unknown'),
                value: clampVal(Math.max(0, Number(d[valueField]) || 0)),
                _data: d,
            }));
        }
        const field = levelFields[depth];
        const groups = new Map();
        for (const item of items) {
            const key = String(item[field] ?? 'Unknown');
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key).push(item);
        }
        if (depth === levelFields.length - 1) {
            return items.map((d) => ({
                name: String(d[field] ?? 'Unknown'),
                value: clampVal(Math.max(0, Number(d[valueField]) || 0)),
                _data: d,
            }));
        }
        const children = [];
        for (const [key, groupItems] of groups) {
            children.push({
                name: key,
                children: buildLevel(groupItems, depth + 1),
            });
        }
        return children;
    }
    const hierarchy = {
        name: 'root',
        children: buildLevel(data, 0),
    };
    return d3.hierarchy(hierarchy)
        .sum((d) => d.value)
        .sort((a, b) => b.value - a.value);
}
function getTopAncestor(d) {
    let node = d;
    while (node.parent && node.parent.parent) {
        node = node.parent;
    }
    return node;
}
function getNodeColor(d, colorScale) {
    const ancestor = getTopAncestor(d);
    const baseColor = colorScale(ancestor.data.name);
    if (d.depth > 1) {
        const lightenFactor = Math.min(d.depth * 0.1, 0.35);
        return d3.interpolateRgb(baseColor, '#ffffff')(lightenFactor);
    }
    return baseColor;
}
function getAncestorPath(d) {
    const parts = [];
    let node = d;
    while (node && node.depth > 0) {
        parts.unshift(node.data.name);
        node = node.parent;
    }
    return parts.join(' \u203A ');
}
function isAncestor(candidate, node) {
    let current = node.parent;
    while (current) {
        if (current === candidate)
            return true;
        current = current.parent;
    }
    return false;
}
function isDescendantOrSelf(node, ancestor) {
    if (node === ancestor)
        return true;
    let current = node.parent;
    while (current) {
        if (current === ancestor)
            return true;
        current = current.parent;
    }
    return false;
}
//# sourceMappingURL=icicle.js.map