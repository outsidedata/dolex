/**
 * PostgreSQL Connector
 *
 * Connects to a PostgreSQL database via the `pg` library.
 * Introspects schema via information_schema views.
 * Detects foreign keys from database constraints.
 * Maps Postgres types to our column type system.
 */
import pg from 'pg';
const { Client } = pg;
const SAMPLE_LIMIT = 30;
const SAMPLE_DISPLAY_LIMIT = 20;
/**
 * Map a PostgreSQL data_type (from information_schema) to our column type system.
 */
function mapPostgresType(pgType, columnName, uniqueCount, totalRows) {
    const lower = columnName.toLowerCase();
    const typeLower = pgType.toLowerCase();
    // ID detection by name
    if (lower === 'id' || lower === 'rowid')
        return 'id';
    if (lower.endsWith('_id'))
        return 'id';
    // Serial / identity types -> id
    if (typeLower.includes('serial') || typeLower.includes('bigserial')) {
        return 'id';
    }
    // Numeric types
    if (typeLower.includes('integer') ||
        typeLower.includes('int') ||
        typeLower === 'smallint' ||
        typeLower === 'bigint' ||
        typeLower.includes('float') ||
        typeLower.includes('real') ||
        typeLower.includes('double') ||
        typeLower.includes('numeric') ||
        typeLower.includes('decimal') ||
        typeLower === 'money') {
        // But if named like an ID with high cardinality, treat as ID
        if (lower.endsWith('id') && uniqueCount > totalRows * 0.5) {
            return 'id';
        }
        return 'numeric';
    }
    // Date/time types
    if (typeLower.includes('timestamp') ||
        typeLower === 'date' ||
        typeLower.includes('time') ||
        typeLower === 'interval') {
        return 'date';
    }
    // Date detection by column name
    if (lower.includes('date') ||
        lower.includes('time') ||
        lower.includes('year') ||
        lower.includes('timestamp')) {
        return 'date';
    }
    // Boolean -> categorical
    if (typeLower === 'boolean' || typeLower === 'bool') {
        return 'categorical';
    }
    // Text types: determine categorical vs text by length heuristic
    if (typeLower.includes('varchar') ||
        typeLower.includes('character varying') ||
        typeLower.includes('char') ||
        typeLower === 'text' ||
        typeLower === 'name' ||
        typeLower === 'citext') {
        // High cardinality + text type -> likely free text
        if (typeLower === 'text' && uniqueCount > totalRows * 0.9) {
            return 'text';
        }
        return 'categorical';
    }
    // JSON types -> text
    if (typeLower === 'json' || typeLower === 'jsonb') {
        return 'text';
    }
    // UUID -> id
    if (typeLower === 'uuid') {
        return 'id';
    }
    // Array types -> text
    if (typeLower === 'array' || typeLower.startsWith('_')) {
        return 'text';
    }
    // Enum types -> categorical
    if (typeLower === 'user-defined') {
        return 'categorical';
    }
    return 'categorical';
}
/**
 * Build a pg Client from our config shape.
 */
function buildClient(config) {
    return new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
}
class PostgresConnectedSource {
    id;
    name;
    type = 'postgres';
    client;
    config;
    cachedSchema = null;
    constructor(id, name, client, config) {
        this.id = id;
        this.name = name;
        this.client = client;
        this.config = config;
    }
    async getSchema() {
        if (this.cachedSchema)
            return this.cachedSchema;
        // Get all user tables (exclude system schemas)
        const tablesResult = await this.client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
        const tables = [];
        for (const tableRow of tablesResult.rows) {
            const tableName = tableRow.table_name;
            // Get row count
            const countResult = await this.client.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
            const rowCount = parseInt(countResult.rows[0].cnt, 10);
            // Get columns from information_schema
            const columnsResult = await this.client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
            const columns = [];
            for (const colRow of columnsResult.rows) {
                const colName = colRow.column_name;
                const pgType = colRow.data_type;
                // Get sample values
                let samples = [];
                try {
                    const sampleResult = await this.client.query(`SELECT DISTINCT "${colName}"::text AS val FROM "${tableName}" WHERE "${colName}" IS NOT NULL LIMIT ${SAMPLE_LIMIT}`);
                    samples = sampleResult.rows.map((r) => r.val);
                }
                catch {
                    // Some types may fail to cast to text; skip samples
                }
                // Get stats
                let uniqueCount = 0;
                let nullCount = 0;
                let totalCount = rowCount;
                try {
                    const statsResult = await this.client.query(`SELECT COUNT(DISTINCT "${colName}") as uniq, COUNT(*) - COUNT("${colName}") as nulls, COUNT(*) as total FROM "${tableName}"`);
                    uniqueCount = parseInt(statsResult.rows[0].uniq, 10);
                    nullCount = parseInt(statsResult.rows[0].nulls, 10);
                    totalCount = parseInt(statsResult.rows[0].total, 10);
                }
                catch {
                    // Fallback
                }
                const type = mapPostgresType(pgType, colName, uniqueCount, rowCount);
                columns.push({
                    name: colName,
                    type,
                    sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
                    uniqueCount,
                    nullCount,
                    totalCount,
                });
            }
            tables.push({ name: tableName, columns, rowCount });
        }
        // Get foreign keys from constraints
        const foreignKeys = await this.getForeignKeys();
        this.cachedSchema = {
            tables,
            foreignKeys,
            source: {
                id: this.id,
                type: 'postgres',
                name: this.name,
                config: {
                    ...this.config,
                    password: '***', // Don't store password in schema output
                },
            },
        };
        return this.cachedSchema;
    }
    async getForeignKeys() {
        const result = await this.client.query(`
      SELECT
        kcu.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY kcu.table_name, kcu.column_name
    `);
        return result.rows.map((r) => ({
            fromTable: r.from_table,
            fromColumn: r.from_column,
            toTable: r.to_table,
            toColumn: r.to_column,
        }));
    }
    async getSampleRows(tableName, count = 5) {
        try {
            const result = await this.client.query(`SELECT * FROM "${tableName}" ORDER BY random() LIMIT $1`, [count]);
            return result.rows;
        }
        catch {
            return [];
        }
    }
    async executeQuery(sql) {
        try {
            const result = await this.client.query(sql);
            const columns = result.fields.map((f) => f.name);
            return { columns, rows: result.rows };
        }
        catch (err) {
            return { columns: [], rows: [{ error: err.message }] };
        }
    }
    async close() {
        try {
            await this.client.end();
        }
        catch {
            // Already closed, ignore
        }
    }
}
export const postgresConnector = {
    type: 'postgres',
    async test(config) {
        const pgConfig = config;
        if (pgConfig.type !== 'postgres') {
            return { ok: false, error: 'Config type must be "postgres"' };
        }
        const client = buildClient(pgConfig);
        try {
            await client.connect();
            // Run a simple test query
            await client.query('SELECT 1');
            await client.end();
            return { ok: true };
        }
        catch (err) {
            try {
                await client.end();
            }
            catch {
                // Ignore cleanup error
            }
            return { ok: false, error: `PostgreSQL connection failed: ${err.message}` };
        }
    },
    async connect(config) {
        const pgConfig = config;
        if (pgConfig.type !== 'postgres') {
            throw new Error('Config type must be "postgres"');
        }
        const client = buildClient(pgConfig);
        await client.connect();
        const sourceName = pgConfig.database;
        const id = `postgres-${pgConfig.host}-${pgConfig.database}-${Date.now()}`;
        return new PostgresConnectedSource(id, sourceName, client, pgConfig);
    },
};
//# sourceMappingURL=postgres.js.map