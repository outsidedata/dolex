/**
 * React component for the data table view in compound visualizations.
 *
 * Sortable, hoverable table with dark theme styling.
 * Participates in interaction linking via highlight/onHighlight props.
 */
import type { TableViewSpec } from '../../types.js';
export interface DataTableProps {
    /** The data rows to display */
    data: Record<string, any>[];
    /** Table configuration */
    tableSpec?: TableViewSpec;
    /** Container width */
    width?: number;
    /** Container height */
    height?: number;
    /** Additional CSS class */
    className?: string;
    /** Currently highlighted row (from interaction bus) */
    highlightRow?: Record<string, any> | null;
    /** Fields to match on for highlighting */
    highlightFields?: string[];
    /** Callback when user hovers a row */
    onHighlight?: (row: Record<string, any>) => void;
    /** Callback when user stops hovering */
    onClearHighlight?: () => void;
}
export declare function DataTable({ data, tableSpec, width, height, className, highlightRow, highlightFields, onHighlight, onClearHighlight, }: DataTableProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DataTable.d.ts.map