/**
 * Smart Label Utilities — the biggest differentiator.
 *
 * Every chart renderer benefits from intelligent label placement:
 * truncation, collision avoidance, abbreviation, and adaptive
 * strategies based on available space.
 */
/**
 * Approximate text width in pixels using character-count heuristics.
 * Works without a DOM (server-side safe). Uses average character widths
 * for common sans-serif fonts at the given size.
 *
 * @param text - The string to measure
 * @param fontSize - Font size in pixels (default 12)
 * @returns Approximate width in pixels
 */
export declare function measureText(text: string, fontSize?: number): number;
/**
 * Truncate a label to fit within a given pixel width.
 *
 * @param text - The label text
 * @param maxWidth - Maximum allowed width in pixels
 * @param fontSize - Font size in pixels (default 12)
 * @param ellipsis - Ellipsis string (default '…')
 * @returns Truncated text with ellipsis if needed
 */
export declare function truncateLabel(text: string, maxWidth: number, fontSize?: number, ellipsis?: string): string;
/**
 * Apply common abbreviation rules to shorten a label.
 *
 * @param text - The label text
 * @returns Abbreviated text
 */
export declare function abbreviate(text: string): string;
export interface LabelPosition {
    x: number;
    y: number;
    text: string;
    width?: number;
    height?: number;
}
export interface ResolvedLabel extends LabelPosition {
    originalY: number;
    hidden: boolean;
}
/**
 * Resolve label collisions by nudging overlapping labels apart vertically.
 *
 * Labels are sorted by y position, then any overlapping pair is spread
 * apart symmetrically. Labels that still can't fit are marked `hidden`.
 *
 * @param labels - Array of label positions
 * @param fontSize - Font size for height estimation (default 12)
 * @param padding - Minimum vertical gap between labels in pixels (default 2)
 * @param bounds - Optional vertical bounds { top, bottom }
 * @returns Resolved labels with adjusted y positions and hidden flags
 */
export declare function avoidCollisions(labels: LabelPosition[], fontSize?: number, padding?: number, bounds?: {
    top: number;
    bottom: number;
}): ResolvedLabel[];
export type LabelStrategyMode = 'full' | 'abbreviated' | 'truncated' | 'rotated' | 'hidden';
export interface LabelStrategyResult {
    mode: LabelStrategyMode;
    labels: string[];
    rotation?: number;
    fontSize: number;
}
/**
 * Determine the best labeling strategy given labels and available space.
 *
 * Tries strategies in order: full → abbreviated → truncated → rotated → hidden.
 * Returns the first strategy where all labels fit.
 *
 * @param labels - Array of label strings
 * @param availableWidth - Total available width in pixels
 * @param fontSize - Base font size (default 12)
 * @returns The recommended strategy with transformed labels
 */
export declare function labelStrategy(labels: string[], availableWidth: number, fontSize?: number): LabelStrategyResult;
//# sourceMappingURL=labels.d.ts.map