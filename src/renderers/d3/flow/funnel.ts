/**
 * Funnel chart D3 renderer.
 *
 * Renders symmetric trapezoid shapes showing progressive narrowing through
 * sequential stages. Stages are connected (no gaps) with rounded outer corners.
 * Labels and values on the right, conversion deltas on the left.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  buildColorScale,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  truncateLabel,
  contrastText,
  calculateLeftMargin,
  renderEmptyState,
  isAllZeros,
  TEXT_COLOR,
  TEXT_MUTED,
} from '../shared.js';

declare const d3: any;

interface FunnelStage {
  label: string;
  value: number;
  percentage: number;
  conversionFromPrev: number | null;
}

export function renderFunnel(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const categoryField = config.categoryField || encoding.y?.field || encoding.color?.field;
  const valueField = config.valueField || encoding.x?.field;
  const showConversionRates = config.showConversionRates !== false;
  const style: 'tapered' | 'stepped' = config.style || 'tapered';

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">No data provided</p>';
    return;
  }

  if (!categoryField || !valueField) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">Funnel requires categoryField and valueField</p>';
    return;
  }

  const MAX_STAGES = 12;
  let displayData = data;
  let truncated = false;
  if (data.length > MAX_STAGES) {
    displayData = data.slice(0, MAX_STAGES);
    truncated = true;
  }

  const stages: FunnelStage[] = displayData.map((d, i) => {
    const value = Number(d[valueField]) || 0;
    const prevValue = i > 0 ? (Number(displayData[i - 1][valueField]) || 0) : null;
    return {
      label: String(d[categoryField]),
      value,
      percentage: 0,
      conversionFromPrev: prevValue !== null && prevValue > 0 ? (value / prevValue) * 100 : null,
    };
  });

  const maxValue = d3.max(stages, (s: FunnelStage) => s.value) || 1;
  stages.forEach((s) => {
    s.percentage = (s.value / maxValue) * 100;
  });

  const colorScale = buildColorScale(encoding.color, data);

  const sideMargin = 140;

  const chartWrapper = document.createElement('div');
  chartWrapper.style.cssText = 'flex:1;min-height:0;';
  container.style.cssText += 'display:flex;flex-direction:column;';
  container.appendChild(chartWrapper);

  const { svg, g, dims } = createSvg(chartWrapper, spec, {
    top: 40,
    left: sideMargin,
    right: sideMargin,
    bottom: 20,
  });

  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (isAllZeros(data, valueField)) {
    renderEmptyState(g, dims);
    return;
  }

  const barHeight = Math.max(16, dims.innerHeight / stages.length);
  const totalHeight = barHeight * stages.length;

  // Extreme-range guard: clamp minimum stage width to 4px
  const MIN_STAGE_WIDTH = 4;
  const _widthScaleBase = d3.scaleLinear().domain([0, maxValue]).range([0, dims.innerWidth]);
  const widthScale = (v: number) => Math.max(
    _widthScaleBase(v),
    v > 0 ? MIN_STAGE_WIDTH : 0
  );

  const centerX = dims.innerWidth / 2;
  const isSmall = barHeight < 28;
  const labelFontSize = isSmall ? '10px' : '12px';
  const cornerRadius = 6;

  stages.forEach((stage, i) => {
    const yOffset = i * barHeight;

    g.append('rect')
      .attr('class', 'funnel-hover-target')
      .attr('x', -dims.margin.left)
      .attr('y', yOffset)
      .attr('width', dims.innerWidth + dims.margin.left + dims.margin.right)
      .attr('height', barHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: MouseEvent) {
        g.selectAll('.funnel-stage').attr('opacity', (_: any, j: number) => j === i ? 1 : 0.3);
        const html = buildTooltipHtml(stage, i, stages);
        showTooltip(tooltip, html, event);
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', function () {
        g.selectAll('.funnel-stage').attr('opacity', 1);
        hideTooltip(tooltip);
      });
  });

  if (stages.length === 1) {
    const stage = stages[0];
    const stageColor = colorScale(stage.label);
    const rectWidth = Math.min(dims.innerWidth * 0.6, widthScale(stage.value));
    const rectHeight = Math.min(barHeight, dims.innerHeight * 0.5);
    const yOffset = (dims.innerHeight - rectHeight) / 2;

    g.append('rect')
      .attr('class', 'funnel-stage')
      .attr('x', centerX - rectWidth / 2)
      .attr('y', yOffset)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('fill', stageColor)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)
      .attr('rx', cornerRadius)
      .attr('pointer-events', 'none');
  } else if (style === 'tapered') {
    const path = d3.path();
    const stageWidths = stages.map((s) => widthScale(s.value));

    stages.forEach((stage, i) => {
      const yTop = i * barHeight;
      const yBot = yTop + barHeight;
      const topHalf = stageWidths[i] / 2;
      const botHalf = i < stages.length - 1 ? stageWidths[i + 1] / 2 : topHalf * 0.3;
      const stageColor = colorScale(stage.label);
      const isFirst = i === 0;
      const isLast = i === stages.length - 1;
      const r = cornerRadius;

      const trapPath = d3.path();

      if (isFirst) {
        trapPath.moveTo(centerX - topHalf + r, yTop);
        trapPath.lineTo(centerX + topHalf - r, yTop);
        trapPath.quadraticCurveTo(centerX + topHalf, yTop, centerX + topHalf, yTop + r);
        trapPath.lineTo(centerX + botHalf, yBot);
        trapPath.lineTo(centerX - botHalf, yBot);
        trapPath.lineTo(centerX - topHalf, yTop + r);
        trapPath.quadraticCurveTo(centerX - topHalf, yTop, centerX - topHalf + r, yTop);
      } else if (isLast) {
        trapPath.moveTo(centerX - topHalf, yTop);
        trapPath.lineTo(centerX + topHalf, yTop);
        trapPath.lineTo(centerX + botHalf, yBot - r);
        trapPath.quadraticCurveTo(centerX + botHalf, yBot, centerX + botHalf - r, yBot);
        trapPath.lineTo(centerX - botHalf + r, yBot);
        trapPath.quadraticCurveTo(centerX - botHalf, yBot, centerX - botHalf, yBot - r);
        trapPath.lineTo(centerX - topHalf, yTop);
      } else {
        trapPath.moveTo(centerX - topHalf, yTop);
        trapPath.lineTo(centerX + topHalf, yTop);
        trapPath.lineTo(centerX + botHalf, yBot);
        trapPath.lineTo(centerX - botHalf, yBot);
        trapPath.closePath();
      }

      g.append('path')
        .attr('class', 'funnel-stage')
        .attr('d', trapPath.toString())
        .attr('fill', stageColor)
        .attr('stroke', '#1f2937')
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    });
  } else {
    stages.forEach((stage, i) => {
      const yOffset = i * barHeight;
      const currentWidth = widthScale(stage.value);
      const halfWidth = currentWidth / 2;
      const stageColor = colorScale(stage.label);

      g.append('rect')
        .attr('class', 'funnel-stage')
        .attr('x', centerX - halfWidth)
        .attr('y', yOffset)
        .attr('width', currentWidth)
        .attr('height', barHeight)
        .attr('fill', stageColor)
        .attr('stroke', '#1f2937')
        .attr('stroke-width', 1)
        .attr('rx', i === 0 || i === stages.length - 1 ? 3 : 0)
        .attr('pointer-events', 'none');
    });
  }

  const showValueInside = barHeight >= 32;

  stages.forEach((stage, i) => {
    const isSingleStage = stages.length === 1;
    const singleRectHeight = isSingleStage ? Math.min(barHeight, dims.innerHeight * 0.5) : barHeight;
    const yOffset = isSingleStage ? (dims.innerHeight - singleRectHeight) / 2 : i * barHeight;
    const labelY = yOffset + singleRectHeight / 2;
    const stageColor = colorScale(stage.label);
    const stageWidth = widthScale(stage.value);

    const valueText = formatValue(stage.value);
    const pctText = stage.percentage < 100 ? ` (${stage.percentage.toFixed(1)}%)` : '';

    g.append('text')
      .attr('x', dims.innerWidth + 14)
      .attr('y', labelY)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', labelFontSize)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-weight', '500')
      .attr('pointer-events', 'none')
      .text(truncateLabel(stage.label, 18));

    g.append('text')
      .attr('x', dims.innerWidth + 14)
      .attr('y', labelY + (isSmall ? 11 : 13))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', isSmall ? '9px' : '10px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .text(valueText + pctText);

    if (showValueInside && stageWidth > 60) {
      g.append('text')
        .attr('x', centerX)
        .attr('y', labelY)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('fill', contrastText(stageColor))
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(valueText);
    }

    if (truncated && i === stages.length - 1) {
      g.append('text')
        .attr('x', centerX)
        .attr('y', yOffset + singleRectHeight + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '10px')
        .attr('font-style', 'italic')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(`Showing ${stages.length} of ${data.length} stages`);
    }

    if (showConversionRates && stage.conversionFromPrev !== null && i > 0) {
      const borderY = yOffset;
      const deltaText = `${stage.conversionFromPrev.toFixed(1)}%`;
      const pillW = deltaText.length * 6.5 + 12;
      const pillH = 16;

      g.append('rect')
        .attr('x', centerX - pillW / 2)
        .attr('y', borderY - pillH / 2)
        .attr('width', pillW)
        .attr('height', pillH)
        .attr('rx', 4)
        .attr('fill', '#333')
        .attr('pointer-events', 'none');

      g.append('text')
        .attr('x', centerX)
        .attr('y', borderY)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_COLOR)
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(deltaText);
    }
  });
}

function buildTooltipHtml(stage: FunnelStage, index: number, stages: FunnelStage[]): string {
  let html = `<strong>${stage.label}</strong><br/>Value: ${formatValue(stage.value)}`;

  if (stage.percentage < 100) {
    html += `<br/>Of top: ${stage.percentage.toFixed(1)}%`;
  }

  if (stage.conversionFromPrev !== null) {
    html += `<br/>From prev: ${stage.conversionFromPrev.toFixed(1)}%`;
  }

  if (index === 0 && stages.length > 1) {
    const lastStage = stages[stages.length - 1];
    const overallConversion = stage.value > 0 ? (lastStage.value / stage.value) * 100 : 0;
    html += `<br/>Overall: ${overallConversion.toFixed(1)}% to end`;
  }

  return html;
}

function getConversionColor(rate: number): string {
  if (rate >= 80) return '#10b981';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}
