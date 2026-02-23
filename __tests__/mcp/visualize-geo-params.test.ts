import { describe, it, expect } from 'vitest';
import { visualizeInputSchema } from '../../src/mcp/tools/visualize.js';

describe('visualize geo params', () => {
  it('accepts geoLevel and geoRegion', () => {
    const result = visualizeInputSchema.safeParse({
      intent: 'Show GDP by country',
      data: [{ country: 'US', gdp: 25 }],
      geoLevel: 'country',
      geoRegion: 'world',
    });
    expect(result.success).toBe(true);
  });

  it('accepts geoRegion without geoLevel', () => {
    const result = visualizeInputSchema.safeParse({
      intent: 'Show population by state',
      data: [{ state: 'CA', pop: 39 }],
      geoRegion: 'US',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid geoLevel', () => {
    const result = visualizeInputSchema.safeParse({
      intent: 'test',
      data: [],
      geoLevel: 'city',
    });
    expect(result.success).toBe(false);
  });

  it('passes geo params through parsed result', () => {
    const parsed = visualizeInputSchema.parse({
      intent: 'map of China by province',
      data: [{ province: 'Beijing', value: 100 }],
      geoLevel: 'subdivision',
      geoRegion: 'CN',
    });
    expect(parsed.geoLevel).toBe('subdivision');
    expect(parsed.geoRegion).toBe('CN');
  });

  it('allows omitting both geo params', () => {
    const result = visualizeInputSchema.safeParse({
      intent: 'show sales',
      data: [{ item: 'A', sales: 10 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.geoLevel).toBeUndefined();
      expect(result.data.geoRegion).toBeUndefined();
    }
  });
});

describe('visualize source query geo params', () => {
  it('accepts geoLevel and geoRegion with sourceId + sql', () => {
    const result = visualizeInputSchema.safeParse({
      sourceId: 'test',
      sql: 'SELECT * FROM data',
      intent: 'map of Japan by prefecture',
      geoLevel: 'subdivision',
      geoRegion: 'JP',
    });
    expect(result.success).toBe(true);
  });
});
