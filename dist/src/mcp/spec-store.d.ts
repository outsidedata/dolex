/**
 * SpecStore — Server-side cache for visualization specs.
 *
 * Stores full specs + data by ID so the MCP text response can be compact
 * (just specId + metadata) while structuredContent still gets the full
 * pre-rendered chart. The MCP server is long-lived per conversation,
 * so this persists naturally across tool calls.
 */
import type { VisualizationSpec, CompoundVisualizationSpec, DataColumn } from '../types.js';
export interface StoredSpec {
    spec: VisualizationSpec | CompoundVisualizationSpec;
    columns: DataColumn[];
    alternatives: Map<string, VisualizationSpec>;
    originalData?: Record<string, any>[];
    createdAt: number;
}
export interface SpecStoreStats {
    entries: number;
    maxEntries: number;
    ttlMs: number;
    totalDataRows: number;
    oldestEntryAge: number | null;
}
export declare class SpecStore {
    private store;
    private generateId;
    private isExpired;
    save(spec: VisualizationSpec | CompoundVisualizationSpec, columns: DataColumn[], alternatives?: Map<string, VisualizationSpec>, originalData?: Record<string, any>[]): string;
    get(specId: string): StoredSpec | null;
    updateSpec(specId: string, newSpec: VisualizationSpec | CompoundVisualizationSpec): string;
    getAlternative(specId: string, patternId: string): VisualizationSpec | null;
    get size(): number;
    purgeExpired(): number;
    clear(): void;
    stats(): SpecStoreStats;
}
export declare const specStore: SpecStore;
//# sourceMappingURL=spec-store.d.ts.map