import { describe, it, expect, beforeAll } from 'vitest';
import { registry } from '../../src/patterns/registry.js';
import { handleListPatterns } from '../../src/mcp/tools/list-patterns.js';
import { getSupportedHtmlPatterns } from '../../src/renderers/html/index.js';

describe('PatternRegistry', () => {
  it('getAll() should return 43 patterns', () => {
    const all = registry.getAll();
    expect(all).toHaveLength(43);
  });

  it('get("bar") should return the bar pattern', () => {
    const bar = registry.get('bar');
    expect(bar).toBeDefined();
    expect(bar!.id).toBe('bar');
    expect(bar!.name).toBeTruthy();
    expect(bar!.category).toBe('comparison');
  });

  it('get("nonexistent") should return undefined', () => {
    const result = registry.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('getByCategory("comparison") should return 9 patterns', () => {
    const comparison = registry.getByCategory('comparison');
    expect(comparison).toHaveLength(9);
    for (const p of comparison) {
      expect(p.category).toBe('comparison');
    }
  });

  it('getByCategory("distribution") should return 7 patterns', () => {
    const distribution = registry.getByCategory('distribution');
    expect(distribution).toHaveLength(7);
    for (const p of distribution) {
      expect(p.category).toBe('distribution');
    }
  });

  it('getByCategory("flow") should return 4 patterns', () => {
    const flow = registry.getByCategory('flow');
    expect(flow).toHaveLength(4);
    for (const p of flow) {
      expect(p.category).toBe('flow');
    }
  });

  it('getCompatible() should return patterns matching data requirements', () => {
    const compatible = registry.getCompatible({
      rowCount: 50,
      numericColumnCount: 1,
      categoricalColumnCount: 1,
      dateColumnCount: 0,
    });

    expect(compatible.length).toBeGreaterThan(0);
    // All returned patterns should be structurally compatible
    for (const p of compatible) {
      expect(p.id).toBeTruthy();
      expect(p.category).toBeTruthy();
    }
  });

  it('all patterns should have required properties', () => {
    const all = registry.getAll();
    for (const p of all) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.bestFor).toBeTruthy();
      expect(p.dataRequirements).toBeDefined();
      expect(p.selectionRules).toBeDefined();
      expect(Array.isArray(p.selectionRules)).toBe(true);
      expect(typeof p.generateSpec).toBe('function');
    }
  });

  it('getByCategory("time") should return 7 patterns', () => {
    const time = registry.getByCategory('time');
    expect(time).toHaveLength(7);
  });

  it('getByCategory("composition") should return 9 patterns', () => {
    const composition = registry.getByCategory('composition');
    expect(composition).toHaveLength(9);
  });

  it('getByCategory("relationship") should return 5 patterns', () => {
    const relationship = registry.getByCategory('relationship');
    expect(relationship).toHaveLength(5);
  });
});

// ─── CROSS-VALIDATION: all maps stay in sync ────────────────────────────────

describe('Pattern cross-validation', () => {
  const registryIds = registry.getAll().map(p => p.id).sort();
  const htmlBuilderIds = getSupportedHtmlPatterns().sort();

  // Call handleListPatterns to extract capabilities keys from the MCP output
  let capabilityIds: string[];
  let listPatternsResult: { patterns: { id: string; capabilities: Record<string, unknown> }[] };

  beforeAll(async () => {
    const handler = handleListPatterns(() => registry.getAll());
    const result = await handler();
    listPatternsResult = JSON.parse(result.content[0].text);
    // Patterns that got explicit capabilities (not the generic fallback)
    capabilityIds = listPatternsResult.patterns
      .filter(p => p.capabilities.colorEncoding !== 'Supports palette' || p.capabilities.configOptions)
      .map(p => p.id)
      .sort();
  });

  it('every registered pattern should have an HTML builder', () => {
    const missing = registryIds.filter(id => !htmlBuilderIds.includes(id));
    expect(missing, `Patterns missing HTML builders: ${missing.join(', ')}`).toEqual([]);
  });

  it('every registered pattern should have MCP capabilities', () => {
    const missing = registryIds.filter(id => !capabilityIds.includes(id));
    expect(missing, `Patterns missing from PATTERN_CAPABILITIES in list-patterns.ts: ${missing.join(', ')}`).toEqual([]);
  });

  it('no stale entries in HTML builders', () => {
    const stale = htmlBuilderIds.filter(id => !registryIds.includes(id));
    expect(stale, `HTML builders for non-existent patterns: ${stale.join(', ')}`).toEqual([]);
  });

  it('no stale entries in MCP capabilities', () => {
    const stale = capabilityIds.filter(id => !registryIds.includes(id));
    expect(stale, `PATTERN_CAPABILITIES entries for non-existent patterns: ${stale.join(', ')}`).toEqual([]);
  });
});
