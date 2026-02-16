/**
 * SQLite Connector
 *
 * Opens an existing SQLite database file in read-only mode.
 * Introspects schema via PRAGMA table_info / PRAGMA foreign_key_list.
 * Analyzes columns with sample values and type inference from actual data.
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
const SAMPLE_LIMIT = 30;
const SAMPLE_DISPLAY_LIMIT = 20;
/**
 * Map SQLite declared type to our column type system.
 * Falls back to inspecting actual data if the declared type is ambiguous.
 */
function mapSqliteType(declaredType, columnName, samples, uniqueCount, totalRows) {
    const lower = columnName.toLowerCase();
    // ID detection by name
    if (lower === 'id' || lower === 'rowid')
        return 'id';
    if (lower.endsWith('_id') || (lower.endsWith('id') && uniqueCount > totalRows * 0.5)) {
        return 'id';
    }
    // Check declared type
    const dt = (declaredType || '').toUpperCase();
    if (dt.includes('INT') || dt.includes('REAL') || dt.includes('FLOAT') || dt.includes('DOUBLE') || dt.includes('NUMERIC') || dt.includes('DECIMAL')) {
        // But if it's named like an ID, keep it as ID
        if (lower.endsWith('_id'))
            return 'id';
        return 'numeric';
    }
    if (dt.includes('DATE') || dt.includes('TIME') || dt.includes('TIMESTAMP')) {
        return 'date';
    }
    // Date detection by name
    if (lower.includes('date') || lower.includes('time') || lower.includes('year') || lower.includes('timestamp')) {
        return 'date';
    }
    // TEXT/VARCHAR/BLOB — infer from actual samples
    if (dt.includes('TEXT') || dt.includes('VARCHAR') || dt.includes('CHAR') || dt.includes('CLOB') || dt === '' || dt === 'BLOB') {
        // Numeric detection from samples
        const numericSamples = samples.filter((s) => s !== '' && s !== null && !isNaN(Number(s)));
        if (samples.length > 0 && numericSamples.length > samples.length * 0.7) {
            return 'numeric';
        }
        // Text detection: long values
        const avgLen = samples.reduce((sum, s) => sum + (s?.length || 0), 0) / (samples.length || 1);
        if (avgLen > 100 || (uniqueCount > totalRows * 0.9 && avgLen > 50)) {
            return 'text';
        }
        return 'categorical';
    }
    // Fallback: try numeric detection from samples
    const numericSamples = samples.filter((s) => s !== '' && s !== null && !isNaN(Number(s)));
    if (samples.length > 0 && numericSamples.length > samples.length * 0.7) {
        return 'numeric';
    }
    return 'categorical';
}
/**
 * Get all user tables from a SQLite database (excludes internal tables).
 */
