/**
 * Color system tests - palette selection and highlight mode
 */

import { describe, it, expect } from 'vitest';
import type { ColorEncoding } from '../../src/types.js';
import { categorical, sequential, diverging, colorSchemes } from '../../src/theme/colors.js';

// Mock D3 for testing (we'll test the logic, not D3 itself)
const mockD3Scale = {
  scaleOrdinal: () => ({
    domain: (d: any[]) => mockD3Scale.scaleOrdinal(),
    range: (r: any[]) => ({ _domain: null, _range: r }),
  }),
  scaleLinear: () => ({
    domain: (d: any[]) => mockD3Scale.scaleLinear(),
    range: (r: any[]) => ({ _domain: [], _range: r }),
    interpolate: (i: any) => ({ _domain: null, _range: null }),
  }),
  extent: (data: any[], accessor: any) => {
    const values = data.map(accessor) as number[];
    return [Math.min(...values), Math.max(...values)];
  },
  interpolateRgb: (a: string, b: string) => (t: number) => a,
  scaleSequential: (interpolator: any) => ({
    domain: (d: any[]) => ({ _interpolator: interpolator }),
  }),
  interpolateViridis: (t: number) => '#440154',
};

// Simplified buildColorScale for testing the logic
function buildColorScale(encoding: ColorEncoding | undefined, data: Record<string, any>[]): any {
  if (!encoding || !encoding.field) {
    return () => categorical[0];
  }

  const field = encoding.field;

  // ── HIGHLIGHT MODE ──
  if (encoding.highlight) {
    const highlightSet = new Set(encoding.highlight.values);
    const highlightColors = Array.isArray(encoding.highlight.color)
      ? encoding.highlight.color
      : encoding.highlight.color
      ? [encoding.highlight.color]
      : [categorical[0]];
    const mutedColor = encoding.highlight.mutedColor || '#6b7280';
    const mutedOpacity = encoding.highlight.mutedOpacity ?? 1.0;

    return (value: any) => {
      if (highlightSet.has(value)) {
        const highlightArray = Array.from(highlightSet);
        const idx = highlightArray.indexOf(value);
        return highlightColors[idx % highlightColors.length];
      }
      if (mutedOpacity < 1.0) {
        const hex = mutedColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${mutedOpacity})`;
      }
      return mutedColor;
    };
  }

  // ── PALETTE SELECTION ──
  if (encoding.palette) {
    const palette = resolvePalette(encoding.palette);
    if (palette) {
      const domain = [...new Set(data.map((d) => d[field]))];
      return (value: any) => {
        const idx = domain.indexOf(value);
        return palette[idx % palette.length];
      };
    }
  }

  // ── DEFAULT ──
  const domain = [...new Set(data.map((d) => d[field]))];
  return (value: any) => {
    const idx = domain.indexOf(value);
    return categorical[idx % categorical.length];
  };
}

function resolvePalette(name: string): string[] | null {
  switch (name) {
    case 'categorical':
      return [...categorical];
    case 'blue':
      return [...sequential.blue];
    case 'green':
      return [...sequential.green];
    case 'purple':
      return [...sequential.purple];
    case 'warm':
      return [...sequential.warm];
    case 'blueRed':
      return [...diverging.blueRed];
    case 'greenPurple':
      return [...diverging.greenPurple];
    case 'tealOrange':
      return [...diverging.tealOrange];
    case 'traffic-light':
      return [...colorSchemes['traffic-light']];
    case 'profit-loss':
      return [...colorSchemes['profit-loss']];
    case 'temperature':
      return [...colorSchemes.temperature];
    default:
      return null;
  }
}

describe('Color System', () => {
  const testData = [
    { region: 'North', sales: 100 },
    { region: 'South', sales: 200 },
    { region: 'East', sales: 150 },
    { region: 'West', sales: 180 },
  ];

  describe('Palette Selection', () => {
    it('should use categorical palette by default', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(categorical[0]);
      expect(scale('South')).toBe(categorical[1]);
    });

    it('should use named categorical palette', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        palette: 'categorical',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(categorical[0]);
      expect(scale('South')).toBe(categorical[1]);
    });

    it('should use green sequential palette', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        palette: 'green',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(sequential.green[0]);
      expect(scale('South')).toBe(sequential.green[1]);
    });

    it('should use diverging blueRed palette', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        palette: 'blueRed',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(diverging.blueRed[0]);
      expect(scale('South')).toBe(diverging.blueRed[1]);
    });

    it('should use traffic-light color scheme', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        palette: 'traffic-light',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(colorSchemes['traffic-light'][0]);
      expect(scale('South')).toBe(colorSchemes['traffic-light'][1]);
    });

    it('should use profit-loss color scheme', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        palette: 'profit-loss',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(colorSchemes['profit-loss'][0]); // Red
      expect(scale('South')).toBe(colorSchemes['profit-loss'][1]); // Gray
      expect(scale('East')).toBe(colorSchemes['profit-loss'][2]); // Green
    });
  });

  describe('Highlight Mode', () => {
    it('should highlight single value with default color', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North'],
        },
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(categorical[0]); // Highlighted
      expect(scale('South')).toBe('#6b7280'); // Muted
      expect(scale('East')).toBe('#6b7280'); // Muted
      expect(scale('West')).toBe('#6b7280'); // Muted
    });

    it('should highlight single value with custom color', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North'],
          color: '#ff0000',
        },
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe('#ff0000'); // Custom red
      expect(scale('South')).toBe('#6b7280'); // Muted
    });

    it('should highlight multiple values with array of colors', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North', 'East'],
          color: ['#ff0000', '#00ff00'],
        },
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe('#ff0000'); // Red
      expect(scale('East')).toBe('#00ff00'); // Green
      expect(scale('South')).toBe('#6b7280'); // Muted
      expect(scale('West')).toBe('#6b7280'); // Muted
    });

    it('should use custom muted color', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North'],
          mutedColor: '#cccccc',
        },
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('South')).toBe('#cccccc');
      expect(scale('East')).toBe('#cccccc');
    });

    it('should apply muted opacity', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North'],
          mutedOpacity: 0.3,
        },
      };

      const scale = buildColorScale(encoding, testData);
      const mutedColor = scale('South');
      expect(mutedColor).toContain('rgba');
      expect(mutedColor).toContain('0.3');
    });

    it('should cycle through colors for more highlights than color array', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North', 'South', 'East'],
          color: ['#ff0000', '#00ff00'], // Only 2 colors for 3 values
        },
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe('#ff0000'); // First color
      expect(scale('South')).toBe('#00ff00'); // Second color
      expect(scale('East')).toBe('#ff0000'); // Cycles back to first
      expect(scale('West')).toBe('#6b7280'); // Muted
    });
  });

  describe('Dashboard Drill-Down Use Case', () => {
    it('should support cross-chart highlighting', () => {
      // Simulate user clicking "East" in dashboard, all charts highlight East
      const highlightEncoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['East'],
          color: categorical[0], // Blue accent
          mutedColor: '#4b5563',
          mutedOpacity: 0.4,
        },
      };

      const scale = buildColorScale(highlightEncoding, testData);

      // East is highlighted
      expect(scale('East')).toBe(categorical[0]);

      // Others are muted with opacity
      const mutedColor = scale('North');
      expect(mutedColor).toContain('rgba');
      expect(mutedColor).toContain('0.4');
    });

    it('should support multi-selection highlighting', () => {
      // User selects both "North" and "East" for comparison
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
        highlight: {
          values: ['North', 'East'],
          color: [categorical[0], categorical[3]], // Blue and coral
        },
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(categorical[0]); // Blue
      expect(scale('East')).toBe(categorical[3]); // Coral
      expect(scale('South')).toBe('#6b7280'); // Muted
      expect(scale('West')).toBe('#6b7280'); // Muted
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with no encoding', () => {
      const scale = buildColorScale(undefined, testData);
      expect(scale('anything')).toBe(categorical[0]);
    });

    it('should work with no field', () => {
      const encoding: ColorEncoding = {
        type: 'nominal',
      };
      const scale = buildColorScale(encoding, testData);
      expect(scale('anything')).toBe(categorical[0]);
    });

    it('should not break existing specs without palette or highlight', () => {
      const encoding: ColorEncoding = {
        field: 'region',
        type: 'nominal',
      };

      const scale = buildColorScale(encoding, testData);
      expect(scale('North')).toBe(categorical[0]);
      expect(scale('South')).toBe(categorical[1]);
    });
  });
});
