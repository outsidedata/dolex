/**
 * CSV Connector
 *
 * Loads CSV files (single file or directory) into an in-memory SQLite database.
 * Uses papaparse for parsing, better-sqlite3 for in-memory SQL queries.
 * Introspects columns with type inference, sample values, unique/null counts.
 * Detects foreign keys by matching column names across tables.
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Papa from 'papaparse';
import { resolveManifestPath, readManifest, replayManifest } from '../transforms/manifest.js';
import { TransformMetadata } from '../transforms/metadata.js';
import { applyManifest as applyCleanfix, readCleanfixManifest } from '../cleaning/replay.js';
const SAMPLE_LIMIT = 30;
const SAMPLE_DISPLAY_LIMIT = 20;
/**
 * Escape embedded double-quotes in a SQL identifier per SQL standard.
 * Returns just the escaped name, without surrounding quotes.
 */
function escId(name) {
    return name.replace(/"/g, '""');
}
/**
 * Escape and quote a SQL identifier (column/table name) to prevent injection.
 */
function escapeIdentifier(name) {
    return `"${escId(name)}"`;
}
/** True if a raw CSV cell parses as a finite number (used to decide what to
 *  store in a NUMERIC-affinity column; non-numeric cells become NULL). */
function isNumericStr(v) {
    if (typeof v !== 'string')
        return false;
    const t = v.trim();
    if (t === '')
        return false;
    const n = Number(t);
    return Number.isFinite(n);
}
/**
 * Infer a column's semantic type from its name, sample values, and cardinality.
 * Matches the POC's inferColumnType() logic.
 */
function inferColumnType(name, samples, uniqueCount, totalRows) {
    const lower = name.toLowerCase();
    // ID detection
    if (lower === 'id' || (lower.endsWith('id') && uniqueCount > totalRows * 0.5)) {
        if (lower.endsWith('id'))
            return 'id';
    }
    if (lower.endsWith('_id'))
        return 'id';
    // Date detection
    if (lower.includes('date') ||
        lower.includes('time') ||
        lower.includes('year') ||
        lower.includes('timestamp')) {
        return 'date';
    }
    // Numeric detection: >70% of samples parse as numbers
    const numericSamples = samples.filter((s) => s !== '' && !isNaN(Number(s)));
    if (numericSamples.length > samples.length * 0.7) {
        // Year detection: all-integer values in 1900–2100 range → treat as date
        if (numericSamples.length >= 3) {
            const allYearLike = numericSamples.every((s) => {
                const n = Number(s);
                return Number.isInteger(n) && n >= 1900 && n <= 2100;
            });
            if (allYearLike)
                return 'date';
        }
        return 'numeric';
    }
    // Text detection: long strings or very high cardinality relative to row count
    const avgLen = samples.reduce((sum, s) => sum + s.length, 0) / (samples.length || 1);
    if (avgLen > 100 || (uniqueCount > totalRows * 0.9 && avgLen > 50)) {
        return 'text';
    }
    return 'categorical';
}
/**
 * Sanitize a filename into a valid SQL table name.
 */
function toTableName(filename) {
    return filename
        .replace(/\.csv$/i, '')
        .replace(/[^a-zA-Z0-9_]/g, '_');
}
/**
 * Register custom aggregate functions that SQLite lacks natively.
 * Provides: median, stddev, p25, p75, percentile.
 */
function registerCustomAggregates(db) {
    const sortedNums = (values) => values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
    // Accumulate ONLY real numeric values. SQLite NULL arrives as JS null and empty
    // cells as '' — both coerce to 0 via Number(), which would silently count missing
    // values as zero and corrupt median/stddev/cv/mad/percentiles (and disagree with
    // native AVG/COUNT, which ignore NULLs). Skip them BEFORE coercion. Non-numeric
    // strings → NaN → also skipped. (Regression: __tests__/connectors/aggregates.test.ts)
    const pushNum = (acc, val) => {
        if (val === null || val === undefined || val === '')
            return acc;
        const n = Number(val);
        if (Number.isFinite(n))
            acc.push(n);
        return acc;
    };
    const computePercentile = (sorted, p) => {
        if (sorted.length === 0)
            return null;
        if (sorted.length === 1)
            return sorted[0];
        const idx = p * (sorted.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi)
            return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    db.aggregate('median', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => computePercentile(sortedNums(acc), 0.5),
    });
    db.aggregate('stddev', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => {
            const nums = sortedNums(acc);
            if (nums.length === 0)
                return null;
            const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
            const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length;
            return Math.sqrt(variance);
        },
    });
    db.aggregate('p25', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => computePercentile(sortedNums(acc), 0.25),
    });
    db.aggregate('p75', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => computePercentile(sortedNums(acc), 0.75),
    });
    db.aggregate('p10', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => computePercentile(sortedNums(acc), 0.10),
    });
    db.aggregate('p90', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => computePercentile(sortedNums(acc), 0.90),
    });
    // Extended tail percentiles (floor/ceiling extremes) — same shape as p10..p90.
    for (const [name, p] of [['p1', 0.01], ['p5', 0.05], ['p95', 0.95], ['p99', 0.99]]) {
        db.aggregate(name, {
            start: () => [],
            step: (acc, val) => pushNum(acc, val),
            result: (acc) => computePercentile(sortedNums(acc), p),
        });
    }
    // Coefficient of variation — stddev/mean (population). Scale-free dispersion, for
    // comparing variability across different-magnitude metrics. NULL when mean is 0
    // (the ratio is undefined) or there are no values.
    db.aggregate('cv', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => {
            const nums = sortedNums(acc);
            if (nums.length === 0)
                return null;
            const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
            if (mean === 0)
                return null;
            const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length;
            return Math.sqrt(variance) / mean;
        },
    });
    // Median absolute deviation — median(|x - median(x)|). A robust (outlier-resistant)
    // dispersion measure; pairs with median better than stddev does for skewed data.
    db.aggregate('mad', {
        start: () => [],
        step: (acc, val) => pushNum(acc, val),
        result: (acc) => {
            const nums = sortedNums(acc);
            if (nums.length === 0)
                return null;
            const med = computePercentile(nums, 0.5);
            const devs = sortedNums(nums.map((v) => Math.abs(v - med)));
            return computePercentile(devs, 0.5);
        },
    });
}
/**
 * Load CSV files into an in-memory SQLite database and build schema metadata.
 */
