/**
 * Source Manager
 *
 * Manages multiple connected data sources with:
 * - CRUD operations (add/remove/list)
 * - In-memory registry with optional JSON file persistence
 * - Connector lookup by type
 * - Connection caching (lazy connect on first query)
 * - SQL query execution with safety checks
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import type { DataSourceType, DataSourceConfig, DataSchema } from '../types.js';
import type {
  ConnectedSource,
  SourceRegistryEntry,
  QueryExecutionResult,
} from './types.js';
import { csvConnector } from './csv.js';

const MAX_RESULT_ROWS = 10000;

// ─── SQL Query Result ─────────────────────────────────────────────────────

export interface SqlQueryResult {
  ok: boolean;
  rows?: Record<string, any>[];
  columns?: string[];
  totalRows?: number;
  truncated?: boolean;
  error?: string;
}

// ─── SQL Safety ───────────────────────────────────────────────────────────

function isReadOnlySelect(sql: string): boolean {
  const trimmed = sql.trim().replace(/^\/\*.*?\*\//gs, '').trim();
  return /^(SELECT|WITH)\b/i.test(trimmed);
}

function wrapWithLimit(sql: string, maxRows: number): string {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  return `SELECT * FROM (${trimmed}) AS _q LIMIT ${maxRows}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSourceId(name: string): string {
  const hash = crypto.createHash('sha256').update(name).digest('hex').slice(0, 12);
  return `src-${hash}`;
}

const CONNECTOR_MAP: Record<string, typeof csvConnector> = {
  csv: csvConnector,
};

function getConnectorForType(type: DataSourceType): typeof csvConnector | undefined {
  return CONNECTOR_MAP[type];
}

/**
 * Check if a query result contains an error encoded in the rows.
 * Some connectors return errors this way instead of throwing.
 */
function hasErrorRow(result: QueryExecutionResult): string | null {
  if (result.rows.length === 1 && result.rows[0]?.error) {
    return result.rows[0].error;
  }
  return null;
}

// ─── Source Manager ──────────────────────────────────────────────────────────

export class SourceManager {
  private registry: Map<string, SourceRegistryEntry> = new Map();
  private connections: Map<string, ConnectedSource> = new Map();
  private persistPath: string | null;

  /**
   * @param persistPath Optional JSON file for persisting the registry.
   *                    Loaded on construction and saved on every mutation.
   */
  constructor(persistPath?: string) {
    this.persistPath = persistPath || null;
    if (this.persistPath) {
      this.loadRegistry();
    }
  }

  // ─── Registry Persistence ──────────────────────────────────────────────────

