/**
 * SpecStore — Server-side cache for visualization specs.
 *
 * Stores full specs + data by ID so the MCP text response can be compact
 * (just specId + metadata) while structuredContent still gets the full
 * pre-rendered chart. The MCP server is long-lived per conversation,
 * so this persists naturally across tool calls.
 */

import { randomUUID } from 'node:crypto';
import type {
  VisualizationSpec,
  CompoundVisualizationSpec,
  DataColumn,
} from '../types.js';

export interface StoredSpec {
  spec: VisualizationSpec | CompoundVisualizationSpec;
  columns: DataColumn[];
  alternatives: Map<string, VisualizationSpec>;
  createdAt: number;
}

export interface SpecStoreStats {
  entries: number;
  maxEntries: number;
  ttlMs: number;
  totalDataRows: number;
  oldestEntryAge: number | null;
}

const MAX_ENTRIES = 100;
const TTL_MS = 60 * 60 * 1000; // 1 hour

export class SpecStore {
  private store = new Map<string, StoredSpec>();

  private generateId(): string {
    return `spec-${randomUUID().slice(0, 8)}`;
  }

  private isExpired(entry: StoredSpec): boolean {
    return Date.now() - entry.createdAt > TTL_MS;
  }

  save(
    spec: VisualizationSpec | CompoundVisualizationSpec,
    columns: DataColumn[],
    alternatives: Map<string, VisualizationSpec> = new Map(),
  ): string {
    this.purgeExpired();

    if (this.store.size >= MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value as string;
      this.store.delete(oldestKey);
    }

    const id = this.generateId();
    this.store.set(id, {
      spec,
      columns,
      alternatives,
      createdAt: Date.now(),
    });
    return id;
  }

  get(specId: string): StoredSpec | null {
    const entry = this.store.get(specId);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(specId);
      return null;
    }
    return entry;
  }

  updateSpec(
    specId: string,
    newSpec: VisualizationSpec | CompoundVisualizationSpec,
  ): string {
    const existing = this.store.get(specId);
    const columns = existing?.columns ?? [];
    const alternatives = existing?.alternatives ?? new Map<string, VisualizationSpec>();
    return this.save(newSpec, columns, alternatives);
  }

  getAlternative(specId: string, patternId: string): VisualizationSpec | null {
    const stored = this.get(specId);
    if (!stored) return null;
    return stored.alternatives.get(patternId) ?? null;
  }

  get size(): number {
    return this.store.size;
  }

  purgeExpired(): number {
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

  clear(): void {
    this.store.clear();
  }

  stats(): SpecStoreStats {
    this.purgeExpired();
    const now = Date.now();
    let totalDataRows = 0;
    let oldestAge: number | null = null;

    for (const entry of this.store.values()) {
      const spec = entry.spec as any;
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
