/**
 * Manifest persistence for the Dolex derived data layer.
 *
 * The .dolex.json file persists derived columns to disk so they survive
 * process restarts. On CSV load, the manifest is replayed to reconstruct
 * derived columns.
 */
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { dirname, basename, join, extname } from 'path';
import type Database from 'better-sqlite3';
import type { CsvSourceConfig } from '../types.js';
import type { ManifestData } from './types.js';
import { manifestSchema } from './types.js';
import { TransformMetadata } from './metadata.js';
import { ColumnManager } from './column-manager.js';
import { evaluateExpression } from './evaluator.js';
import { topologicalSort } from './dependency.js';
import { parse } from './parser.js';
import { extractColumnRefs } from './dependency.js';

/** Resolve the manifest file path for a source config. */
export function resolveManifestPath(config: CsvSourceConfig): string {
  const p = config.path.replace(/\/+$/, ''); // strip trailing slash
  const ext = extname(p);
  if (ext) {
    // Single file: /data/experiment.csv → /data/experiment.dolex.json
    const dir = dirname(p);
    const base = basename(p, ext);
    return join(dir, `${base}.dolex.json`);
  } else {
    // Directory: /data/study/ → /data/study/.dolex.json
    return join(p, '.dolex.json');
  }
}

/** Read and validate a manifest file. Returns null if not found or invalid. */
export function readManifest(manifestPath: string): ManifestData | null {
  if (!existsSync(manifestPath)) return null;

  let content: string;
  try {
    content = readFileSync(manifestPath, 'utf-8');
  } catch {
    return null;
  }

  if (!content.trim()) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const result = manifestSchema.safeParse(parsed);
  if (!result.success) return null;

  return result.data;
}

/** Write the manifest to disk from the metadata table. */
export function writeManifest(
  metadata: TransformMetadata,
  tables: string[],
  manifestPath: string
): void {
  const manifest: ManifestData = { version: 1, tables: {} };

  for (const tableName of tables) {
    const derived = metadata.list(tableName, 'derived');
    if (derived.length === 0) {
      manifest.tables[tableName] = [];
      continue;
    }

    // Topologically sort for replay order
    const sorted = topologicalSort(derived);
    manifest.tables[tableName] = sorted.map(r => ({
      column: r.column,
      expr: r.expr,
      type: r.type,
      ...(r.partitionBy ? { partitionBy: r.partitionBy } : {}),
    }));
  }

  const json = JSON.stringify(manifest, null, 2);

  // Atomic write: write to .tmp, then rename
  const tmpPath = manifestPath + '.tmp';
  writeFileSync(tmpPath, json, 'utf-8');
  renameSync(tmpPath, manifestPath);
}

/** Replay manifest transforms after CSV load. */
export function replayManifest(
  db: Database.Database,
  metadata: TransformMetadata,
  manifest: ManifestData,
  tableName: string
): { replayed: string[]; skipped: { column: string; reason: string }[] } {
  const entries = manifest.tables[tableName];
  if (!entries || entries.length === 0) {
    return { replayed: [], skipped: [] };
  }

  const mgr = new ColumnManager(db);
  const replayed: string[] = [];
  const skipped: { column: string; reason: string }[] = [];

  for (const entry of entries) {
    try {
      // Parse expression
      const ast = parse(entry.expr);

      // Validate column references
      const refs = extractColumnRefs(ast);
      const existingCols = mgr.getColumnNames(tableName);
      const missing = refs.filter(r => !existingCols.includes(r));
      if (missing.length > 0) {
        skipped.push({
          column: entry.column,
          reason: `Missing columns: ${missing.join(', ')}`,
        });
        continue;
      }

      // Get all rows
      const rows = mgr.getAllRows(tableName);

      // Evaluate
      const result = evaluateExpression(entry.expr, rows, {
        partitionBy: entry.partitionBy,
      });

      // Check if column already exists (shouldn't normally happen, but be safe)
      if (existingCols.includes(entry.column)) {
        mgr.overwriteColumn(tableName, entry.column, result.values);
      } else {
        mgr.addColumn(tableName, entry.column, result.values, entry.type);
      }

      // Record in metadata as derived
      metadata.add(tableName, {
        column: entry.column,
        expr: entry.expr,
        type: entry.type,
        layer: 'derived',
        partitionBy: entry.partitionBy,
      });

      replayed.push(entry.column);
    } catch (err: any) {
      skipped.push({
        column: entry.column,
        reason: err.message,
      });
    }
  }

  return { replayed, skipped };
}
