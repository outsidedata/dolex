/**
 * In-memory result cache for query_source → visualize flow.
 * Max 20 entries, 10-minute TTL.
 */

import { randomBytes } from 'crypto';

interface CachedResult {
  rows: Record<string, any>[];
  columns: { name: string; type: string }[];
  timestamp: number;
}

const MAX_ENTRIES = 20;
const TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, CachedResult>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > TTL_MS) {
      cache.delete(key);
    }
  }
}

export function saveResult(rows: Record<string, any>[], columns: { name: string; type: string }[]): string {
  evictExpired();
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
  }
  const resultId = 'qr-' + randomBytes(4).toString('hex');
  cache.set(resultId, { rows, columns, timestamp: Date.now() });
  return resultId;
}

export function getResult(resultId: string): { rows: Record<string, any>[]; columns: { name: string; type: string }[] } | null {
  evictExpired();
  const entry = cache.get(resultId);
  if (!entry) return null;
  return { rows: entry.rows, columns: entry.columns };
}

export function clearResultCache(): void {
  cache.clear();
}

export function resultCacheSize(): number {
  return cache.size;
}

export function resultCacheStats(): { entries: number; maxEntries: number; ttlMs: number; totalRows: number } {
  evictExpired();
  let totalRows = 0;
  for (const entry of cache.values()) {
    totalRows += entry.rows.length;
  }
  return { entries: cache.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS, totalRows };
}
