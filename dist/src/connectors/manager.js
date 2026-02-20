/**
 * Source Manager
 *
 * Manages multiple connected data sources with:
 * - CRUD operations (add/remove/list)
 * - In-memory registry with optional JSON file persistence
 * - Connector lookup by type
 * - Connection caching (lazy connect on first query)
 * - Cross-source query routing by name
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import { compileDsl, hasJsAggregates, hasWindowFunctions } from './dsl-compiler.js';
import { validateDsl, validateDslWithJoins } from './dsl-validator.js';
import { csvConnector } from './csv.js';
import { executeJsAggregation, executeJsAggregationWithWindows } from './js-aggregation.js';
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
 */
function hasErrorRow(result) {
    if (result.rows.length === 1 && result.rows[0]?.error) {
        return result.rows[0].error;
    }
    return null;
}
// ─── Source Manager ──────────────────────────────────────────────────────────
export class SourceManager {
    registry = new Map();
    connections = new Map();
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
            fs.writeFileSync(this.persistPath, JSON.stringify(entries, null, 2), 'utf-8');
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
        }
        catch (err) {
            return { ok: false, error: `Connection failed: ${err.message}` };
        }
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
     * Consolidates the repeated connect-or-fail pattern used by getSchema/query/queryDsl.
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
     * Execute a DSL query against a specific source table.
     * Validates against schema, compiles to SQL (or JS aggregation fallback),
     * executes, and returns rows.
     */
    async queryDsl(idOrName, table, dslQuery) {
        const resolved = await this.resolveSource(idOrName);
        if (!resolved.ok)
            return resolved;
        try {
            const validationError = await this.validateDslQuery(idOrName, table, dslQuery);
            if (validationError)
                return { ok: false, error: validationError };
            const needsJsAgg = hasJsAggregates(dslQuery);
            const needsWindows = hasWindowFunctions(dslQuery);
            if (needsJsAgg && needsWindows) {
                return executeJsAggregationWithWindows(resolved.source, table, dslQuery, 'sqlite');
            }
            if (needsJsAgg) {
                return executeJsAggregation(resolved.source, table, dslQuery, 'sqlite');
            }
            // Pure SQL path — compileDsl handles CTE wrapping for window functions
            const sql = compileDsl(table, dslQuery, 'sqlite');
            const result = await resolved.source.executeQuery(sql);
            const errorMsg = hasErrorRow(result);
            if (errorMsg)
                return { ok: false, error: errorMsg };
            return {
                ok: true,
                rows: result.rows,
                columns: result.columns,
                totalRows: result.rows.length,
                truncated: false,
            };
        }
        catch (err) {
            return { ok: false, error: `DSL query failed: ${err.message}` };
        }
    }
    /**
     * Validate a DSL query against the source schema. Returns an error message
     * if validation fails, or null if the query is valid.
     */
    async validateDslQuery(idOrName, table, dslQuery) {
        const schemaResult = await this.getSchema(idOrName);
        if (!schemaResult.ok || !schemaResult.schema)
            return null;
        const schema = schemaResult.schema;
        if (dslQuery.join && dslQuery.join.length > 0) {
            const validation = validateDslWithJoins(schema, table, dslQuery);
            return validation.ok ? null : validation.error ?? 'Validation failed';
        }
        const tableSchema = schema.tables.find(t => t.name === table);
        if (!tableSchema) {
            const available = schema.tables.map(t => t.name).join(', ');
            return `Table "${table}" not found. Available: ${available}`;
        }
        const validation = validateDsl(tableSchema, dslQuery);
        return validation.ok ? null : validation.error ?? 'Validation failed';
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
//# sourceMappingURL=manager.js.map