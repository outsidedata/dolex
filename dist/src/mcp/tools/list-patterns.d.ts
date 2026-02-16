/**
 * MCP Tool: list_patterns
 * Returns all available visualization patterns with their descriptions,
 * best-for hints, data requirements, per-pattern capabilities, and
 * full color system documentation.
 */
import type { VisualizationPattern } from '../../types.js';
export declare function handleListPatterns(getPatterns: () => VisualizationPattern[]): () => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=list-patterns.d.ts.map