/**
 * In-memory result cache for query_data → visualize flow.
 * Max 20 entries, 10-minute TTL.
 */
export declare function saveResult(rows: Record<string, any>[], columns: {
    name: string;
    type: string;
}[]): string;
export declare function getResult(resultId: string): {
    rows: Record<string, any>[];
    columns: {
        name: string;
        type: string;
    }[];
} | null;
export declare function clearResultCache(): void;
export declare function resultCacheSize(): number;
export declare function resultCacheStats(): {
    entries: number;
    maxEntries: number;
    ttlMs: number;
    totalRows: number;
};
//# sourceMappingURL=result-cache.d.ts.map