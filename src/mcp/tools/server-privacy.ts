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
import type { SourceManager } from '../../connectors/manager.js';
import { jsonResponse, formatUptime } from './shared.js';

export const clearCacheInputSchema = z.object({
  scope: z.enum(['all', 'specs', 'results']).default('all')
    .describe('What to clear: "all" (everything), "specs" (visualization specs + data), "results" (query result cache).'),
});

interface PrivacyDeps {
  sourceManager: SourceManager;
  serverStartTime: number;
}

export function handleServerStatus(deps: PrivacyDeps) {
  return async () => {
    const specStats = specStore.stats();
    const resultStats = resultCacheStats();

    const datasets = deps.sourceManager.list();
    const datasetsSummary = datasets.map((s: any) => ({
      id: s.id,
      name: s.name,
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
      datasets: {
        loaded: datasets.length,
        connected: datasetsSummary.filter((s: any) => s.connected).length,
        list: datasetsSummary,
      },
    });
  };
}

export function handleClearCache(deps: PrivacyDeps) {
  return async ({ scope }: z.infer<typeof clearCacheInputSchema>) => {
    const cleared: string[] = [];

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
        type: 'text' as const,
        text: cleared.join('\n'),
      }],
    };
  };
}