  private loadRegistry(): void {
    if (!this.persistPath) return;
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, 'utf-8');
        const entries: SourceRegistryEntry[] = JSON.parse(data);
        for (const entry of entries) {
          this.registry.set(entry.id, entry);
        }
      }
    } catch {
      // Corrupted or missing file — start fresh
    }
  }

  private saveRegistry(): void {
    if (!this.persistPath) return;
    try {
      const entries = Array.from(this.registry.values());
      fs.writeFileSync(this.persistPath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch {
      // Persistence failure is non-fatal
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Add a data source to the registry.
   * Does NOT connect immediately — connection is lazy on first query or explicit connect().
   */
  async add(
    name: string,
    config: DataSourceConfig
  ): Promise<{ ok: boolean; entry?: SourceRegistryEntry; error?: string }> {
    const connector = getConnectorForType(config.type);
    if (!connector) {
      return { ok: false, error: `Unsupported data source type: ${config.type}` };
    }

    const testResult = await connector.test(config);
    if (!testResult.ok) {
      return { ok: false, error: testResult.error };
    }

    const id = generateSourceId(name);
    if (this.registry.has(id)) {
      return {
        ok: false,
        error: `A source named "${name}" already exists (id: ${id}). Remove it first or use a different name.`,
      };
    }

    const entry: SourceRegistryEntry = { id, name, type: config.type, config };
    this.registry.set(id, entry);
    this.saveRegistry();

    return { ok: true, entry };
  }

  /**
   * Remove a data source by ID or name. Closes the connection if active.
   */
  async remove(idOrName: string): Promise<{ ok: boolean; error?: string }> {
    const entry = this.findEntry(idOrName);
    if (!entry) {
      return { ok: false, error: `Source not found: ${idOrName}` };
    }

    const conn = this.connections.get(entry.id);
    if (conn) {
      await conn.close();
      this.connections.delete(entry.id);
    }

    this.registry.delete(entry.id);
    this.saveRegistry();

    return { ok: true };
  }

  list(): SourceRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  get(idOrName: string): SourceRegistryEntry | undefined {
    return this.findEntry(idOrName);
  }

  // ─── Connection Management ─────────────────────────────────────────────────

  async connect(
    idOrName: string
  ): Promise<{ ok: boolean; source?: ConnectedSource; error?: string }> {
    const entry = this.findEntry(idOrName);
    if (!entry) {
      return { ok: false, error: `Source not found: ${idOrName}` };
    }

    const existing = this.connections.get(entry.id);
    if (existing) {
      return { ok: true, source: existing };
    }

    const connector = getConnectorForType(entry.type);
    if (!connector) {
      return { ok: false, error: `No connector for type: ${entry.type}` };
    }

    try {
      const connected = await connector.connect(entry.config);
      this.connections.set(entry.id, connected);
      entry.connectedAt = new Date().toISOString();
      this.saveRegistry();
      return { ok: true, source: connected };
    } catch (err: any) {
      return { ok: false, error: `Connection failed: ${err.message}` };
    }
  }

  async disconnect(idOrName: string): Promise<{ ok: boolean; error?: string }> {
    const entry = this.findEntry(idOrName);
    if (!entry) {
      return { ok: false, error: `Source not found: ${idOrName}` };
    }

    const conn = this.connections.get(entry.id);
    if (!conn) {
      return { ok: true };
    }

    await conn.close();
    this.connections.delete(entry.id);
    entry.connectedAt = undefined;
    this.saveRegistry();

    return { ok: true };
  }

  isConnected(idOrName: string): boolean {
    const entry = this.findEntry(idOrName);
    if (!entry) return false;
    return this.connections.has(entry.id);
  }

  // ─── Querying ──────────────────────────────────────────────────────────────

  /**
   * Lazily connect and return the source, or an error result.
   */
  private async resolveSource(
    idOrName: string
  ): Promise<{ ok: true; source: ConnectedSource } | { ok: false; error: string }> {
    const result = await this.connect(idOrName);
    if (!result.ok || !result.source) {
      return { ok: false, error: result.error ?? `Source not found: ${idOrName}` };
    }
    return { ok: true, source: result.source };
  }

  async getSchema(
    idOrName: string
  ): Promise<{ ok: boolean; schema?: DataSchema; error?: string }> {
    const resolved = await this.resolveSource(idOrName);
    if (!resolved.ok) return resolved;

    try {
      const schema = await resolved.source.getSchema();
      return { ok: true, schema };
    } catch (err: any) {
      return { ok: false, error: `Schema introspection failed: ${err.message}` };
    }
  }

  async query(
    idOrName: string,
    sql: string
  ): Promise<{ ok: boolean; result?: QueryExecutionResult; error?: string }> {
    const resolved = await this.resolveSource(idOrName);
    if (!resolved.ok) return resolved;

    try {
      const result = await resolved.source.executeQuery(sql);
      const errorMsg = hasErrorRow(result);
      if (errorMsg) return { ok: false, error: errorMsg };
      return { ok: true, result };
    } catch (err: any) {
      return { ok: false, error: `Query execution failed: ${err.message}` };
    }
  }

  /**
   * Execute a SQL query against a source with safety checks.
   * Only SELECT/WITH queries are allowed. Results are auto-capped at maxRows.
   * Error messages are enriched with available table/column names.
   */
  async querySql(
    idOrName: string,
    sql: string,
    maxRows: number = MAX_RESULT_ROWS
  ): Promise<SqlQueryResult> {
    if (!isReadOnlySelect(sql)) {
      return { ok: false, error: 'Only SELECT queries are allowed.' };
    }

    const resolved = await this.resolveSource(idOrName);
    if (!resolved.ok) return resolved;

    const cappedSql = wrapWithLimit(sql, Math.min(maxRows, MAX_RESULT_ROWS));

    try {
      const result = await resolved.source.executeQuery(cappedSql);
      const errorMsg = hasErrorRow(result);
      if (errorMsg) {
        const enriched = await this.enrichSqlError(idOrName, errorMsg);
        return { ok: false, error: enriched };
      }

      return {
        ok: true,
        rows: result.rows,
        columns: result.columns,
        totalRows: result.rows.length,
        truncated: result.rows.length >= Math.min(maxRows, MAX_RESULT_ROWS),
      };
    } catch (err: any) {
      const enriched = await this.enrichSqlError(idOrName, err.message);
      return { ok: false, error: `SQL query failed: ${enriched}` };
    }
  }

  /**
   * Enrich SQLite error messages with available table/column info.
   */
  private async enrichSqlError(idOrName: string, errorMsg: string): Promise<string> {
    try {
      const schemaResult = await this.getSchema(idOrName);
      if (!schemaResult.ok || !schemaResult.schema) return errorMsg;

      const schema = schemaResult.schema;

      if (/no such column/i.test(errorMsg)) {
        const allCols = schema.tables.flatMap(t => t.columns.map(c => c.name));
        const unique = [...new Set(allCols)];
        return `${errorMsg}. Available columns: ${unique.join(', ')}`;
      }

      if (/no such table/i.test(errorMsg)) {
        const tables = schema.tables.map(t => t.name);
        return `${errorMsg}. Available tables: ${tables.join(', ')}`;
      }

      if (/no such function/i.test(errorMsg)) {
        return `${errorMsg}. Available aggregate functions: SUM, AVG, MIN, MAX, COUNT, MEDIAN, STDDEV, P25, P75, P10, P90. Window functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, etc.`;
      }
    } catch {
      // Schema lookup failed — return original error
    }
    return errorMsg;
  }

  // ─── Cross-Source ──────────────────────────────────────────────────────────

  async getAllSchemas(): Promise<{ sourceId: string; sourceName: string; schema: DataSchema }[]> {
    const results: { sourceId: string; sourceName: string; schema: DataSchema }[] = [];
    for (const entry of this.registry.values()) {
      const schemaResult = await this.getSchema(entry.id);
      if (schemaResult.ok && schemaResult.schema) {
        results.push({
          sourceId: entry.id,
          sourceName: entry.name,
          schema: schemaResult.schema,
        });
      }
    }
    return results;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  async closeAll(): Promise<void> {
    for (const [, conn] of this.connections) {
      try {
        await conn.close();
      } catch {
        // Ignore individual close errors
      }
    }
    this.connections.clear();
  }

  async destroy(): Promise<void> {
    await this.closeAll();
    this.registry.clear();
    this.saveRegistry();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * Find a registry entry by ID, name (case-insensitive), or name-derived ID.
   */
  private findEntry(idOrName: string): SourceRegistryEntry | undefined {
    const byId = this.registry.get(idOrName);
    if (byId) return byId;

    const lowerName = idOrName.toLowerCase();
    for (const entry of this.registry.values()) {
      if (entry.name.toLowerCase() === lowerName) {
        return entry;
      }
    }

    return this.registry.get(generateSourceId(idOrName));
  }
}
