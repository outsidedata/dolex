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
  DataConnector,
  SourceRegistryEntry,
  QueryExecutionResult,
} from './types.js';
import { csvConnector } from './csv.js';
import { pgConnector } from './pg/index.js';
import { mongoConnector } from './mongo/index.js';
import { riskyDivisionTerms, detectSqlFootguns, divisionDenominators, detectDivByZero, detectBareAggregate } from './sql-safety.js';

const MAX_RESULT_ROWS = 10000;

// ─── SQL Query Result ─────────────────────────────────────────────────────

export interface SqlQueryResult {
  ok: boolean;
  rows?: Record<string, any>[];
  columns?: string[];
  totalRows?: number;
  truncated?: boolean;
  error?: string;
  /** Advisory SQL-safety diagnostics (e.g. integer-division truncation). The
   *  query still ran; these signal silent-wrong-answer traps so the caller can
   *  re-issue a corrected query. The engine never rewrites the SQL itself. */
  warnings?: string[];
}

// ─── SQL Safety ───────────────────────────────────────────────────────────

function isReadOnlySelect(sql: string): boolean {
  const trimmed = sql.trim().replace(/^\/\*.*?\*\//gs, '').trim();

  // Simple SELECT is safe
  if (/^SELECT\b/i.test(trimmed)) {
    return true;
  }

  // WITH clause (CTE) — must verify the final statement is SELECT, not DELETE/INSERT/UPDATE
  if (/^WITH\b/i.test(trimmed)) {
    // Find the main statement after CTEs by looking for the final SELECT/INSERT/UPDATE/DELETE
    // CTEs are: WITH name AS (...), name AS (...) <final statement>
    // Strip string literals and comments to avoid false matches inside quoted content
    const stripped = trimmed
      .replace(/'[^']*'/g, "''")  // Remove string literals
      .replace(/"[^"]*"/g, '""')  // Remove quoted identifiers
      .replace(/--.*$/gm, '')     // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove block comments

    // The final statement starts after the last unmatched ) before the statement keyword
    // We need to find where the CTEs end and the main query begins
    // Look for DELETE/INSERT/UPDATE/SELECT after WITH ... AS (...) sequences
    const mainStatementMatch = stripped.match(/\)\s*(SELECT|INSERT|UPDATE|DELETE)\b/i);
    if (mainStatementMatch) {
      return mainStatementMatch[1].toUpperCase() === 'SELECT';
    }

    // Fallback: if structure is unclear, reject (safer than allowing potential write)
    return false;
  }

  return false;
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

/** Classify a connection failure into an actionable kind, so callers can give a specific next step
 *  (install the driver / start the DB / fix credentials) instead of relaying a raw driver string. */
export function classifyConnError(msg = ''): 'driver-missing' | 'unreachable' | 'host-not-found' | 'timeout' | 'auth-failed' | 'db-not-found' | 'error' {
  if (/needs an optional dependency|npm install/i.test(msg)) return 'driver-missing';
  if (/ECONNREFUSED|connection refused/i.test(msg)) return 'unreachable';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 'host-not-found';
  if (/ETIMEDOUT|timed? ?out/i.test(msg)) return 'timeout';
  if (/password|authentication|auth(entication)? failed|SCRAM|role ".*" does not exist|not authorized/i.test(msg)) return 'auth-failed';
  if (/database ".*" does not exist|Unknown database|no such database/i.test(msg)) return 'db-not-found';
  return 'error';
}

const CONNECTOR_MAP: Record<string, DataConnector> = {
  csv: csvConnector,
  postgres: pgConnector,
  mongodb: mongoConnector,
};

/** SQL-family sources go through the SQL safety/limit/error machinery; a document store
 *  (mongodb) is routed down a pipeline path instead (no SELECT gate, no LIMIT-wrap). */
const isSqlSource = (type?: string): boolean => type === 'csv' || type === 'postgres';

/** Read-only gate for an aggregation pipeline: reject write stages ($out/$merge) and any
 *  arbitrary-JS operators ($function/$accumulator/$where) — the Mongo analogue of the
 *  SELECT-only SQL gate. Best-effort: a malformed pipeline string is rejected too. */
function isReadOnlyPipeline(query: string): { ok: boolean; error?: string } {
  if (/"\$(?:out|merge|function|accumulator|where)"/i.test(query)) {
    return { ok: false, error: 'Only read-only aggregation pipelines are allowed (no $out/$merge/$function/$accumulator/$where).' };
  }
  return { ok: true };
}

function getConnectorForType(type: DataSourceType): DataConnector | undefined {
  return CONNECTOR_MAP[type];
}

/**
 * Check if a query result contains an error encoded in the rows.
 * Some connectors return errors this way instead of throwing.
 * Only matches if the row has ONLY an 'error' property (not a data row with an 'error' column).
 */
function hasErrorRow(result: QueryExecutionResult): string | null {
  if (result.rows.length === 1) {
    const row = result.rows[0];
    const keys = Object.keys(row);
    // Only treat as error if 'error' is the ONLY key (not a data row with an 'error' column)
    if (keys.length === 1 && keys[0] === 'error' && typeof row.error === 'string') {
      return row.error;
    }
  }
  return null;
}

// ─── Source Manager ──────────────────────────────────────────────────────────

export class SourceManager {
  private registry: Map<string, SourceRegistryEntry> = new Map();
  private connections: Map<string, ConnectedSource> = new Map();
  private pendingConnections: Map<string, Promise<{ ok: boolean; source?: ConnectedSource; error?: string }>> = new Map();
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
      // Atomic write: a concurrent reader (another CLI process or the MCP
      // server sharing ~/.dolex/sources.json) never observes a half-written
      // file. The temp name includes the pid so concurrent writers don't
      // collide on a shared temp path. (Note: this prevents corruption, not
      // last-writer-wins lost updates between simultaneous registry mutations.)
      const tmpPath = `${this.persistPath}.${process.pid}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.persistPath);
      // The registry may hold connection strings / credentials — restrict it to the owner.
      try { fs.chmodSync(this.persistPath, 0o600); } catch { /* best-effort */ }
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
    config: DataSourceConfig,
    opts: { verify?: boolean } = {},
  ): Promise<{ ok: boolean; entry?: SourceRegistryEntry; error?: string; verified?: boolean; warning?: string }> {
    const connector = getConnectorForType(config.type);
    if (!connector) {
      return { ok: false, error: `Unsupported data source type: ${config.type}` };
    }

    const id = generateSourceId(name);
    if (this.registry.has(id)) {
      return {
        ok: false,
        error: `A source named "${name}" already exists (id: ${id}). Remove it first or use a different name.`,
      };
    }

    // Config-first: liveness is NOT a precondition for registering (a DB can be momentarily down,
    // asleep, or behind a not-yet-started tunnel). We verify, but only REFUSE when opts.verify is
    // set; otherwise we persist the config and report the connectivity result so the caller can act.
    const testResult = await connector.test(config);
    if (!testResult.ok && opts.verify) {
      return { ok: false, error: testResult.error, verified: false };
    }

    const entry: SourceRegistryEntry = { id, name, type: config.type, config };
    this.registry.set(id, entry);
    this.saveRegistry();

    return { ok: true, entry, verified: testResult.ok, warning: testResult.ok ? undefined : testResult.error };
  }

  /**
   * Update a registered source's config in place (DB moved, password rotated, driver now installed)
   * WITHOUT losing its id — so every existing reference keeps working. `patch` is merged over the
   * stored config; the type is immutable. Any live connection is closed so the next use reconnects.
   */
  async update(
    idOrName: string,
    patch: Partial<DataSourceConfig>,
    opts: { verify?: boolean } = {},
  ): Promise<{ ok: boolean; entry?: SourceRegistryEntry; error?: string; verified?: boolean; warning?: string }> {
    const entry = this.findEntry(idOrName);
    if (!entry) return { ok: false, error: `Source not found: ${idOrName}` };
    const config = { ...entry.config, ...patch, type: entry.config.type } as DataSourceConfig;
    const connector = getConnectorForType(config.type)!;
    const testResult = await connector.test(config);
    if (!testResult.ok && opts.verify) return { ok: false, error: testResult.error, verified: false };
    const conn = this.connections.get(entry.id);
    if (conn) { await conn.close(); this.connections.delete(entry.id); }
    entry.config = config;
    this.registry.set(entry.id, entry);
    this.saveRegistry();
    return { ok: true, entry, verified: testResult.ok, warning: testResult.ok ? undefined : testResult.error };
  }

  /**
   * Connectivity health-check for a REGISTERED source (the return-user's "is my saved DB still
   * reachable?" and an agent's pre-flight). Returns a classified failure so the caller can give an
   * actionable next step rather than a raw driver string.
   */
  async testSource(idOrName: string): Promise<{ ok: boolean; error?: string; kind?: string }> {
    const entry = this.findEntry(idOrName);
    if (!entry) return { ok: false, error: `Source not found: ${idOrName}`, kind: 'not-registered' };
    const connector = getConnectorForType(entry.config.type)!;
    const r = await connector.test(entry.config);
    return r.ok ? { ok: true } : { ok: false, error: r.error, kind: classifyConnError(r.error) };
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

    // Return existing connection if available
    const existing = this.connections.get(entry.id);
    if (existing) {
      return { ok: true, source: existing };
    }

    // If a connection attempt is already in progress, wait for it
    // This prevents race conditions where concurrent calls both create connections
    const pending = this.pendingConnections.get(entry.id);
    if (pending) {
      return pending;
    }

    const connector = getConnectorForType(entry.type);
    if (!connector) {
      return { ok: false, error: `No connector for type: ${entry.type}` };
    }

    // Create the connection promise and store it to deduplicate concurrent calls
    const connectPromise = (async () => {
      try {
        const connected = await connector.connect(entry.config);
        this.connections.set(entry.id, connected);
        entry.connectedAt = new Date().toISOString();
        this.saveRegistry();
        return { ok: true, source: connected };
      } catch (err: any) {
        return { ok: false, error: `Connection failed: ${err.message}` };
      } finally {
        // Clean up pending promise after completion
        this.pendingConnections.delete(entry.id);
      }
    })();

    this.pendingConnections.set(entry.id, connectPromise);
    return connectPromise;
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

    // A document store takes an aggregation pipeline, not SQL — gate + run accordingly.
    if (!isSqlSource(resolved.source.type)) {
      const guard = isReadOnlyPipeline(sql);
      if (!guard.ok) return { ok: false, error: guard.error };
    } else if (!isReadOnlySelect(sql)) {
      // Enforce read-only queries to prevent SQL injection attacks
      return { ok: false, error: 'Only SELECT queries are allowed.' };
    }

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
    const resolved = await this.resolveSource(idOrName);
    if (!resolved.ok) return resolved;

    // Document store: run the read-only aggregation pipeline (no SELECT gate, no LIMIT-wrap);
    // cap the result set client-side instead of via SQL.
    if (!isSqlSource(resolved.source.type)) {
      return this.queryPipeline(resolved.source, sql, Math.min(maxRows, MAX_RESULT_ROWS));
    }

    if (!isReadOnlySelect(sql)) {
      return { ok: false, error: 'Only SELECT queries are allowed.' };
    }

    const cappedSql = wrapWithLimit(sql, Math.min(maxRows, MAX_RESULT_ROWS));

    try {
      const result = await resolved.source.executeQuery(cappedSql);
      const errorMsg = hasErrorRow(result);
      if (errorMsg) {
        const enriched = await this.enrichSqlError(idOrName, errorMsg);
        return { ok: false, error: enriched };
      }

      // Only mark as truncated if we hit our limit AND the user didn't have an explicit LIMIT
      const userHasLimit = /\bLIMIT\s+\d+/i.test(sql);
      const hitOurLimit = result.rows.length >= Math.min(maxRows, MAX_RESULT_ROWS);

      const warnings = await this.analyzeSqlSafety(resolved.source, sql);

      return {
        ok: true,
        rows: result.rows,
        columns: result.columns,
        totalRows: result.rows.length,
        truncated: hitOurLimit && !userHasLimit,
        ...(warnings.length ? { warnings } : {}),
      };
    } catch (err: any) {
      const enriched = await this.enrichSqlError(idOrName, err.message);
      return { ok: false, error: `SQL query failed: ${enriched}` };
    }
  }

  /**
   * Run a read-only aggregation pipeline against a document store and return rows + columns,
   * capped to maxRows. The pipeline string is the {collection, pipeline} seam the connector
   * parses. No SQL safety pass (those footguns are SQL-only); Mongo-specific footgun
   * detection is the language-plane work, added later. Never throws (audit-on-load relies on it).
   */
  private async queryPipeline(
    source: ConnectedSource,
    query: string,
    maxRows: number,
  ): Promise<SqlQueryResult> {
    const guard = isReadOnlyPipeline(query);
    if (!guard.ok) return { ok: false, error: guard.error };
    try {
      const result = await source.executeQuery(query);
      const errorMsg = hasErrorRow(result);
      if (errorMsg) return { ok: false, error: errorMsg };
      const capped = result.rows.slice(0, maxRows);
      return {
        ok: true, rows: capped, columns: result.columns,
        totalRows: result.rows.length, truncated: result.rows.length > capped.length,
      };
    } catch (err: any) {
      return { ok: false, error: `Pipeline query failed: ${err.message}` };
    }
  }

  /**
   * Advisory SQL-safety pass over a successful query. Best-effort: any failure
   * yields no warnings (never blocks or breaks the query). Gated on a cheap
   * syntactic pre-filter so the type probes only run when a risky term exists.
   */
  private async analyzeSqlSafety(
    source: { type?: string; getSchema(): Promise<DataSchema>; executeQuery(sql: string): Promise<QueryExecutionResult> },
    sql: string,
  ): Promise<string[]> {
    try {
      const hasDivision = riskyDivisionTerms(sql).length > 0;
      const denoms = divisionDenominators(sql);
      const maybeBareAgg = /\b(?:SUM|AVG|COUNT|MIN|MAX|TOTAL|GROUP_CONCAT|MEDIAN|STDDEV)\s*\(/i.test(sql) && !/\bGROUP\s+BY\b/i.test(sql);
      if (!hasDivision && denoms.length === 0 && !maybeBareAgg) return [];

      const schema = await source.getSchema();
      const colToTable = new Map<string, string>();
      for (const t of schema.tables) for (const c of t.columns) if (!colToTable.has(c.name)) colToTable.set(c.name, t.name);

      // Type probe is dialect-specific: SQLite has typeof(); Postgres has pg_typeof().
      // Normalize the result so the integer-division check ('integer') works on both —
      // Postgres int columns report integer/bigint/smallint, floats numeric/double precision.
      const isPg = source.type === 'postgres';
      const normalizeType = (raw: string): string => {
        const t = raw.toLowerCase();
        if (t === 'integer' || t === 'bigint' || t === 'smallint') return 'integer';
        if (t === 'numeric' || t === 'double precision' || t === 'real') return 'real';
        return t;
      };
      const typeCache = new Map<string, string | undefined>();
      const columnType = async (col: string): Promise<string | undefined> => {
        if (typeCache.has(col)) return typeCache.get(col);
        let type: string | undefined;
        const table = colToTable.get(col);
        if (table) {
          const probe = isPg ? `pg_typeof("${col}")::text` : `typeof("${col}")`;
          const r = await source.executeQuery(
            `SELECT ${probe} AS t FROM "${table}" WHERE "${col}" IS NOT NULL LIMIT 1`,
          );
          const v = r.rows?.[0]?.t;
          type = typeof v === 'string' ? normalizeType(v) : undefined;
        }
        typeCache.set(col, type);
        return type;
      };

      const zeroCache = new Map<string, boolean>();
      const columnHasZero = async (col: string): Promise<boolean> => {
        if (zeroCache.has(col)) return zeroCache.get(col)!;
        let zero = false;
        const table = colToTable.get(col);
        if (table) {
          const r = await source.executeQuery(`SELECT 1 AS z FROM "${table}" WHERE "${col}" = 0 LIMIT 1`);
          zero = (r.rows?.length ?? 0) > 0;
        }
        zeroCache.set(col, zero);
        return zero;
      };

      const warnings = [
        ...(await detectSqlFootguns(sql, columnType)),
        ...(await detectDivByZero(sql, columnHasZero)),
        ...detectBareAggregate(sql, (col) => colToTable.has(col)),
      ];
      return warnings.map((w) => w.message);
    } catch {
      return [];
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
        return `${errorMsg}. Available aggregate functions: SUM, AVG, MIN, MAX, COUNT, MEDIAN, STDDEV, CV, MAD, P1, P5, P10, P25, P75, P90, P95, P99. Window functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, etc.`;
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