function loadCsvs(csvPaths) {
    const db = new Database(':memory:');
    registerCustomAggregates(db);
    const allColumns = [];
    const tables = [];
    const warnings = [];
    for (const { filePath, tableName } of csvPaths) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
        // Report PapaParse errors as warnings
        if (parsed.errors && parsed.errors.length > 0) {
            for (const err of parsed.errors) {
                warnings.push(`CSV parse warning in ${filePath} (row ${err.row}): ${err.message}`);
            }
        }
        let rows = parsed.data;
        if (rows.length === 0) {
            warnings.push(`Skipped empty CSV: ${filePath}`);
            continue;
        }
        const colNames = Object.keys(rows[0]);
        if (colNames.length === 0) {
            warnings.push(`Skipped CSV with no columns: ${filePath}`);
            continue;
        }
        // Infer each column's type up front (from the parsed rows) so the table can
        // be created with the correct SQLite affinity. Stored as plain TEXT, numeric
        // columns would compare LEXICOGRAPHICALLY — MAX('9') > MAX('73'), and
        // ORDER BY/MIN/< all wrong. NUMERIC affinity makes SQLite store and compare
        // them as numbers.
        const colMeta = colNames.map((col) => {
            const distinct = new Set();
            const numericDistinct = new Set();
            const samples = [];
            let nullCount = 0; // undefined/null/\N
            let emptyCount = 0; // ''
            let nonNumericCount = 0; // non-empty values that are not numbers
            // Tally the NON-EMPTY non-numeric tokens (e.g. "Undrafted") so a recurring
            // string sentinel hiding in a numeric column can be surfaced to the auditor —
            // NUMERIC affinity coerces it to NULL, erasing it from the stored data.
            const nonNumericTokens = new Map();
            for (const row of rows) {
                const v = row[col];
                if (v === undefined || v === null || v === '\\N') {
                    nullCount++;
                    continue;
                }
                if (v === '') {
                    emptyCount++;
                    continue;
                }
                if (!distinct.has(v)) {
                    distinct.add(v);
                    if (samples.length < SAMPLE_LIMIT)
                        samples.push(v);
                }
                if (isNumericStr(v))
                    numericDistinct.add(v);
                else {
                    nonNumericCount++;
                    nonNumericTokens.set(v, (nonNumericTokens.get(v) ?? 0) + 1);
                }
            }
            const type = inferColumnType(col, samples, distinct.size, rows.length);
            // Zero-padded codes (zip '00501', '007') look numeric but must stay TEXT
            // so the padding survives — they're identifiers, not measures.
            const hasLeadingZeroCode = samples.some((s) => /^0\d/.test(s));
            const numericAffinity = type === 'numeric' && !hasLeadingZeroCode;
            // In a numeric column, any non-numeric cell (empty, "N/A", text) is a
            // missing value → stored as NULL. Left as TEXT it would re-poison MAX/
            // ORDER BY (SQLite ranks text above all numbers). Counts reflect that.
            const finalNullCount = numericAffinity ? nullCount + emptyCount + nonNumericCount : nullCount;
            const finalUnique = numericAffinity ? numericDistinct.size : distinct.size;
            // The dominant non-empty token coerced to NULL (numeric columns only) — the
            // fingerprint of a string-sentinel affinity trap. Empty strings don't count;
            // they're plain missing values the auditor reports via the null ratio.
            let coercedNonNumeric;
            if (numericAffinity && nonNumericTokens.size > 0) {
                let token = '';
                let count = 0;
                for (const [tok, c] of nonNumericTokens)
                    if (c > count) {
                        token = tok;
                        count = c;
                    }
                coercedNonNumeric = { token, count };
            }
            return { col, type, samples, distinctCount: finalUnique, nullCount: finalNullCount, numericAffinity, coercedNonNumeric };
        });
        const numericCols = new Set(colMeta.filter((m) => m.numericAffinity).map((m) => m.col));
        // Create table with NUMERIC affinity for numeric columns, TEXT otherwise.
        // Use escapeIdentifier to prevent SQL injection via column names with embedded quotes.
        const safeCols = colMeta
            .map((m) => `${escapeIdentifier(m.col)} ${m.numericAffinity ? 'NUMERIC' : 'TEXT'}`)
            .join(', ');
        db.exec(`CREATE TABLE IF NOT EXISTS ${escapeIdentifier(tableName)} (${safeCols})`);
        // Batch insert (NUMERIC-affinity columns coerce numeric strings to numbers)
        const placeholders = colNames.map(() => '?').join(', ');
        const insert = db.prepare(`INSERT INTO ${escapeIdentifier(tableName)} VALUES (${placeholders})`);
        const insertMany = db.transaction((batch) => {
            for (const row of batch) {
                insert.run(...colNames.map((c) => {
                    const val = row[c];
                    if (val === undefined || val === null || val === '\\N')
                        return null;
                    // In a numeric column, any non-numeric cell ('', 'N/A', text) → NULL.
                    // Left as TEXT it would store above all numbers and break MAX/ORDER BY.
                    if (numericCols.has(c) && !isNumericStr(val))
                        return null;
                    return val;
                }));
            }
        });
        insertMany(rows);
        // Profile each column. Type/samples/counts come from the pre-pass above;
        // only numeric stats and categorical top values need the loaded DB.
        const columns = [];
        for (const meta of colMeta) {
            const col = meta.col;
            const type = meta.type;
            let columnStats = undefined;
            let topValues = undefined;
            if (type === 'numeric') {
                const numStmt = db.prepare(`
          SELECT
            MIN(CAST("${escId(col)}" AS REAL)) as min_val,
            MAX(CAST("${escId(col)}" AS REAL)) as max_val,
            AVG(CAST("${escId(col)}" AS REAL)) as mean_val
          FROM "${escId(tableName)}"
          WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
        `);
                const numStats = numStmt.get();
                const sortedStmt = db.prepare(`
          SELECT CAST("${escId(col)}" AS REAL) as val
          FROM "${escId(tableName)}"
          WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
          ORDER BY CAST("${escId(col)}" AS REAL)
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
            else if (type === 'categorical' || type === 'date') {
                const topStmt = db.prepare(`
          SELECT "${escId(col)}" as value, COUNT(*) as count
          FROM "${escId(tableName)}"
          WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
          GROUP BY "${escId(col)}"
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `);
                topValues = topStmt.all();
            }
            const column = {
                name: col,
                type,
                sampleValues: meta.samples.slice(0, SAMPLE_DISPLAY_LIMIT),
                uniqueCount: meta.distinctCount,
                nullCount: meta.nullCount,
                totalCount: rows.length,
                stats: columnStats,
                topValues,
                coercedNonNumeric: meta.coercedNonNumeric,
            };
            columns.push(column);
            allColumns.push({ table: tableName, col: column });
        }
        tables.push({
            name: tableName,
            columns,
            rowCount: rows.length,
        });
    }
    // Detect foreign keys by matching column names across tables
    const foreignKeys = [];
    for (const entry of allColumns) {
        const colLower = entry.col.name.toLowerCase();
        if (entry.col.type === 'id' ||
            colLower.endsWith('_id') ||
            colLower.endsWith('id')) {
            for (const other of allColumns) {
                if (other.table !== entry.table && other.col.name === entry.col.name) {
                    // Avoid duplicate pairs
                    const exists = foreignKeys.some((fk) => (fk.fromTable === entry.table &&
                        fk.fromColumn === entry.col.name &&
                        fk.toTable === other.table &&
                        fk.toColumn === other.col.name) ||
                        (fk.fromTable === other.table &&
                            fk.fromColumn === other.col.name &&
                            fk.toTable === entry.table &&
                            fk.toColumn === entry.col.name));
                    if (!exists) {
                        foreignKeys.push({
                            fromTable: entry.table,
                            fromColumn: entry.col.name,
                            toTable: other.table,
                            toColumn: other.col.name,
                        });
                    }
                }
            }
        }
    }
    return { db, tables, foreignKeys, warnings };
}
class CsvConnectedSource {
    id;
    name;
    type = 'csv';
    db;
    schema;
    constructor(id, name, db, schema) {
        this.id = id;
        this.name = name;
        this.db = db;
        this.schema = schema;
    }
    async getSchema() {
        return this.schema;
    }
    invalidateSchema() {
        if (!this.schema)
            return;
        // Refresh each table's column list from the live database,
        // preserving existing column metadata and adding any new columns.
        for (const table of this.schema.tables) {
            const liveCols = this.db.prepare(`PRAGMA table_info("${table.name}")`).all();
            const liveColNames = liveCols.map((r) => r.name);
            const existingNames = new Set(table.columns.map(c => c.name));
            // Add any new columns not already in the schema
            for (const colName of liveColNames) {
                if (!existingNames.has(colName)) {
                    table.columns.push(this.profileNewColumn(table.name, colName, table.rowCount));
                }
            }
            // Remove columns that no longer exist in the database
            const liveSet = new Set(liveColNames);
            table.columns = table.columns.filter(c => liveSet.has(c.name));
        }
    }
    profileNewColumn(tableName, col, rowCount) {
        const sampleStmt = this.db.prepare(`SELECT DISTINCT "${escId(col)}" FROM "${escId(tableName)}" WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != '' LIMIT ${SAMPLE_LIMIT}`);
        const samples = sampleStmt.all().map((r) => String(r[col]));
        const countStmt = this.db.prepare(`SELECT COUNT(DISTINCT "${escId(col)}") as cnt, COUNT(*) - COUNT("${escId(col)}") as nulls, COUNT(*) as total FROM "${escId(tableName)}"`);
        const stats = countStmt.get();
        const type = inferColumnType(col, samples, stats.cnt, rowCount);
        let columnStats = undefined;
        let topValues = undefined;
        if (type === 'numeric') {
            const numStmt = this.db.prepare(`
        SELECT MIN(CAST("${escId(col)}" AS REAL)) as min_val, MAX(CAST("${escId(col)}" AS REAL)) as max_val, AVG(CAST("${escId(col)}" AS REAL)) as mean_val
        FROM "${escId(tableName)}" WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
      `);
            const numStats = numStmt.get();
            const sortedStmt = this.db.prepare(`
        SELECT CAST("${escId(col)}" AS REAL) as val FROM "${escId(tableName)}"
        WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != '' ORDER BY CAST("${escId(col)}" AS REAL)
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
                columnStats = {
                    min: numStats.min_val, max: numStats.max_val, mean: numStats.mean_val,
                    median: percentile(sorted, 50), stddev: Math.sqrt(variance),
                    p25: percentile(sorted, 25), p75: percentile(sorted, 75),
                };
            }
        }
        else if (type === 'categorical' || type === 'date') {
            const topStmt = this.db.prepare(`
        SELECT "${escId(col)}" as value, COUNT(*) as count FROM "${escId(tableName)}"
        WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != '' GROUP BY "${escId(col)}" ORDER BY COUNT(*) DESC LIMIT 10
      `);
            topValues = topStmt.all();
        }
        return {
            name: col, type,
            sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
            uniqueCount: stats.cnt, nullCount: stats.nulls, totalCount: stats.total,
            stats: columnStats, topValues,
        };
    }
    async getSampleRows(tableName, count = 5) {
        const total = this.schema.tables.find(t => t.name === tableName)?.rowCount ?? 0;
        if (total === 0)
            return [];
        if (total <= count) {
            const stmt = this.db.prepare(`SELECT * FROM "${escId(tableName)}"`);
            return stmt.all();
        }
        const stmt = this.db.prepare(`
      SELECT * FROM "${escId(tableName)}"
      WHERE rowid IN (
        SELECT rowid FROM (
          SELECT rowid, NTILE(${count}) OVER (ORDER BY rowid) as bucket
          FROM "${escId(tableName)}"
        ) GROUP BY bucket
      )
      LIMIT ${count}
    `);
        return stmt.all();
    }
    async executeQuery(sql) {
        try {
            const stmt = this.db.prepare(sql);
            const rows = stmt.all();
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            const typeMap = new Map();
            for (const table of this.schema.tables) {
                for (const col of table.columns) {
                    typeMap.set(col.name, col.type);
                    typeMap.set(`${table.name}_${col.name}`, col.type);
                }
            }
            for (const row of rows) {
                for (const col of columns) {
                    if (typeMap.get(col) === 'numeric' && typeof row[col] === 'string') {
                        const num = Number(row[col]);
                        if (!isNaN(num))
                            row[col] = num;
                    }
                }
            }
            return { columns, rows };
        }
        catch (err) {
            return { columns: [], rows: [{ error: err.message }] };
        }
    }
    /** Get the underlying SQLite database handle. */
    getDatabase() {
        return this.db;
    }
    /**
     * CSV derives columns the way it always has: ALTER TABLE + rowid-keyed UPDATE on the
     * in-memory SQLite db (getDatabase still drives the actual work). Byte-identical behavior.
     */
    derivationCapabilities() {
        return { canDerive: true, materialization: 'sqlite-alter', rowKey: 'rowid', serverSideQueryable: true };
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
export const csvConnector = {
    type: 'csv',
    async test(config) {
        const csvConfig = config;
        if (csvConfig.type !== 'csv') {
            return { ok: false, error: 'Config type must be "csv"' };
        }
        try {
            const stat = fs.statSync(csvConfig.path);
            if (stat.isDirectory()) {
                const csvFiles = fs.readdirSync(csvConfig.path).filter((f) => f.endsWith('.csv'));
                if (csvFiles.length === 0) {
                    return { ok: false, error: `No CSV files found in directory: ${csvConfig.path}` };
                }
                return { ok: true };
            }
            else if (stat.isFile() && csvConfig.path.endsWith('.csv')) {
                return { ok: true };
            }
            else {
                return { ok: false, error: `Path is not a CSV file or directory: ${csvConfig.path}` };
            }
        }
        catch (err) {
            return { ok: false, error: `Cannot access path: ${err.message}` };
        }
    },
    async connect(config) {
        const csvConfig = config;
        if (csvConfig.type !== 'csv') {
            throw new Error('Config type must be "csv"');
        }
        const stat = fs.statSync(csvConfig.path);
        let csvPaths;
        if (stat.isDirectory()) {
            const files = fs.readdirSync(csvConfig.path).filter((f) => f.endsWith('.csv'));
            if (files.length === 0) {
                throw new Error(`No CSV files found in directory: ${csvConfig.path}`);
            }
            csvPaths = files.map((f) => ({
                filePath: path.join(csvConfig.path, f),
                tableName: toTableName(f),
            }));
        }
        else {
            csvPaths = [
                {
                    filePath: csvConfig.path,
                    tableName: toTableName(path.basename(csvConfig.path)),
                },
            ];
        }
        // If a `<base>.cleanfix.json` sits next to a CSV, load the manifest-cleaned columns
        // instead of the raw ones — so recon/query never re-hit a footgun the offline autoclean
        // already solved. Replaying over the CURRENT raw file gives newly-arrived rows the same
        // treatment; the original CSV is never written. Best-effort: any error → raw load.
        csvPaths = csvPaths.map((cp) => {
            const manifest = readCleanfixManifest(cp.filePath);
            if (!manifest)
                return cp;
            try {
                const { rows } = applyCleanfix(cp.filePath, manifest, false); // cleaned columns, no _raw noise
                const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dolex-cleanfix-'));
                const cleanedPath = path.join(dir, path.basename(cp.filePath));
                fs.writeFileSync(cleanedPath, Papa.unparse(rows));
                return { ...cp, filePath: cleanedPath }; // tableName stays derived from the original file
            }
            catch (err) {
                console.warn(`[csv-connector] cleanfix replay failed for ${cp.filePath}, loading raw: ${err?.message}`);
                return cp;
            }
        });
        const { db, tables, foreignKeys, warnings } = loadCsvs(csvPaths);
        if (warnings.length > 0) {
            for (const w of warnings) {
                console.warn(`[csv-connector] ${w}`);
            }
        }
        const sourceName = stat.isDirectory()
            ? path.basename(csvConfig.path)
            : path.basename(csvConfig.path, '.csv');
        const id = `csv-${sourceName}-${Date.now()}`;
        const schema = {
            tables,
            foreignKeys,
            source: {
                id,
                type: 'csv',
                name: sourceName,
                config: csvConfig,
            },
        };
        const source = new CsvConnectedSource(id, sourceName, db, schema);
        // Restore any persisted derived columns from the .dolex.json manifest so
        // they survive process restarts (used by both the MCP server and the CLI).
        applyManifest(db, csvConfig, tables.map((t) => t.name), source);
        return source;
    },
};
/**
 * Read the source's .dolex.json manifest (if any) and replay its derived
 * columns into the live database, refreshing the schema for any that materialize.
 * Best-effort: a missing or invalid manifest is a no-op.
 */
function applyManifest(db, config, tableNames, source) {
    const manifest = readManifest(resolveManifestPath(config));
    if (!manifest)
        return;
    const metadata = new TransformMetadata(db);
    metadata.init();
    let restoredAny = false;
    for (const tableName of tableNames) {
        const { replayed } = replayManifest(db, metadata, manifest, tableName);
        if (replayed.length > 0)
            restoredAny = true;
    }
    if (restoredAny)
        source.invalidateSchema();
}
