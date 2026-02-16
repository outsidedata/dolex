/**
 * Metric D3 renderer — typographic KPI / big-number cards.
 *
 * Pure DOM/CSS layout (no SVG). Uses CSS Grid for multi-metric
 * arrangements, adaptive font sizes, and delta/trend indicators.
 */

import type { VisualizationSpec } from '../../../types.js';
import { DARK_BG, TEXT_COLOR, TEXT_MUTED, formatValue } from '../shared.js';

// ─── VALUE FORMATTING ────────────────────────────────────────────────────────

function formatMetricValue(
  value: number,
  format: string,
  abbreviate: boolean,
  prefix: string,
  suffix: string,
): string {
  let formatted: string;

  switch (format) {
    case 'currency':
      formatted = abbreviate ? formatValue(value) : value.toLocaleString();
      return `${prefix || '$'}${formatted}${suffix}`;
    case 'percent':
      formatted = abbreviate && Math.abs(value) >= 1000
        ? formatValue(value)
        : value.toFixed(1);
      return `${prefix}${formatted}%${suffix}`;
    case 'integer':
      formatted = abbreviate ? formatValue(value) : Math.round(value).toLocaleString();
      return `${prefix}${formatted}${suffix}`;
    case 'decimal':
      formatted = abbreviate && Math.abs(value) >= 1000
        ? formatValue(value)
        : value.toFixed(2);
      return `${prefix}${formatted}${suffix}`;
    default: // 'auto'
      if (abbreviate && Math.abs(value) >= 1000) {
        formatted = formatValue(value);
      } else if (Number.isInteger(value)) {
        formatted = value.toLocaleString();
      } else {
        formatted = value % 1 !== 0 ? value.toFixed(1) : value.toLocaleString();
      }
      return `${prefix}${formatted}${suffix}`;
  }
}

function computeDelta(current: number, previous: number): { pct: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: 'N/A', direction: 'flat' };
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.05) return { pct: '0%', direction: 'flat' };
  const direction = change > 0 ? 'up' : 'down';
  return { pct: `${Math.abs(change).toFixed(1)}%`, direction };
}

// ─── GRID COLUMNS ────────────────────────────────────────────────────────────

function gridColumns(count: number, configColumns: number | string | undefined): string {
  if (typeof configColumns === 'number' && configColumns > 0) {
    return `repeat(${configColumns}, 1fr)`;
  }
  // Auto: 1→1, 2→2, 3→3, 4→2x2, 5-6→3, 7-9→3, 10-12→4
  if (count === 1) return '1fr';
  if (count === 2) return 'repeat(2, 1fr)';
  if (count <= 3) return `repeat(${count}, 1fr)`;
  if (count === 4) return 'repeat(2, 1fr)';
  if (count <= 6) return 'repeat(3, 1fr)';
  if (count <= 9) return 'repeat(3, 1fr)';
  return 'repeat(4, 1fr)';
}


// ─── ADAPTIVE SIZING ────────────────────────────────────────────────────────

function adaptiveValueSize(count: number, containerWidth: number, containerHeight: number): number {
  // Base size from container area, then scale down by count
  const area = containerWidth * containerHeight;
  let base: number;
  if (area < 150000) base = 28;       // tiny
  else if (area < 300000) base = 36;   // small
  else if (area < 500000) base = 48;   // medium
  else base = 60;                       // large

  // Scale down for more metrics
  if (count <= 1) return base;
  if (count <= 2) return Math.round(base * 0.9);
  if (count <= 4) return Math.round(base * 0.75);
  if (count <= 6) return Math.round(base * 0.65);
  return Math.round(base * 0.55);
}

function adaptiveLabelSize(valueFontSize: number): number {
  return Math.max(10, Math.round(valueFontSize * 0.22));
}

// ─── RENDERER ────────────────────────────────────────────────────────────────

export function renderMetric(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, data } = spec;
  const labelField = config.labelField || 'label';
  const valueField = config.valueField || 'value';
  const previousValueField = config.previousValueField || null;
  const abbreviate = config.abbreviate !== false;
  const format = config.format || 'auto';
  const prefix = config.prefix || '';
  const suffix = config.suffix || '';
  const configColumns = config.columns;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;
  const count = data.length;
  const valueFontSize = adaptiveValueSize(count, width, height);
  const labelFontSize = adaptiveLabelSize(valueFontSize);

  // Outer wrapper
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    width: ${width}px;
    height: ${height}px;
    background: ${DARK_BG};
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    font-family: Inter, system-ui, sans-serif;
    overflow: hidden;
  `;

  // Title
  if (spec.title) {
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      text-align: center;
      color: ${TEXT_COLOR};
      font-size: 14px;
      font-weight: 600;
      padding: 16px 16px 0;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    titleEl.textContent = spec.title;
    titleEl.title = spec.title;
    wrapper.appendChild(titleEl);
  }

  // Grid container
  const grid = document.createElement('div');
  grid.style.cssText = `
    flex: 1;
    display: grid;
    grid-template-columns: ${gridColumns(count, configColumns)};
    gap: 8px;
    padding: 24px;
    align-items: center;
    justify-items: center;
  `;

  for (const row of data) {
    const label = String(row[labelField] ?? '');
    const rawValue = Number(row[valueField]);
    const value = isNaN(rawValue) ? 0 : rawValue;
    const hasPrev = previousValueField && row[previousValueField] != null;
    const prevValue = hasPrev ? Number(row[previousValueField]) : null;

    const card = document.createElement('div');
    card.style.cssText = `
      text-align: center;
      padding: 8px 12px;
      width: 100%;
      min-width: 0;
      overflow: hidden;
    `;

    // Big number — thin weight
    const numberEl = document.createElement('div');
    numberEl.style.cssText = `
      color: ${TEXT_COLOR};
      font-size: ${valueFontSize}px;
      font-weight: 300;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    `;
    numberEl.textContent = formatMetricValue(value, format, abbreviate, prefix, suffix);
    card.appendChild(numberEl);

    // Label — fat weight, underneath the value, tight
    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
      color: ${TEXT_MUTED};
      font-size: ${labelFontSize}px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    `;
    labelEl.textContent = label;
    if (label.length > 30) labelEl.title = label;
    card.appendChild(labelEl);

    // Delta indicator — centered below label, normal flow
    if (prevValue !== null && !isNaN(prevValue)) {
      const delta = computeDelta(value, prevValue);
      const deltaEl = document.createElement('div');
      const deltaColor =
        delta.direction === 'up' ? '#10b981'
        : delta.direction === 'down' ? '#ef4444'
        : TEXT_MUTED;
      const arrow =
        delta.direction === 'up' ? '▲'
        : delta.direction === 'down' ? '▼'
        : '▶';
      deltaEl.style.cssText = `
        color: ${deltaColor};
        font-size: ${Math.max(10, Math.round(valueFontSize * 0.2))}px;
        font-weight: 600;
        margin-top: 4px;
      `;
      deltaEl.textContent = `${arrow} ${delta.pct}`;
      card.appendChild(deltaEl);
    }

    grid.appendChild(card);
  }

  wrapper.appendChild(grid);
  container.appendChild(wrapper);
}
