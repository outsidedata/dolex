/**
 * Dolex Utilities — barrel export.
 */

export {
  measureText,
  truncateLabel,
  abbreviate,
  avoidCollisions,
  labelStrategy,
} from './labels.js';

export type {
  LabelPosition,
  ResolvedLabel,
  LabelStrategyMode,
  LabelStrategyResult,
} from './labels.js';

export {
  getContainerMode,
  responsiveMargins,
  responsiveFontSize,
  responsiveTicks,
} from './responsive.js';

export type {
  ContainerMode,
  ChartMargins,
} from './responsive.js';

export {
  svgToString,
  inlineStyles,
  downloadSvg,
  svgToPng,
} from './export.js';
