/**
 * SpecStore — Server-side cache for visualization specs.
 *
 * Stores full specs + data by ID so the MCP text response can be compact
 * (just specId + metadata) while structuredContent still gets the full
 * pre-rendered chart. The MCP server is long-lived per conversation,
 * so this persists naturally across tool calls.
 */
import { randomUUID } from 'node:crypto';
const MAX_ENTRIES = 100;
const TTL_MS = 60 * 60 * 1000; // 1 hour
export class SpecStore {
    store = new Map();
    generateId() {
        return `spec-${randomUUID().slice(0, 8)}`;
    }
    isExpired(entry) {
        return Date.now() - entry.createdAt > TTL_MS;
    }
    save(spec, columns, alternatives = new Map(), originalData) {
        this.purgeExpired();
        if (this.store.size >= MAX_ENTRIES) {
            const oldestKey = this.store.keys().next().value;
            this.store.delete(oldestKey);
        }
        const id = this.generateId();
        this.store.set(id, {
            spec,
            columns,
            alternatives,
            originalData,
            createdAt: Date.now(),
        });
        return id;
    }
    get(specId) {
        const entry = this.store.get(specId);
        if (!entry)
            return null;
        if (this.isExpired(entry)) {
            this.store.delete(specId);
            return null;
        }
        return entry;
    }
    updateSpec(specId, newSpec) {
        const existing = this.store.get(specId);
        const columns = existing?.columns ?? [];
        const alternatives = existing?.alternatives ?? new Map();
        const originalData = existing?.originalData;
        return this.save(newSpec, columns, alternatives, originalData);
    }
    getAlternative(specId, patternId) {
        const stored = this.get(specId);
        if (!stored)
            return null;
        return stored.alternatives.get(patternId) ?? null;
    }
    get size() {
        return this.store.size;
    }
    purgeExpired() {
        const now = Date.now();
        let purged = 0;
        for (const [key, entry] of this.store) {
            if (now - entry.createdAt > TTL_MS) {
                this.store.delete(key);
                purged++;
            }
        }
        return purged;
    }
    clear() {
        this.store.clear();
    }
    stats() {
        this.purgeExpired();
        const now = Date.now();
        let totalDataRows = 0;
        let oldestAge = null;
        for (const entry of this.store.values()) {
            const spec = entry.spec;
            if (spec.data && Array.isArray(spec.data)) {
                totalDataRows += spec.data.length;
            }
            const age = now - entry.createdAt;
            if (oldestAge === null || age > oldestAge) {
                oldestAge = age;
            }
        }
        return {
            entries: this.store.size,
            maxEntries: MAX_ENTRIES,
            ttlMs: TTL_MS,
            totalDataRows,
            oldestEntryAge: oldestAge,
        };
    }
}
export const specStore = new SpecStore();
//# sourceMappingURL=spec-store.js.map