/**
 * Treemap D3 renderer — HTML div-based for proper text wrapping.
 *
 * Uses d3.treemap() for layout computation but renders with absolutely-
 * positioned divs instead of SVG rects, giving us natural CSS text wrapping.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  buildColorScale,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  contrastText,
  contrastTextMuted,
  isAllZeros,
  DARK_BG,
  TEXT_COLOR,
  TEXT_MUTED,
} from '../shared.js';

declare const d3: any;

export function renderTreemap(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const categoryField = config.categoryField || encoding.color?.field || encoding.label?.field;
  const valueField = config.valueField || encoding.size?.field;
  const parentField = config.parentField || null;
  const padding = config.padding ?? 2;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;
  const titleHeight = spec.title ? 36 : 0;
  const contentPadding = 8;
  const innerWidth = width - contentPadding * 2;
  const innerHeight = height - titleHeight - contentPadding * 2;

  // Root wrapper
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: relative;
    width: ${width}px;
    height: ${height}px;
    background: ${DARK_BG};
    border-radius: 8px;
    overflow: hidden;
    font-family: Inter, system-ui, sans-serif;
  `;
  container.appendChild(wrapper);

  // Title
  if (spec.title) {
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      text-align: center;
      color: ${TEXT_COLOR};
      font-size: 14px;
      font-weight: 600;
      line-height: ${titleHeight}px;
      height: ${titleHeight}px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 10px;
    `;
    titleEl.textContent = spec.title;
    titleEl.title = spec.title;
    wrapper.appendChild(titleEl);
  }

  // Treemap content area
  const contentArea = document.createElement('div');
  contentArea.style.cssText = `
    position: relative;
    width: ${innerWidth}px;
    height: ${innerHeight}px;
    margin: 0 ${contentPadding}px ${contentPadding}px;
  `;
  wrapper.appendChild(contentArea);

  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (valueField && isAllZeros(data, valueField)) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${innerWidth}px;
      height: ${innerHeight}px;
      color: ${TEXT_MUTED};
      font-size: 14px;
      font-family: Inter, system-ui, sans-serif;
    `;
    emptyDiv.textContent = 'All values are zero';
    contentArea.appendChild(emptyDiv);
    return;
  }

  // Build hierarchy
  const root = buildHierarchy(data, categoryField, valueField, parentField, config);

  // Apply treemap layout
  const treemapLayout = d3
    .treemap()
    .size([innerWidth, innerHeight])
    .padding(padding)
    .round(true);

  treemapLayout(root);

  const colorScale = buildColorScale(encoding.color, data);
  const isQuantitativeColor = encoding.color?.type === 'quantitative';
  const colorField = encoding.color?.field;

  // Draw leaf nodes as divs
  const leaves = root.leaves();

  for (const leaf of leaves) {
    const cellW = Math.max(leaf.x1 - leaf.x0, 0);
    const cellH = Math.max(leaf.y1 - leaf.y0, 0);
    if (cellW < 1 || cellH < 1) continue;

    // Quantitative color: pass numeric value directly to the scale
    // Categorical color: pass category name (or parent name for hierarchical)
    const fillColor = isQuantitativeColor
      ? colorScale(Number(leaf.data._data?.[colorField!] ?? leaf.value))
      : parentField && leaf.parent?.data?.name
        ? colorScale(leaf.parent.data.name)
        : colorScale(leaf.data.name);

    const cell = document.createElement('div');
    cell.style.cssText = `
      position: absolute;
      left: ${leaf.x0}px;
      top: ${leaf.y0}px;
      width: ${cellW}px;
      height: ${cellH}px;
      background: ${fillColor};
      border-radius: 3px;
      border: ${config.borderWidth ?? 1}px solid ${DARK_BG};
      opacity: 1;
      overflow: hidden;
      box-sizing: border-box;
      cursor: default;
    `;

    // Text content — only if cell is big enough
    if (cellW > 30 && cellH > 20) {
      const textPad = Math.min(6, cellW * 0.08);
      const labelColor = contrastText(fillColor);
      const valueColor = contrastTextMuted(fillColor);
      const textContainer = document.createElement('div');
      textContainer.style.cssText = `
        padding: ${textPad}px;
        overflow: hidden;
        height: 100%;
        box-sizing: border-box;
      `;

      // Label (bold, first) — truncate with ellipsis to avoid mid-word breaks
      if (config.showLabels !== false) {
        const fontSize = cellW > 80 ? 12 : 10;
        const charWidth = fontSize * 0.6;
        const maxChars = Math.max(2, Math.floor((cellW - textPad * 2) / charWidth));
        const rawName = leaf.data.name;
        const displayName = rawName.length > maxChars
          ? rawName.slice(0, maxChars - 1) + '\u2026'
          : rawName;
        const label = document.createElement('div');
        label.style.cssText = `
          color: ${labelColor};
          font-weight: 700;
          font-size: ${fontSize}px;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `;
        label.textContent = displayName;
        if (rawName.length > maxChars) label.title = rawName;
        textContainer.appendChild(label);
      }

      // Value (lighter, beneath)
      if (cellW > 40 && cellH > 36) {
        const value = document.createElement('div');
        value.style.cssText = `
          color: ${valueColor};
          font-weight: 400;
          font-size: ${cellW > 80 ? '11px' : '9px'};
          line-height: 1.3;
          margin-top: 2px;
        `;
        value.textContent = formatValue(leaf.value);
        textContainer.appendChild(value);
      }

      cell.appendChild(textContainer);
    }

    // Hover interactions
    cell.addEventListener('mouseover', (event: MouseEvent) => {
      cell.style.filter = 'brightness(1.15)';
      cell.style.outline = '2px solid #fff';
      cell.style.outlineOffset = '-2px';
      cell.style.zIndex = '10';
      const parentName = parentField && leaf.parent?.data?.name ? leaf.parent.data.name + ' > ' : '';
      showTooltip(
        tooltip,
        `<strong>${parentName}${leaf.data.name}</strong><br/>${valueField}: ${formatValue(leaf.value)}`,
        event
      );
    });

    cell.addEventListener('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    });

    cell.addEventListener('mouseout', () => {
      cell.style.filter = '';
      cell.style.outline = 'none';
      cell.style.zIndex = '';
      hideTooltip(tooltip);
    });

    contentArea.appendChild(cell);
  }
}

function buildHierarchy(
  data: Record<string, any>[],
  categoryField: string,
  valueField: string,
  parentField: string | null,
  config: VisualizationSpec['config']
): any {
  // Compute min-visible threshold: 2% of max ensures extreme-range items stay visible
  const allVals = data.map((d) => Number(d[valueField]) || 0).filter((v) => v > 0);
  const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
  const minVisible = maxVal * 0.02;
  const clampVal = (v: number) => (v > 0 && v < minVisible ? minVisible : v);

  if (parentField) {
    const childField = config.childField || categoryField;
    const parents = [...new Set(data.map((d) => d[parentField]))];
    const hierarchy = {
      name: 'root',
      children: parents.map((p) => ({
        name: p,
        children: data
          .filter((d) => d[parentField] === p)
          .map((d) => ({
            name: d[childField] || d[categoryField] || d[parentField],
            value: clampVal(Number(d[valueField]) || 0),
            _data: d,
          })),
      })),
    };
    return d3.hierarchy(hierarchy).sum((d: any) => d.value).sort((a: any, b: any) => b.value - a.value);
  }

  const hierarchy = {
    name: 'root',
    children: data.map((d) => ({
      name: d[categoryField],
      value: clampVal(Number(d[valueField]) || 0),
      _data: d,
    })),
  };
  return d3.hierarchy(hierarchy).sum((d: any) => d.value).sort((a: any, b: any) => b.value - a.value);
}
