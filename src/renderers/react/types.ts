/**
 * Shared types for Dolex React components.
 */

import type { VisualizationSpec } from '../../types.js';

export interface ChartProps {
  /** The VisualizationSpec driving this chart */
  spec: VisualizationSpec;
  /** Container width in pixels (default: 800) */
  width?: number;
  /** Container height in pixels (default: 500) */
  height?: number;
  /** Additional CSS class name for the wrapper div */
  className?: string;
  /** Callback fired after D3 has rendered into the container */
  onReady?: (container: HTMLDivElement) => void;
}
