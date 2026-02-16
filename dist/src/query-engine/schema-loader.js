/**
 * Schema Loader — Loads and analyzes data schemas from SQLite databases.
 *
 * Extracted from loadDataset() and inferColumnType() in the POC.
 * Works with DataSchema/DataTable/DataColumn types from types.ts.
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'papaparse';
/**
 * Infer column type from name, sample values, and cardinality.
 */
export function inferColumnType(name, samples, uniqueCount, totalRows) {
    const lower = name.toLowerCase();
    // ID detection
    if (lower === 'id' || lower.endsWith('_id') || (lower.endsWith('id') && uniqueCount > totalRows * 0.5)) {
        if (lower.endsWith('id'))
            return 'id';
    }
    // Date detection
    if (lower.includes('date') || lower.includes('time') || lower.includes('year') || lower.includes('timestamp')) {
        return 'date';
    }
    // Numeric detection — check if samples are numbers
    const numericSamples = samples.filter(s => s !== '' && !isNaN(Number(s)));
    if (numericSamples.length > samples.length * 0.7) {
        return 'numeric';
    }
    return 'categorical';
}
/**
 * Analyze a single table's columns in the database.
 */
function analyzeTableColumns(db, tableName, totalRows) {
    const columns = [];
    // Get column names from pragma
    const colInfos = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    for (const colInfo of colInfos) {
        const col = colInfo.name;
        const sampleStmt = db.prepare(`SELECT DISTINCT "${col}" FROM "${tableName}" WHERE "${col}" IS NOT NULL AND "${col}" != '' LIMIT 30`);
        const samples = sampleStmt.all().map((r) => String(r[col]));
        const countStmt = db.prepare(`SELECT COUNT(DISTINCT "${col}") as cnt, COUNT(*) - COUNT("${col}") as nulls, COUNT(*) as total FROM "${tableName}"`);
        const stats = countStmt.get();
        const type = inferColumnType(col, samples, stats.cnt, totalRows);
        columns.push({
            name: col,
            type,
            sampleValues: samples.slice(0, 20),
            uniqueCount: stats.cnt,
            nullCount: stats.nulls,
            totalCount: stats.total,
        });
    }
    return columns;
}
/**
 * Detect foreign keys by matching column names across tables.
 */
function detectForeignKeys(tables) {
    const foreignKeys = [];
    for (const table of tables) {
        for (const col of table.columns) {
            if (col.type === 'id' || col.name.toLowerCase().endsWith('id') || col.name.toLowerCase().endsWith('_id')) {
                for (const otherTable of tables) {
                    if (otherTable.name !== table.name) {
                        const matchingCol = otherTable.columns.find(c => c.name === col.name);
                        if (matchingCol) {
                            foreignKeys.push({
                                fromTable: table.name,
                                fromColumn: col.name,
                                toTable: otherTable.name,
                                toColumn: matchingCol.name,
                            });
                        }
                    }
                }
            }
        }
    }
    return foreignKeys;
}
/**
 * Load a DataSchema from an existing SQLite database.
 *
 * Queries the database for table and column metadata, infers types,
 * and detects foreign keys by column name matching.
 */
export function loadSchema(db, source) {
    const tableRows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all();
    const tables = [];
    for (const { name: tableName } of tableRows) {
        const countResult = db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get();
        const rowCount = countResult.cnt;
        const columns = analyzeTableColumns(db, tableName, rowCount);
        tables.push({
            name: tableName,
            columns,
            rowCount,
        });
    }
    const foreignKeys = detectForeignKeys(tables);
    return { tables, foreignKeys, source };
}
/**
 * Load CSV files from a directory into an in-memory SQLite database,
 * then return both the database and its schema.
 *
 * Each CSV file becomes a table (filename without extension, sanitized).
 * Large tables are capped at maxRows for performance.
 */
export function loadCsvToSqlite(csvDir, source, options) {
    const maxRows = options?.maxRows ?? 50000;
    const db = new Database(':memory:');
    const csvFiles = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
    for (const file of csvFiles) {
        const tableName = file.replace('.csv', '').replace(/[^a-zA-Z0-9_]/g, '_');
        const raw = fs.readFileSync(path.join(csvDir, file), 'utf-8');
        const parsed = parse(raw, { header: true, skipEmptyLines: true });
        let rows = parsed.data;
        // Cap large tables
        if (rows.length > maxRows) {
            rows = rows.slice(0, maxRows);
        }
        if (rows.length === 0)
            continue;
        const colNames = Object.keys(rows[0]);
        // Create table
        const safeCols = colNames.map(c => `"${c}" TEXT`).join(', ');
        db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (${safeCols})`);
        // Insert rows in a transaction
        const placeholders = colNames.map(() => '?').join(', ');
        const insert = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);
        const insertMany = db.transaction((rowBatch) => {
            for (const row of rowBatch) {
                insert.run(...colNames.map(c => row[c] ?? null));
            }
        });
        insertMany(rows);
    }
    const schema = loadSchema(db, source);
    return { db, schema };
}
//# sourceMappingURL=schema-loader.js.map