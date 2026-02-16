import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  TEXT_COLOR,
  TEXT_MUTED,
  AXIS_COLOR,
} from '../shared.js';

declare const d3: any;
declare const topojson: any;

function getInterpolator(scheme: string): any {
  const map: Record<string, any> = {
    blues: d3.interpolateBlues,
    greens: d3.interpolateGreens,
    reds: d3.interpolateReds,
    oranges: d3.interpolateOranges,
    purples: d3.interpolatePurples,
  };
  return map[scheme.toLowerCase()] || d3.interpolateBlues;
}

export function renderChoropleth(container: HTMLElement, spec: VisualizationSpec): void {
  const { config = {}, encoding, data } = spec;

  const geoField = config.geoField || (encoding.geo && encoding.geo.field);
  const valueField = config.valueField || (encoding.color && encoding.color.field);
  const projection = config.projection || 'naturalEarth1';
  const mapType: string = config.mapType || 'world';
  const colorScheme: string = config.colorScheme || 'blues';
  const objectName: string | undefined = config.objectName;
  const nameProperty: string = config.nameProperty || 'name';
  const customCenter: [number, number] | undefined = config.center;
  const customScale: number | undefined = config.scale;
  const parallels: [number, number] | undefined = config.parallels;
  const rotate: [number, number, number] | undefined = config.rotate;
  const topojsonData: any = config.topojsonData;

  if (!topojsonData) {
    container.innerHTML = '<div style="color:#ef4444;padding:20px">TopoJSON data must be embedded at spec-generation time. No CDN fetches.</div>';
    return;
  }

  const { svg, g, dims } = createSvg(container, spec, { top: 50, right: 20, bottom: 40, left: 20 });
  const tooltip = createTooltip(container);

  const valueLookup: Record<string, number> = {};
  data.forEach((d) => {
    const key = String(d[geoField]).toLowerCase().trim();
    valueLookup[key] = Number(d[valueField]);
  });

  const allValues = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
  const valExtent = d3.extent(allValues) as [number, number];

  const hasMixedSign = valExtent[0] < 0 && valExtent[1] > 0;
  const allNegative = valExtent[1] <= 0 && valExtent[0] < 0;
  let colorScale: any;

  if (hasMixedSign) {
    const maxAbs = Math.max(Math.abs(valExtent[0]), Math.abs(valExtent[1]));
    colorScale = d3.scaleDiverging(d3.interpolateRdBu).domain([maxAbs, 0, -maxAbs]);
  } else if (allNegative) {
    colorScale = d3.scaleSequential(d3.interpolateReds).domain([valExtent[0], valExtent[1]]);
  } else {
    const interpolator = getInterpolator(colorScheme);
    const rangeRatio = valExtent[0] > 0 ? valExtent[1] / valExtent[0] : valExtent[1] > 0 ? Infinity : 1;
    colorScale = rangeRatio > 100
      ? d3.scaleQuantize().domain(valExtent).range(
          d3.quantize(interpolator, 7)
        )
      : d3.scaleSequential(interpolator).domain(valExtent);
  }

  var features: any;
  if (objectName) {
    features = topojson.feature(topojsonData, topojsonData.objects[objectName]);
  } else {
    var objects = topojsonData.objects;
    var objKey: string;
    if (objects.countries) objKey = 'countries';
    else if (objects.states) objKey = 'states';
    else objKey = Object.keys(objects)[0];
    features = topojson.feature(topojsonData, objects[objKey]);
  }

  var geoProjection: any;
  if (projection === 'albersUsa') {
    geoProjection = d3.geoAlbersUsa().fitSize([dims.innerWidth, dims.innerHeight], features);
  } else {
    var projName = 'geo' + projection.charAt(0).toUpperCase() + projection.slice(1);
    var projFn = d3[projName] || d3.geoNaturalEarth1;
    geoProjection = projFn();
    if (rotate) geoProjection.rotate(rotate);
    if (parallels && typeof geoProjection.parallels === 'function') geoProjection.parallels(parallels);
    if (customScale) {
      if (customCenter) geoProjection.center(customCenter);
      geoProjection.scale(customScale);
      geoProjection.translate([dims.innerWidth / 2, dims.innerHeight / 2]);
    } else {
      geoProjection.fitSize([dims.innerWidth, dims.innerHeight], features);
    }
  }

  var path = d3.geoPath().projection(geoProjection);

  function lookupValue(feature: any): number | null {
    var props = feature.properties || {};
    var nameFields = [nameProperty, 'name', 'NAME', 'admin', 'ADMIN', 'geounit'];
    var name = '';
    for (var i = 0; i < nameFields.length; i++) {
      if (props[nameFields[i]]) { name = String(props[nameFields[i]]).toLowerCase().trim(); break; }
    }
    if (name && valueLookup[name] != null) return valueLookup[name];
    for (var key in valueLookup) {
      if (name && (name.indexOf(key) >= 0 || key.indexOf(name) >= 0)) {
        return valueLookup[key];
      }
    }
    return null;
  }

  g.selectAll('path.region')
    .data(features.features)
    .enter()
    .append('path')
    .attr('class', 'region')
    .attr('d', path)
    .attr('fill', function (d: any) {
      var val = lookupValue(d);
      return val != null ? colorScale(val) : '#1e2028';
    })
    .attr('stroke', '#2d3041')
    .attr('stroke-width', 0.5)
    .on('mouseover', function (event: MouseEvent, d: any) {
      var props = d.properties || {};
      var name = props[nameProperty] || props.name || props.NAME || props.admin || props.geounit || 'Unknown';
      var val = lookupValue(d);
      d3.select(this).attr('stroke', TEXT_COLOR).attr('stroke-width', 1.5);
      showTooltip(
        tooltip,
        '<strong>' + name + '</strong>' +
          (val != null
            ? '<br/>' + valueField + ': ' + formatValue(val)
            : '<br/><em>No data</em>'),
        event
      );
    })
    .on('mousemove', function (event: MouseEvent) {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', '#2d3041').attr('stroke-width', 0.5);
      hideTooltip(tooltip);
    });

  var legendWidth = Math.min(200, dims.innerWidth * 0.3);
  var legendHeight = 10;
  var legendX = dims.innerWidth - legendWidth - 10;
  var legendY = dims.innerHeight - 30;

  var legendScale = d3.scaleLinear().domain(valExtent).range([0, legendWidth]);
  var legendAxis = d3
    .axisBottom(legendScale)
    .ticks(4)
    .tickFormat(function (d: number) {
      return formatValue(d);
    });

  var gradientId = 'choropleth-gradient-' + Math.random().toString(36).slice(2, 8);
  var defs = svg.append('defs');
  var gradient = defs.append('linearGradient').attr('id', gradientId);
  gradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(valExtent[0]));
  gradient.append('stop').attr('offset', '50%').attr('stop-color', colorScale((valExtent[0] + valExtent[1]) / 2));
  gradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(valExtent[1]));

  var legendG = g.append('g').attr('transform', 'translate(' + legendX + ',' + legendY + ')');
  legendG
    .append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .attr('rx', 3)
    .style('fill', 'url(#' + gradientId + ')');
  legendG
    .append('g')
    .attr('transform', 'translate(0,' + legendHeight + ')')
    .call(legendAxis)
    .selectAll('text')
    .attr('fill', TEXT_MUTED)
    .attr('font-size', '9px')
    .attr('font-family', 'Inter, system-ui, sans-serif');
  legendG.selectAll('.domain, .tick line').attr('stroke', AXIS_COLOR);
}
