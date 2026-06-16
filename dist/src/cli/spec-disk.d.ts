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
import type { VisualizationSpec, CompoundVisualizationSpec, DataColumn } from '../types.js';
export interface HydratedSpec {
    spec: VisualizationSpec | CompoundVisualizationSpec;
    columns: DataColumn[];
    alternatives: Map<string, VisualizationSpec>;
    originalData?: Record<string, any>[];
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
export declare function persistSpec(specId: string, stored: HydratedSpec): void;
/** Load a stored spec from disk, rebuilding the alternatives Map. */
export declare function loadSpec(specId: string): HydratedSpec | null;
/** Delete persisted specs older than the TTL. Best-effort; never throws. */
export declare function purgeOldSpecs(): void;
