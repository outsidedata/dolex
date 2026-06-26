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
import { csvConnector } from './csv.js';
import { riskyDivisionTerms, detectSqlFootguns, divisionDenominators, detectDivByZero, detectBareAggregate } from './sql-safety.js';
const MAX_RESULT_ROWS = 10000;
// ─── SQL Safety ───────────────────────────────────────────────────────────
function isReadOnlySelect(sql) {
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
            .replace(/'[^']*'/g, "''") // Remove string literals
            .replace(/"[^"]*"/g, '""') // Remove quoted identifiers
            .replace(/--.*$/gm, '') // Remove line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
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
function wrapWithLimit(sql, maxRows) {
    const trimmed = sql.trim().replace(/;\s*$/, '');
    return `SELECT * FROM (${trimmed}) AS _q LIMIT ${maxRows}`;
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateSourceId(name) {
    const hash = crypto.createHash('sha256').update(name).digest('hex').slice(0, 12);
    return `src-${hash}`;
}
const CONNECTOR_MAP = {
    csv: csvConnector,
};
function getConnectorForType(type) {
    return CONNECTOR_MAP[type];
}
/**
 * Check if a query result contains an error encoded in the rows.
 * Some connectors return errors this way instead of throwing.
 * Only matches if the row has ONLY an 'error' property (not a data row with an 'error' column).
 */
function hasErrorRow(result) {
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
    registry = new Map();
    connections = new Map();
    pendingConnections = new Map();
    persistPath;
    /**
     * @param persistPath Optional JSON file for persisting the registry.
     *                    Loaded on construction and saved on every mutation.
     */
    constructor(persistPath) {
        this.persistPath = persistPath || null;
        if (this.persistPath) {
            this.loadRegistry();
        }
    }
    // ─── Registry Persistence ──────────────────────────────────────────────────
    loadRegistry() {
        if (!this.persistPath)
            return;
        try {
            if (fs.existsSync(this.persistPath)) {
                const data = fs.readFileSync(this.persistPath, 'utf-8');
                const entries = JSON.parse(data);
                for (const entry of entries) {
                    this.registry.set(entry.id, entry);
                }
            }
        }
        catch {
            // Corrupted or missing file — start fresh
        }
    }
    saveRegistry() {
        if (!this.persistPath)
            return;
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
        }
        catch {
            // Persistence failure is non-fatal
        }
    }
    // ─── CRUD ──────────────────────────────────────────────────────────────────
    /**
     * Add a data source to the registry.
     * Does NOT connect immediately — connection is lazy on first query or explicit connect().
     */
    async add(name, config) {
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
        const entry = { id, name, type: config.type, config };
        this.registry.set(id, entry);
        this.saveRegistry();
        return { ok: true, entry };
    }
    /**
     * Remove a data source by ID or name. Closes the connection if active.
     */
    async remove(idOrName) {
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
    list() {
        return Array.from(this.registry.values());
    }
    get(idOrName) {
        return this.findEntry(idOrName);
    }
    // ─── Connection Management ─────────────────────────────────────────────────
    async connect(idOrName) {
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
            }
            catch (err) {
                return { ok: false, error: `Connection failed: ${err.message}` };
            }
            finally {
                // Clean up pending promise after completion
                this.pendingConnections.delete(entry.id);
            }
        })();
        this.pendingConnections.set(entry.id, connectPromise);
        return connectPromise;
    }
    async disconnect(idOrName) {
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
    isConnected(idOrName) {
        const entry = this.findEntry(idOrName);
        if (!entry)
            return false;
        return this.connections.has(entry.id);
    }
    // ─── Querying ──────────────────────────────────────────────────────────────
    /**
     * Lazily connect and return the source, or an error result.
     */
    async resolveSource(idOrName) {
        const result = await this.connect(idOrName);
        if (!result.ok || !result.source) {
            return { ok: false, error: result.error ?? `Source not found: ${idOrName}` };
        }
        return { ok: true, source: result.source };
    }
    async getSchema(idOrName) {
        const resolved = await this.resolveSource(idOrName);
        if (!resolved.ok)
            return resolved;
        try {
            const schema = await resolved.source.getSchema();
            return { ok: true, schema };
        }
        catch (err) {
            return { ok: false, error: `Schema introspection failed: ${err.message}` };
        }
    }
    async query(idOrName, sql) {
        // Enforce read-only queries to prevent SQL injection attacks
        if (!isReadOnlySelect(sql)) {
            return { ok: false, error: 'Only SELECT queries are allowed.' };
        }
        const resolved = await this.resolveSource(idOrName);
        if (!resolved.ok)
            return resolved;
        try {
            const result = await resolved.source.executeQuery(sql);
            const errorMsg = hasErrorRow(result);
            if (errorMsg)
                return { ok: false, error: errorMsg };
            return { ok: true, result };
        }
        catch (err) {
            return { ok: false, error: `Query execution failed: ${err.message}` };
        }
    }
    /**
     * Execute a SQL query against a source with safety checks.
     * Only SELECT/WITH queries are allowed. Results are auto-capped at maxRows.
     * Error messages are enriched with available table/column names.
     */
    async querySql(idOrName, sql, maxRows = MAX_RESULT_ROWS) {
        if (!isReadOnlySelect(sql)) {
            return { ok: false, error: 'Only SELECT queries are allowed.' };
        }
        const resolved = await this.resolveSource(idOrName);
        if (!resolved.ok)
            return resolved;
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
        }
        catch (err) {
            const enriched = await this.enrichSqlError(idOrName, err.message);
            return { ok: false, error: `SQL query failed: ${enriched}` };
        }
    }
    /**
     * Advisory SQL-safety pass over a successful query. Best-effort: any failure
     * yields no warnings (never blocks or breaks the query). Gated on a cheap
     * syntactic pre-filter so the type probes only run when a risky term exists.
     */
    async analyzeSqlSafety(source, sql) {
        try {
            const hasDivision = riskyDivisionTerms(sql).length > 0;
            const denoms = divisionDenominators(sql);
            const maybeBareAgg = /\b(?:SUM|AVG|COUNT|MIN|MAX|TOTAL|GROUP_CONCAT|MEDIAN|STDDEV)\s*\(/i.test(sql) && !/\bGROUP\s+BY\b/i.test(sql);
            if (!hasDivision && denoms.length === 0 && !maybeBareAgg)
                return [];
            const schema = await source.getSchema();
            const colToTable = new Map();
            for (const t of schema.tables)
                for (const c of t.columns)
                    if (!colToTable.has(c.name))
                        colToTable.set(c.name, t.name);
            const typeCache = new Map();
            const columnType = async (col) => {
                if (typeCache.has(col))
                    return typeCache.get(col);
                let type;
                const table = colToTable.get(col);
                if (table) {
                    const r = await source.executeQuery(`SELECT typeof("${col}") AS t FROM "${table}" WHERE "${col}" IS NOT NULL LIMIT 1`);
                    const v = r.rows?.[0]?.t;
                    type = typeof v === 'string' ? v : undefined;
                }
                typeCache.set(col, type);
                return type;
            };
            const zeroCache = new Map();
            const columnHasZero = async (col) => {
                if (zeroCache.has(col))
                    return zeroCache.get(col);
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
        }
        catch {
            return [];
        }
    }
    /**
     * Enrich SQLite error messages with available table/column info.
     */
    async enrichSqlError(idOrName, errorMsg) {
        try {
            const schemaResult = await this.getSchema(idOrName);
            if (!schemaResult.ok || !schemaResult.schema)
                return errorMsg;
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
        }
        catch {
            // Schema lookup failed — return original error
        }
        return errorMsg;
    }
    // ─── Cross-Source ──────────────────────────────────────────────────────────
    async getAllSchemas() {
        const results = [];
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
    async closeAll() {
        for (const [, conn] of this.connections) {
            try {
                await conn.close();
            }
            catch {
                // Ignore individual close errors
            }
        }
        this.connections.clear();
    }
    async destroy() {
        await this.closeAll();
        this.registry.clear();
        this.saveRegistry();
    }
    // ─── Internal ──────────────────────────────────────────────────────────────
    /**
     * Find a registry entry by ID, name (case-insensitive), or name-derived ID.
     */
    findEntry(idOrName) {
        const byId = this.registry.get(idOrName);
        if (byId)
            return byId;
        const lowerName = idOrName.toLowerCase();
        for (const entry of this.registry.values()) {
            if (entry.name.toLowerCase() === lowerName) {
                return entry;
            }
        }
        return this.registry.get(generateSourceId(idOrName));
    }
}
