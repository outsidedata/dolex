/**
 * In-memory result cache for query_data → visualize flow.
 * Max 20 entries, 10-minute TTL.
 */
import { randomBytes } from 'crypto';
const MAX_ENTRIES = 20;
const TTL_MS = 10 * 60 * 1000;
const cache = new Map();
function evictExpired() {
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (now - entry.timestamp > TTL_MS) {
            cache.delete(key);
        }
    }
}
export function saveResult(rows, columns) {
    evictExpired();
    while (cache.size >= MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    const resultId = 'qr-' + randomBytes(4).toString('hex');
    cache.set(resultId, { rows, columns, timestamp: Date.now() });
    return resultId;
}
export function getResult(resultId) {
    evictExpired();
    const entry = cache.get(resultId);
    if (!entry)
        return null;
    return { rows: entry.rows, columns: entry.columns };
}
export function clearResultCache() {
    cache.clear();
}
export function resultCacheSize() {
    return cache.size;
}
export function resultCacheStats() {
    evictExpired();
    let totalRows = 0;
    for (const entry of cache.values()) {
        totalRows += entry.rows.length;
    }
    return { entries: cache.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS, totalRows };
}
//# sourceMappingURL=result-cache.js.map