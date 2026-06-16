/**
 * Disk-backed persistence for visualization specs.
 *
 * The in-memory SpecStore lives only as long as a process, which is fine for
 * the long-lived MCP server but useless for a stateless CLI where each command
 * is a fresh process. This module persists the full StoredSpec (spec + columns
 * + alternatives + original data) to `~/.dolex/specs/<specId>.json` so that
 * `dolex refine` can re-hydrate a chart produced by an earlier `dolex visualize`
 * call.
 *
 * State is keyed ONLY by the spec hash — there is no shared "last" pointer.
 * A singleton pointer would be mutable global state that crosses streams between
 * concurrent CLI processes (e.g. parallel agents): one process's visualize would
 * silently redirect another's refine. The caller passes the hash back explicitly.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import type { VisualizationSpec, CompoundVisualizationSpec, DataColumn } from '../types.js';
import { dolexHome } from './paths.js';

export interface HydratedSpec {
  spec: VisualizationSpec | CompoundVisualizationSpec;
  columns: DataColumn[];
  alternatives: Map<string, VisualizationSpec>;
  originalData?: Record<string, any>[];
}

interface DiskSpec {
  spec: VisualizationSpec | CompoundVisualizationSpec;
  columns: DataColumn[];
  alternatives: [string, VisualizationSpec][];
  originalData?: Record<string, any>[];
  createdAt: number;
}

const SPEC_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function specsDir(): string {
  const dir = join(dolexHome(), 'specs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function specPath(specId: string): string {
  // Reject anything that could escape the specs directory (path separators,
  // `..`, etc.). Generated ids are always `spec-xxxxxxxx`.
  if (!/^[A-Za-z0-9._-]+$/.test(specId) || specId.includes('..')) {
    throw new Error(`Unsafe spec id: ${specId}`);
  }
  return join(specsDir(), `${specId}.json`);
}

/**
 * Persist a stored spec to disk, keyed solely by its hash.
 *
 * There is deliberately NO shared "last" pointer: that would be mutable global
 * state, and concurrent CLI processes (e.g. parallel agents) would cross
 * streams — one process's visualize would redirect another's refine. The hash
 * is the only handle; the caller passes it back explicitly. Writes go through a
 * per-process temp file + atomic rename so a concurrent reader never sees a
 * half-written spec.
 */
export function persistSpec(specId: string, stored: HydratedSpec): void {
  const disk: DiskSpec = {
    spec: stored.spec,
    columns: stored.columns,
    alternatives: [...stored.alternatives.entries()],
    originalData: stored.originalData,
    createdAt: Date.now(),
  };
  const finalPath = specPath(specId);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(disk), 'utf-8');
  renameSync(tmpPath, finalPath);
}

/** Load a stored spec from disk, rebuilding the alternatives Map. */
export function loadSpec(specId: string): HydratedSpec | null {
  try {
    const p = specPath(specId);
    if (!existsSync(p)) return null;
    const disk = JSON.parse(readFileSync(p, 'utf-8')) as DiskSpec;
    return {
      spec: disk.spec,
      columns: disk.columns,
      alternatives: new Map(disk.alternatives ?? []),
      originalData: disk.originalData,
    };
  } catch {
    return null;
  }
}

/** Delete persisted specs older than the TTL. Best-effort; never throws. */
export function purgeOldSpecs(): void {
  try {
    const dir = specsDir();
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const full = join(dir, name);
      try {
        if (now - statSync(full).mtimeMs > SPEC_TTL_MS) unlinkSync(full);
      } catch {
        /* ignore individual file errors */
      }
    }
  } catch {
    /* ignore */
  }
}