function getUserTables(db) {
    const rows = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
        .all();
    return rows.map((r) => r.name);
}
class SqliteConnectedSource {
    id;
    name;
    type = 'sqlite';
    db;
    dbPath;
    cachedSchema = null;
    constructor(id, name, db, dbPath) {
        this.id = id;
        this.name = name;
        this.db = db;
        this.dbPath = dbPath;
    }
    async getSchema() {
        if (this.cachedSchema)
            return this.cachedSchema;
        const tableNames = getUserTables(this.db);
        const tables = [];
        const foreignKeys = [];
        for (const tableName of tableNames) {
            // Get row count
            const countRow = this.db
                .prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`)
                .get();
            const rowCount = countRow.cnt;
            // Get column info via PRAGMA
            const pragmaRows = this.db
                .prepare(`PRAGMA table_info("${tableName}")`)
                .all();
            const columns = [];
            for (const pragma of pragmaRows) {
                // Sample values
                const sampleStmt = this.db.prepare(`SELECT DISTINCT "${pragma.name}" FROM "${tableName}" WHERE "${pragma.name}" IS NOT NULL LIMIT ${SAMPLE_LIMIT}`);
                const samples = sampleStmt
                    .all()
                    .map((r) => String(r[pragma.name]));
                // Stats
                const statsStmt = this.db.prepare(`SELECT COUNT(DISTINCT "${pragma.name}") as cnt, COUNT(*) - COUNT("${pragma.name}") as nulls, COUNT(*) as total FROM "${tableName}"`);
                const stats = statsStmt.get();
                const type = mapSqliteType(pragma.type, pragma.name, samples, stats.cnt, rowCount);
                // Rich profiling
                let columnStats = undefined;
                let topValues = undefined;
                if (type === 'numeric') {
                    try {
                        const numStmt = this.db.prepare(`
              SELECT
                MIN(CAST("${pragma.name}" AS REAL)) as min_val,
                MAX(CAST("${pragma.name}" AS REAL)) as max_val,
                AVG(CAST("${pragma.name}" AS REAL)) as mean_val
              FROM "${tableName}"
              WHERE "${pragma.name}" IS NOT NULL
            `);
                        const numStats = numStmt.get();
                        const sortedStmt = this.db.prepare(`
              SELECT CAST("${pragma.name}" AS REAL) as val
              FROM "${tableName}"
              WHERE "${pragma.name}" IS NOT NULL
              ORDER BY CAST("${pragma.name}" AS REAL)
            `);
                        const sorted = sortedStmt.all().map((r) => r.val);
                        const n = sorted.length;
                        if (n > 0) {
                            const percentile = (arr, p) => {
                                const idx = (p / 100) * (arr.length - 1);
                                const lo = Math.floor(idx);
                                const hi = Math.ceil(idx);
                                return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
                            };
                            const mean = numStats.mean_val ?? 0;
                            const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
                            const stddev = Math.sqrt(variance);
                            columnStats = {
                                min: numStats.min_val,
                                max: numStats.max_val,
                                mean: numStats.mean_val,
                                median: percentile(sorted, 50),
                                stddev,
                                p25: percentile(sorted, 25),
                                p75: percentile(sorted, 75),
                            };
                        }
                    }
                    catch {
                        // Profiling failure is non-fatal
                    }
                }
                else if (type === 'categorical' || type === 'date') {
                    try {
                        const topStmt = this.db.prepare(`
              SELECT "${pragma.name}" as value, COUNT(*) as count
              FROM "${tableName}"
              WHERE "${pragma.name}" IS NOT NULL
              GROUP BY "${pragma.name}"
              ORDER BY COUNT(*) DESC
              LIMIT 10
            `);
                        topValues = topStmt.all();
                    }
                    catch {
                        // Profiling failure is non-fatal
                    }
                }
                columns.push({
                    name: pragma.name,
                    type,
                    sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
                    uniqueCount: stats.cnt,
                    nullCount: stats.nulls,
                    totalCount: stats.total,
                    stats: columnStats,
                    topValues,
                });
            }
            tables.push({ name: tableName, columns, rowCount });
            // Get foreign keys via PRAGMA
            const fkRows = this.db
                .prepare(`PRAGMA foreign_key_list("${tableName}")`)
                .all();
            for (const fk of fkRows) {
                foreignKeys.push({
                    fromTable: tableName,
                    fromColumn: fk.from,
                    toTable: fk.table,
                    toColumn: fk.to,
                });
            }
        }
        this.cachedSchema = {
            tables,
            foreignKeys,
            source: {
                id: this.id,
                type: 'sqlite',
                name: this.name,
                config: { type: 'sqlite', path: this.dbPath },
            },
        };
        return this.cachedSchema;
    }
    async getSampleRows(tableName, count = 5) {
        try {
            const countRow = this.db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get();
            const total = countRow.cnt;
            if (total === 0)
                return [];
            if (total <= count) {
                return this.db.prepare(`SELECT * FROM "${tableName}"`).all();
            }
            const stmt = this.db.prepare(`
        SELECT * FROM "${tableName}"
        WHERE rowid IN (
          SELECT rowid FROM (
            SELECT rowid, NTILE(${count}) OVER (ORDER BY rowid) as bucket
            FROM "${tableName}"
          ) GROUP BY bucket
        )
        LIMIT ${count}
      `);
            return stmt.all();
        }
        catch {
            return [];
        }
    }
    async executeQuery(sql) {
        try {
            const stmt = this.db.prepare(sql);
            const rows = stmt.all();
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            return { columns, rows };
        }
        catch (err) {
            return { columns: [], rows: [{ error: err.message }] };
        }
    }
    async close() {
        try {
            this.db.close();
        }
        catch {
            // Already closed, ignore
        }
    }
}
export const sqliteConnector = {
    type: 'sqlite',
    async test(config) {
        const sqliteConfig = config;
        if (sqliteConfig.type !== 'sqlite') {
            return { ok: false, error: 'Config type must be "sqlite"' };
        }
        try {
            if (!fs.existsSync(sqliteConfig.path)) {
                return { ok: false, error: `Database file not found: ${sqliteConfig.path}` };
            }
            const stat = fs.statSync(sqliteConfig.path);
            if (!stat.isFile()) {
                return { ok: false, error: `Path is not a file: ${sqliteConfig.path}` };
            }
            // Try opening read-only to verify it's a valid SQLite file
            const db = new Database(sqliteConfig.path, { readonly: true });
            const tables = getUserTables(db);
            db.close();
            if (tables.length === 0) {
                return { ok: false, error: 'Database contains no tables' };
            }
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: `Cannot open SQLite database: ${err.message}` };
        }
    },
    async connect(config) {
        const sqliteConfig = config;
        if (sqliteConfig.type !== 'sqlite') {
            throw new Error('Config type must be "sqlite"');
        }
        if (!fs.existsSync(sqliteConfig.path)) {
            throw new Error(`Database file not found: ${sqliteConfig.path}`);
        }
        const db = new Database(sqliteConfig.path, { readonly: true });
        const sourceName = path.basename(sqliteConfig.path, path.extname(sqliteConfig.path));
        const id = `sqlite-${sourceName}-${Date.now()}`;
        return new SqliteConnectedSource(id, sourceName, db, sqliteConfig.path);
    },
};
//# sourceMappingURL=sqlite.js.map