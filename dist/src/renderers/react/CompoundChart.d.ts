/**
 * React component for compound visualizations.
 *
 * Renders multiple views (chart + table) in a CSS grid layout
 * with linked interaction state.
 */
import React from 'react';
import type { CompoundVisualizationSpec, VisualizationSpec } from '../../types.js';
/** Dynamic import type for chart components */
type ChartComponent = React.ComponentType<{
    spec: VisualizationSpec;
    width?: number;
    height?: number;
    className?: string;
    onReady?: (container: HTMLDivElement) => void;
}>;
export interface CompoundChartProps {
    /** The compound visualization spec */
    spec: CompoundVisualizationSpec;
    /** Container width in pixels */
    width?: number;
    /** Container height in pixels */
    height?: number;
    /** Additional CSS class */
    className?: string;
    /** Map of pattern IDs to React chart components */
    chartComponents?: Record<string, ChartComponent>;
}
export declare function CompoundChart({ spec, width, height, className, chartComponents, }: CompoundChartProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=CompoundChart.d.ts.map