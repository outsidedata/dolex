import type { VisualizationSpec } from '../../../types.js';
import {
  createTooltip,
  showTooltip,
  hideTooltip,
  formatValue,
  isAllZeros,
  TEXT_COLOR,
  TEXT_MUTED,
  DARK_BG,
  truncateLabel,
  styleAxis,
  getAdaptiveTickCount,
  truncateTitle,
  smartTruncateLabels,
} from '../shared.js';

declare const d3: any;

const POSITIVE_RAMP = ['#c6dbef', '#6baed6', '#2171b5', '#08306b'];
const NEGATIVE_RAMP = ['#fcbba1', '#fb6a4a', '#cb181d', '#67000d'];

export function renderHorizonChart(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  const timeField = config.timeField || encoding.x?.field;
  const valueField = config.valueField || encoding.y?.field;
  const seriesField = config.seriesField || encoding.color?.field || null;
  const numBands = Math.max(2, Math.min(4, config.bands ?? 3));
  const mode = config.mode ?? 'mirror';
  const rowGap = 2;

  const parsedData = data
    .map((d: any) => ({
      ...d,
      _date: parseDate(d[timeField]),
      _value: Number(d[valueField]),
    }))
    .filter((d: any) => d._date !== null && !isNaN(d._value));

  const seriesNames: string[] = seriesField
    ? ([...new Set(parsedData.map((d: any) => d[seriesField]))] as string[]).sort()
    : ['all'];

  const isSingleSeries = !seriesField || seriesNames.length <= 1;

  const labelWidth = isSingleSeries ? 16 : calculateLabelWidth(seriesNames);
  const topMargin = spec.title ? 36 : 12;
  const bottomMargin = 30;
  const rightMargin = 30;

  const W = container.clientWidth || 800;
  const H = container.clientHeight || 400;
  const chartW = W - labelWidth - rightMargin;
  const availH = H - topMargin - bottomMargin;
  const rowH = Math.max(10, (availH - (seriesNames.length - 1) * rowGap) / seriesNames.length);

  container.style.background = DARK_BG;
  container.style.borderRadius = '8px';
  container.style.overflow = 'hidden';

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .style('background', DARK_BG)
    .style('border-radius', '8px');

  if (spec.title) {
    const titleEl = svg.append('text')
      .attr('x', W / 2)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(spec.title);
    truncateTitle(titleEl, spec.title, W - 20);
  }

  const allDates = parsedData.map((d: any) => d._date as Date);
  const xExtent = d3.extent(allDates) as [Date, Date];
  const xScale = d3.scaleTime().domain(xExtent).range([0, chartW]);

  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (parsedData.every((d: any) => d._value === 0)) {
    svg.append('text')
      .attr('x', W / 2)
      .attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '14px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('All values are zero');
    return;
  }

  const uid = Math.random().toString(36).slice(2, 8);
  const posColors = pickBandColors(numBands, POSITIVE_RAMP);
  const negColors = pickBandColors(numBands, NEGATIVE_RAMP);

  const seriesDataMap = new Map<string, any[]>();
  seriesNames.forEach((name) => {
    const sd = isSingleSeries
      ? [...parsedData].sort((a: any, b: any) => a._date.getTime() - b._date.getTime())
      : parsedData
          .filter((d: any) => d[seriesField!] === name)
          .sort((a: any, b: any) => a._date.getTime() - b._date.getTime());
    seriesDataMap.set(name, sd);
  });

  const uniqueTimeValues = new Set(parsedData.map((d: any) => d._date.getTime()));
  const isSingleTimePoint = uniqueTimeValues.size <= 1;

  const smartLabels = smartTruncateLabels(seriesNames.map(String), 16);

  seriesNames.forEach((seriesName, idx) => {
    const yOff = topMargin + idx * (rowH + rowGap);
    const sd = seriesDataMap.get(seriesName)!;
    if (sd.length === 0) return;

    const values = sd.map((d: any) => d._value);
    const maxAbs = d3.max(values, (v: number) => Math.abs(v)) as number;
    if (maxAbs === 0) return;

    const rowG = svg.append('g')
      .attr('transform', `translate(${labelWidth}, ${yOff})`);

    rowG.append('rect')
      .attr('width', chartW)
      .attr('height', rowH)
      .attr('fill', '#0d1017');

    if (isSingleTimePoint) {
      const val = sd[0]._value;
      const color = val >= 0 ? posColors[posColors.length - 1] : negColors[negColors.length - 1];
      const barWidth = Math.min(chartW * 0.4, 60);

      rowG.append('rect')
        .attr('x', chartW / 2 - barWidth / 2)
        .attr('y', rowH * 0.15)
        .attr('width', barWidth)
        .attr('height', rowH * 0.7)
        .attr('fill', color)
        .attr('rx', 3)
        .style('pointer-events', 'none');

      rowG.append('text')
        .attr('x', chartW / 2)
        .attr('y', rowH / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#ffffff')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .style('pointer-events', 'none')
        .text(formatValue(val));
    } else {
      const bandSize = maxAbs / numBands;

      const clipId = `hz-clip-${uid}-${idx}`;
      rowG.append('defs').append('clipPath').attr('id', clipId)
        .append('rect').attr('width', chartW).attr('height', rowH);

      const bandG = rowG.append('g').attr('clip-path', `url(#${clipId})`);

      const yBand = d3.scaleLinear().domain([0, bandSize]).range([rowH, 0]);

      for (let b = 0; b < numBands; b++) {
        const bMin = b * bandSize;

        const posArea = d3.area()
          .x((d: any) => xScale(d._date))
          .y0(rowH)
          .y1((d: any) => {
            const v = d._value;
            if (v <= bMin) return rowH;
            return yBand(Math.min(v - bMin, bandSize));
          })
          .curve(d3.curveMonotoneX);

        bandG.append('path')
          .datum(sd)
          .attr('fill', posColors[b])
          .attr('d', posArea)
          .style('pointer-events', 'none');

        if (mode === 'mirror') {
          const negArea = d3.area()
            .x((d: any) => xScale(d._date))
            .y0(rowH)
            .y1((d: any) => {
              const v = -d._value;
              if (v <= bMin) return rowH;
              return yBand(Math.min(v - bMin, bandSize));
            })
            .curve(d3.curveMonotoneX);

          bandG.append('path')
            .datum(sd)
            .attr('fill', negColors[b])
            .attr('d', negArea)
            .style('pointer-events', 'none');
        } else {
          const offArea = d3.area()
            .x((d: any) => xScale(d._date))
            .y0(rowH)
            .y1((d: any) => {
              const v = d._value + maxAbs;
              if (v <= bMin) return rowH;
              return yBand(Math.min(v - bMin, bandSize));
            })
            .curve(d3.curveMonotoneX);

          bandG.append('path')
            .datum(sd)
            .attr('fill', posColors[b])
            .attr('d', offArea)
            .style('pointer-events', 'none');
        }
      }
    }

    if (!isSingleSeries) {
      svg.append('text')
        .attr('x', labelWidth - 8)
        .attr('y', yOff + rowH / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(smartLabels[idx]);
    }
  });

  const xAxisY = topMargin + seriesNames.length * (rowH + rowGap);
  const axisG = svg.append('g')
    .attr('transform', `translate(${labelWidth}, ${xAxisY})`);

  const tickCount = getAdaptiveTickCount(chartW);
  const xAxis = axisG.append('g')
    .attr('class', 'x-axis')
    .call(
      d3.axisBottom(xScale)
        .ticks(tickCount)
        .tickSize(0)
        .tickPadding(8)
    );
  styleAxis(xAxis);

  addCrosshairInteraction(
    svg, seriesNames, seriesDataMap, xScale, labelWidth, topMargin,
    rowH, rowGap, chartW, timeField, valueField,
    seriesField, tooltip, isSingleSeries
  );
}

function parseDate(v: any): Date | null {
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function calculateLabelWidth(seriesNames: string[]): number {
  const maxLen = Math.max(...seriesNames.map((s) => String(s).length));
  const estimated = Math.min(maxLen, 16) * 7 + 16;
  return Math.max(60, Math.min(160, estimated));
}

function pickBandColors(numBands: number, ramp: string[]): string[] {
  if (numBands <= ramp.length) {
    return ramp.slice(ramp.length - numBands);
  }
  const out: string[] = [];
  for (let i = 0; i < numBands; i++) {
    out.push(ramp[Math.round(i * (ramp.length - 1) / (numBands - 1))]);
  }
  return out;
}

function addCrosshairInteraction(
  svg: any,
  seriesNames: string[],
  seriesDataMap: Map<string, any[]>,
  xScale: any,
  labelWidth: number,
  topMargin: number,
  rowHeight: number,
  rowGap: number,
  chartW: number,
  timeField: string,
  valueField: string,
  seriesField: string | null,
  tooltip: HTMLDivElement,
  isSingleSeries: boolean,
): void {
  const totalRowsH = seriesNames.length * (rowHeight + rowGap);

  const crosshair = svg.append('line')
    .attr('y1', topMargin)
    .attr('y2', topMargin + totalRowsH)
    .attr('stroke', TEXT_MUTED)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')
    .attr('pointer-events', 'none')
    .attr('opacity', 0);

  const allDates: number[] = [];
  const dateSet = new Set<number>();
  seriesDataMap.forEach((sd) => {
    sd.forEach((d: any) => {
      const t = d._date.getTime();
      if (!dateSet.has(t)) {
        dateSet.add(t);
        allDates.push(t);
      }
    });
  });
  allDates.sort((a, b) => a - b);

  svg.append('rect')
    .attr('x', labelWidth)
    .attr('y', topMargin)
    .attr('width', chartW)
    .attr('height', totalRowsH)
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair')
    .on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event, this);
      const xDate = xScale.invert(mx).getTime();

      const bisect = d3.bisector((d: number) => d).left;
      let idx = bisect(allDates, xDate);
      if (idx > 0 && idx < allDates.length) {
        const d0 = allDates[idx - 1];
        const d1 = allDates[idx];
        idx = xDate - d0 > d1 - xDate ? idx : idx - 1;
      } else if (idx >= allDates.length) {
        idx = allDates.length - 1;
      }

      const nearestTime = allDates[idx];
      const nearestX = xScale(new Date(nearestTime)) + labelWidth;

      crosshair.attr('x1', nearestX).attr('x2', nearestX).attr('opacity', 1);

      const dateStr = new Date(nearestTime).toLocaleDateString();
      let html = `<strong>${dateStr}</strong>`;

      const entries: { name: string; value: number }[] = [];
      seriesNames.forEach((name) => {
        const sd = seriesDataMap.get(name)!;
        let closest: any = null;
        let minDiff = Infinity;
        for (const d of sd) {
          const diff = Math.abs(d._date.getTime() - nearestTime);
          if (diff < minDiff) {
            minDiff = diff;
            closest = d;
          }
        }
        if (closest) {
          entries.push({ name, value: closest._value });
        }
      });

      entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

      const maxShow = isSingleSeries ? 1 : 8;
      entries.slice(0, maxShow).forEach((entry) => {
        const color = entry.value >= 0 ? '#6baed6' : '#fb6a4a';
        if (isSingleSeries) {
          html += `<br/>${valueField}: ${formatValue(entry.value)}`;
        } else {
          html += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px;vertical-align:middle;"></span>${truncateLabel(entry.name, 20)}: ${formatValue(entry.value)}`;
        }
      });

      if (entries.length > maxShow) {
        html += `<br/><span style="color:${TEXT_MUTED};font-size:11px;">+${entries.length - maxShow} more</span>`;
      }

      showTooltip(tooltip, html, event);
    })
    .on('mouseout', function () {
      crosshair.attr('opacity', 0);
      hideTooltip(tooltip);
    });
}
