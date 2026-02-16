/**
 * Server privacy tools — inspect and clear cached data.
 *
 * server_status: Shows what data is currently held in memory.
 * clear_cache: Clears cached specs and query results.
 */
import { z } from 'zod';
import { specStore } from '../spec-store.js';
import { clearResultCache, resultCacheStats } from './result-cache.js';
import { operationLog } from './operation-log.js';
import { jsonResponse, formatUptime } from './shared.js';
export const clearCacheInputSchema = z.object({
    scope: z.enum(['all', 'specs', 'results']).default('all')
        .describe('What to clear: "all" (everything), "specs" (visualization specs + data), "results" (query result cache).'),
});
export function handleServerStatus(deps) {
    return async () => {
        const specStats = specStore.stats();
        const resultStats = resultCacheStats();
        const sources = deps.sourceManager.list();
        const sourcesSummary = sources.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            connected: deps.sourceManager.isConnected(s.id),
        }));
        return jsonResponse({
            uptime: formatUptime(Date.now() - deps.serverStartTime),
            specStore: {
                cachedSpecs: specStats.entries,
                maxSpecs: specStats.maxEntries,
                totalDataRows: specStats.totalDataRows,
                ttl: '1 hour',
                oldestEntryAge: specStats.oldestEntryAge
                    ? `${Math.floor(specStats.oldestEntryAge / 60000)} minutes`
                    : null,
            },
            resultCache: {
                cachedResults: resultStats.entries,
                maxResults: resultStats.maxEntries,
                totalDataRows: resultStats.totalRows,
                ttl: '10 minutes',
            },
            sources: {
                registered: sources.length,
                connected: sourcesSummary.filter(s => s.connected).length,
                list: sourcesSummary,
            },
        });
    };
}
export function handleClearCache(deps) {
    return async ({ scope }) => {
        const cleared = [];
        if (scope === 'all' || scope === 'specs') {
            const count = specStore.size;
            specStore.clear();
            cleared.push(`Cleared ${count} cached visualization specs`);
        }
        if (scope === 'all' || scope === 'results') {
            const stats = resultCacheStats();
            clearResultCache();
            cleared.push(`Cleared ${stats.entries} cached query results`);
        }
        if (scope === 'all') {
            operationLog.clear();
            cleared.push('Cleared operation log');
        }
        return {
            content: [{
                    type: 'text',
                    text: cleared.join('\n'),
                }],
        };
    };
}
//# sourceMappingURL=server-privacy.js.map