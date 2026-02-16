/**
 * Smart Label Utilities — the biggest differentiator.
 *
 * Every chart renderer benefits from intelligent label placement:
 * truncation, collision avoidance, abbreviation, and adaptive
 * strategies based on available space.
 */

// ─── TEXT MEASUREMENT ────────────────────────────────────────────────────────

/**
 * Approximate text width in pixels using character-count heuristics.
 * Works without a DOM (server-side safe). Uses average character widths
 * for common sans-serif fonts at the given size.
 *
 * @param text - The string to measure
 * @param fontSize - Font size in pixels (default 12)
 * @returns Approximate width in pixels
 */
export function measureText(text: string, fontSize = 12): number {
  // Average character width ratios for sans-serif (Inter-like) at 1px font-size
  // Narrow chars: i, l, 1, :, . ~0.3
  // Wide chars: m, w, M, W ~0.7
  // Average: ~0.52
  const narrow = /[il1:.,;!|']/g;
  const wide = /[mwMWGOQD@]/g;
  const narrowCount = (text.match(narrow) || []).length;
  const wideCount = (text.match(wide) || []).length;
  const normalCount = text.length - narrowCount - wideCount;

  const avgWidth = (narrowCount * 0.33 + normalCount * 0.52 + wideCount * 0.72) * fontSize;
  return Math.ceil(avgWidth);
}

// ─── TRUNCATION ──────────────────────────────────────────────────────────────

/**
 * Truncate a label to fit within a given pixel width.
 *
 * @param text - The label text
 * @param maxWidth - Maximum allowed width in pixels
 * @param fontSize - Font size in pixels (default 12)
 * @param ellipsis - Ellipsis string (default '…')
 * @returns Truncated text with ellipsis if needed
 */
export function truncateLabel(
  text: string,
  maxWidth: number,
  fontSize = 12,
  ellipsis = '…'
): string {
  if (measureText(text, fontSize) <= maxWidth) return text;

  const ellipsisWidth = measureText(ellipsis, fontSize);
  const targetWidth = maxWidth - ellipsisWidth;
  if (targetWidth <= 0) return ellipsis;

  // Binary search for the right truncation point
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureText(text.slice(0, mid), fontSize) <= targetWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, lo) + ellipsis;
}

// ─── ABBREVIATION ────────────────────────────────────────────────────────────

/** Common abbreviation rules for chart labels */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bJanuary\b/gi, 'Jan'],
  [/\bFebruary\b/gi, 'Feb'],
  [/\bMarch\b/gi, 'Mar'],
  [/\bApril\b/gi, 'Apr'],
  [/\bJune\b/gi, 'Jun'],
  [/\bJuly\b/gi, 'Jul'],
  [/\bAugust\b/gi, 'Aug'],
  [/\bSeptember\b/gi, 'Sep'],
  [/\bOctober\b/gi, 'Oct'],
  [/\bNovember\b/gi, 'Nov'],
  [/\bDecember\b/gi, 'Dec'],
  [/\bQuarter\b/gi, 'Q'],
  [/\bDepartment\b/gi, 'Dept'],
  [/\bManagement\b/gi, 'Mgmt'],
  [/\bInternational\b/gi, "Int'l"],
  [/\bManufacturing\b/gi, 'Mfg'],
  [/\bEngineering\b/gi, 'Eng'],
  [/\bTechnology\b/gi, 'Tech'],
  [/\bDevelopment\b/gi, 'Dev'],
  [/\bUnited States\b/gi, 'US'],
  [/\bUnited Kingdom\b/gi, 'UK'],
  [/\bMillions?\b/gi, 'M'],
  [/\bBillions?\b/gi, 'B'],
  [/\bThousands?\b/gi, 'K'],
];

/**
 * Apply common abbreviation rules to shorten a label.
 *
 * @param text - The label text
 * @returns Abbreviated text
 */
export function abbreviate(text: string): string {
  let result = text;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ─── COLLISION AVOIDANCE ─────────────────────────────────────────────────────

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
export function avoidCollisions(
  labels: LabelPosition[],
  fontSize = 12,
  padding = 2,
  bounds?: { top: number; bottom: number }
): ResolvedLabel[] {
  const labelHeight = fontSize * 1.2;
  const minGap = labelHeight + padding;

  // Create resolved copies sorted by y
  const resolved: ResolvedLabel[] = labels
    .map((l) => ({
      ...l,
      width: l.width ?? measureText(l.text, fontSize),
      height: l.height ?? labelHeight,
      originalY: l.y,
      hidden: false,
    }))
    .sort((a, b) => a.y - b.y);

  // Push overlapping labels apart
  for (let pass = 0; pass < 5; pass++) {
    let moved = false;
    for (let i = 1; i < resolved.length; i++) {
      const prev = resolved[i - 1];
      const curr = resolved[i];
      if (prev.hidden || curr.hidden) continue;

      const overlap = prev.y + minGap - curr.y;
      if (overlap > 0) {
        const shift = overlap / 2;
        prev.y -= shift;
        curr.y += shift;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Clamp to bounds and hide if out of range
  if (bounds) {
    for (const label of resolved) {
      if (label.y < bounds.top || label.y > bounds.bottom) {
        label.hidden = true;
      }
      label.y = Math.max(bounds.top, Math.min(bounds.bottom, label.y));
    }
  }

  return resolved;
}

// ─── LABEL STRATEGY ──────────────────────────────────────────────────────────

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
export function labelStrategy(
  labels: string[],
  availableWidth: number,
  fontSize = 12
): LabelStrategyResult {
  const perLabel = availableWidth / Math.max(labels.length, 1);

  // Strategy 1: Full labels fit
  const maxFullWidth = Math.max(...labels.map((l) => measureText(l, fontSize)));
  if (maxFullWidth <= perLabel) {
    return { mode: 'full', labels, fontSize };
  }

  // Strategy 2: Abbreviated labels
  const abbreviated = labels.map(abbreviate);
  const maxAbbrWidth = Math.max(...abbreviated.map((l) => measureText(l, fontSize)));
  if (maxAbbrWidth <= perLabel) {
    return { mode: 'abbreviated', labels: abbreviated, fontSize };
  }

  // Strategy 3: Truncated labels
  const truncated = labels.map((l) => truncateLabel(l, perLabel, fontSize));
  const maxTruncWidth = Math.max(...truncated.map((l) => measureText(l, fontSize)));
  if (maxTruncWidth <= perLabel) {
    return { mode: 'truncated', labels: truncated, fontSize };
  }

  // Strategy 4: Rotated at 45° (effective width = height ≈ fontSize)
  // At 45° rotation, the effective horizontal footprint is roughly fontSize * 1.2
  const rotatedFootprint = fontSize * 1.2;
  if (rotatedFootprint <= perLabel) {
    return { mode: 'rotated', labels: abbreviated, rotation: -45, fontSize };
  }

  // Strategy 5: Smaller font + rotation
  const smallFontSize = Math.max(9, fontSize - 2);
  const smallRotatedFootprint = smallFontSize * 1.2;
  if (smallRotatedFootprint <= perLabel) {
    return {
      mode: 'rotated',
      labels: labels.map((l) => truncateLabel(l, perLabel * 2, smallFontSize)),
      rotation: -45,
      fontSize: smallFontSize,
    };
  }

  // Strategy 6: Hide labels (too many to show)
  return { mode: 'hidden', labels: [], fontSize };
}
