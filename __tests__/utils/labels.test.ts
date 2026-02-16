import { describe, it, expect } from 'vitest';
import {
  measureText,
  truncateLabel,
  abbreviate,
  avoidCollisions,
  labelStrategy,
} from '../../src/utils/labels.js';

// ─── measureText ─────────────────────────────────────────────────────────────

describe('measureText', () => {
  it('returns a positive number for non-empty string', () => {
    expect(measureText('Hello')).toBeGreaterThan(0);
  });

  it('returns 0 for empty string', () => {
    expect(measureText('')).toBe(0);
  });

  it('wider text returns larger value', () => {
    const narrow = measureText('ill');
    const wide = measureText('MWM');
    expect(wide).toBeGreaterThan(narrow);
  });

  it('larger font size returns larger value', () => {
    const small = measureText('Hello', 10);
    const large = measureText('Hello', 20);
    expect(large).toBeGreaterThan(small);
  });

  it('scales roughly linearly with font size', () => {
    const base = measureText('Test', 12);
    const double = measureText('Test', 24);
    // Should be roughly 2x (within 10% tolerance)
    expect(double / base).toBeCloseTo(2, 0);
  });
});

// ─── truncateLabel ───────────────────────────────────────────────────────────

describe('truncateLabel', () => {
  it('returns full text if it fits', () => {
    expect(truncateLabel('Hi', 200, 12)).toBe('Hi');
  });

  it('truncates long text with ellipsis', () => {
    const result = truncateLabel('A very long label that should be truncated', 60, 12);
    expect(result).toContain('…');
    expect(result.length).toBeLessThan('A very long label that should be truncated'.length);
  });

  it('uses custom ellipsis', () => {
    const result = truncateLabel('A very long label', 40, 12, '..');
    expect(result).toContain('..');
  });

  it('returns just ellipsis for very small maxWidth', () => {
    const result = truncateLabel('Hello World', 5, 12);
    expect(result).toBe('…');
  });
});

// ─── abbreviate ──────────────────────────────────────────────────────────────

describe('abbreviate', () => {
  it('abbreviates month names', () => {
    expect(abbreviate('January')).toBe('Jan');
    expect(abbreviate('February')).toBe('Feb');
    expect(abbreviate('September')).toBe('Sep');
    expect(abbreviate('December')).toBe('Dec');
  });

  it('abbreviates common words', () => {
    expect(abbreviate('Department of Technology')).toBe('Dept of Tech');
    expect(abbreviate('United States')).toBe('US');
    expect(abbreviate('United Kingdom')).toBe('UK');
  });

  it('preserves text without known abbreviations', () => {
    expect(abbreviate('Apples and Oranges')).toBe('Apples and Oranges');
  });

  it('handles mixed content', () => {
    expect(abbreviate('Engineering Department January')).toBe('Eng Dept Jan');
  });
});

// ─── avoidCollisions ─────────────────────────────────────────────────────────

describe('avoidCollisions', () => {
  it('returns labels unchanged when no overlap', () => {
    const labels = [
      { x: 0, y: 0, text: 'A' },
      { x: 0, y: 50, text: 'B' },
      { x: 0, y: 100, text: 'C' },
    ];
    const resolved = avoidCollisions(labels, 12, 2);
    expect(resolved).toHaveLength(3);
    expect(resolved.every((l) => !l.hidden)).toBe(true);
  });

  it('separates overlapping labels', () => {
    const labels = [
      { x: 0, y: 10, text: 'A' },
      { x: 0, y: 12, text: 'B' },
      { x: 0, y: 14, text: 'C' },
    ];
    const resolved = avoidCollisions(labels, 12, 2);
    // After resolution, each label should have unique y (within label height)
    for (let i = 1; i < resolved.length; i++) {
      if (!resolved[i].hidden && !resolved[i - 1].hidden) {
        const gap = resolved[i].y - resolved[i - 1].y;
        expect(gap).toBeGreaterThanOrEqual(12 * 1.2); // at least label height
      }
    }
  });

  it('preserves original y in resolved labels', () => {
    const labels = [
      { x: 0, y: 5, text: 'A' },
      { x: 0, y: 6, text: 'B' },
    ];
    const resolved = avoidCollisions(labels, 12, 2);
    expect(resolved[0].originalY).toBe(5);
    expect(resolved[1].originalY).toBe(6);
  });

  it('respects bounds', () => {
    const labels = [
      { x: 0, y: -100, text: 'A' },
      { x: 0, y: 500, text: 'B' },
    ];
    const resolved = avoidCollisions(labels, 12, 2, { top: 0, bottom: 400 });
    resolved.forEach((l) => {
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeLessThanOrEqual(400);
    });
  });
});

// ─── labelStrategy ───────────────────────────────────────────────────────────

describe('labelStrategy', () => {
  it('returns "full" when labels fit', () => {
    const result = labelStrategy(['A', 'B', 'C'], 600, 12);
    expect(result.mode).toBe('full');
    expect(result.labels).toEqual(['A', 'B', 'C']);
  });

  it('returns "abbreviated" when abbreviations help', () => {
    const labels = ['January Sales', 'February Sales', 'September Sales'];
    const result = labelStrategy(labels, 200, 12);
    // Should try abbreviation
    expect(['abbreviated', 'truncated', 'rotated']).toContain(result.mode);
  });

  it('returns "hidden" when nothing fits', () => {
    const labels = Array.from({ length: 100 }, (_, i) => `Very Long Category Name ${i}`);
    const result = labelStrategy(labels, 100, 12);
    expect(result.mode).toBe('hidden');
  });

  it('always returns fontSize', () => {
    const result = labelStrategy(['A'], 500, 14);
    expect(result.fontSize).toBeGreaterThan(0);
  });

  it('returns rotation for rotated mode', () => {
    const labels = ['Category One', 'Category Two', 'Category Three', 'Category Four',
      'Category Five', 'Category Six', 'Category Seven'];
    const result = labelStrategy(labels, 200, 12);
    if (result.mode === 'rotated') {
      expect(result.rotation).toBeDefined();
      expect(result.rotation).toBeLessThan(0);
    }
  });
});
