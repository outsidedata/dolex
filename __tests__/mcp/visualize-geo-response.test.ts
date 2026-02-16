import { describe, it, expect } from 'vitest';
import { handleVisualizeCore } from '../../src/mcp/tools/visualize.js';
import { selectPattern } from '../../src/patterns/selector.js';
import type { VisualizeInput, VisualizeOutput, DataColumn } from '../../src/types.js';

function makeSelectPatterns() {
  return (input: VisualizeInput): VisualizeOutput => {
    const opts: Record<string, any> = {};
    if (input.forcePattern) opts.forcePattern = input.forcePattern;
    if (input.geoLevel || input.geoRegion) {
      opts.specOptions = {
        ...(input.geoLevel ? { geoLevel: input.geoLevel } : {}),
        ...(input.geoRegion ? { geoRegion: input.geoRegion } : {}),
      };
    }
    return selectPattern(
      input.data, input.columns as DataColumn[], input.intent, opts,
    ) as unknown as VisualizeOutput;
  };
}

describe('geo response metadata', () => {
  it('includes geo info for choropleth with US states', () => {
    const core = handleVisualizeCore(makeSelectPatterns());
    const data = [
      { state: 'California', value: 100 },
      { state: 'Texas', value: 80 },
      { state: 'Florida', value: 60 },
      { state: 'New York', value: 90 },
      { state: 'Ohio', value: 40 },
    ];
    const response = core(data, {
      intent: 'show state map of values',
      pattern: 'choropleth',
    });

    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed.geo).toBeDefined();
    expect(parsed.geo.region).toBe('us');
    expect(parsed.geo.projection).toBe('albersUsa');
  });

  it('includes geo info for explicit geoRegion', () => {
    const core = handleVisualizeCore(makeSelectPatterns());
    const data = [
      { province: 'Beijing', value: 100 },
      { province: 'Shanghai', value: 80 },
    ];
    const response = core(data, {
      intent: 'show data on a map',
      pattern: 'choropleth',
      geoRegion: 'CN',
    });

    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed.geo).toBeDefined();
    expect(parsed.geo.region).toBe('CN');
  });

  it('does not include geo for non-geo patterns', () => {
    const core = handleVisualizeCore(makeSelectPatterns());
    const data = [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ];
    const response = core(data, {
      intent: 'compare values',
      pattern: 'bar',
    });

    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed.geo).toBeUndefined();
  });
});
