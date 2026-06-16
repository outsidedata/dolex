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
import * as path from 'path';
import Papa from 'papaparse';
import type {
  DataSourceType,
  DataSourceConfig,
  CsvSourceConfig,
  DataSchema,
  DataTable,
  DataColumn,
  ForeignKey,
} from '../types.js';
import type { DataConnector, ConnectedSource, QueryExecutionResult } from './types.js';
import { resolveManifestPath, readManifest, replayManifest } from '../transforms/manifest.js';
import { TransformMetadata } from '../transforms/metadata.js';

const SAMPLE_LIMIT = 30;
const SAMPLE_DISPLAY_LIMIT = 20;

/**
 * Escape embedded double-quotes in a SQL identifier per SQL standard.
 * Returns just the escaped name, without surrounding quotes.
 */
function escId(name: string): string {
  return name.replace(/"/g, '""');
}

/**
 * Escape and quote a SQL identifier (column/table name) to prevent injection.
 */
function escapeIdentifier(name: string): string {
  return `"${escId(name)}"`;
}

/** True if a raw CSV cell parses as a finite number (used to decide what to
 *  store in a NUMERIC-affinity column; non-numeric cells become NULL). */
function isNumericStr(v: string): boolean {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  if (t === '') return false;
  const n = Number(t);
  return Number.isFinite(n);
}

/**
 * Infer a column's semantic type from its name, sample values, and cardinality.
 * Matches the POC's inferColumnType() logic.
 */
function inferColumnType(
  name: string,
  samples: string[],
  uniqueCount: number,
  totalRows: number
): DataColumn['type'] {
  const lower = name.toLowerCase();

  // ID detection
  if (lower === 'id' || (lower.endsWith('id') && uniqueCount > totalRows * 0.5)) {
    if (lower.endsWith('id')) return 'id';
  }
  if (lower.endsWith('_id')) return 'id';

  // Date detection
  if (
    lower.includes('date') ||
    lower.includes('time') ||
    lower.includes('year') ||
    lower.includes('timestamp')
  ) {
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
      if (allYearLike) return 'date';
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
function toTableName(filename: string): string {
  return filename
    .replace(/\.csv$/i, '')
    .replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Register custom aggregate functions that SQLite lacks natively.
 * Provides: median, stddev, p25, p75, percentile.
 */
function registerCustomAggregates(db: Database.Database): void {
  const sortedNums = (values: number[]) => values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);

  const computePercentile = (sorted: number[], p: number): number | null => {
    if (sorted.length === 0) return null;
    if (sorted.length === 1) return sorted[0];
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  db.aggregate('median', {
    start: () => [] as number[],
    step: (acc: number[], val: any) => { acc.push(Number(val)); return acc; },
    result: (acc: number[]) => computePercentile(sortedNums(acc), 0.5),
  });

  db.aggregate('stddev', {
    start: () => [] as number[],
    step: (acc: number[], val: any) => { acc.push(Number(val)); return acc; },
    result: (acc: number[]) => {
      const nums = sortedNums(acc);
      if (nums.length === 0) return null;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length;
      return Math.sqrt(variance);
    },
  });

  db.aggregate('p25', {
    start: () => [] as number[],
    step: (acc: number[], val: any) => { acc.push(Number(val)); return acc; },
    result: (acc: number[]) => computePercentile(sortedNums(acc), 0.25),
  });

  db.aggregate('p75', {
    start: () => [] as number[],
    step: (acc: number[], val: any) => { acc.push(Number(val)); return acc; },
    result: (acc: number[]) => computePercentile(sortedNums(acc), 0.75),
  });

  db.aggregate('p10', {
    start: () => [] as number[],
    step: (acc: number[], val: any) => { acc.push(Number(val)); return acc; },
    result: (acc: number[]) => computePercentile(sortedNums(acc), 0.10),
  });

  db.aggregate('p90', {
    start: () => [] as number[],
    step: (acc: number[], val: any) => { acc.push(Number(val)); return acc; },
    result: (acc: number[]) => computePercentile(sortedNums(acc), 0.90),
  });
}

/**
 * Load CSV files into an in-memory SQLite database and build schema metadata.
 */
function loadCsvs(
  csvPaths: { filePath: string; tableName: string }[]
): {
  db: Database.Database;
  tables: DataTable[];
  foreignKeys: ForeignKey[];
  warnings: string[];
} {
  const db = new Database(':memory:');
  registerCustomAggregates(db);
  const allColumns: { table: string; col: DataColumn }[] = [];
  const tables: DataTable[] = [];
  const warnings: string[] = [];

  for (const { filePath, tableName } of csvPaths) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

    // Report PapaParse errors as warnings
    if (parsed.errors && parsed.errors.length > 0) {
      for (const err of parsed.errors) {
        warnings.push(`CSV parse warning in ${filePath} (row ${err.row}): ${err.message}`);
      }
    }

    let rows = parsed.data as Record<string, string>[];

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
      const distinct = new Set<string>();
      const numericDistinct = new Set<string>();
      const samples: string[] = [];
      let nullCount = 0; // undefined/null/\N
      let emptyCount = 0; // ''
      let nonNumericCount = 0; // non-empty values that are not numbers
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
          if (samples.length < SAMPLE_LIMIT) samples.push(v);
        }
        if (isNumericStr(v)) numericDistinct.add(v);
        else nonNumericCount++;
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
      return { col, type, samples, distinctCount: finalUnique, nullCount: finalNullCount, numericAffinity };
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
    const insert = db.prepare(
      `INSERT INTO ${escapeIdentifier(tableName)} VALUES (${placeholders})`
    );
    const insertMany = db.transaction((batch: Record<string, string>[]) => {
      for (const row of batch) {
        insert.run(...colNames.map((c) => {
          const val = row[c];
          if (val === undefined || val === null || val === '\\N') return null;
          // In a numeric column, any non-numeric cell ('', 'N/A', text) → NULL.
          // Left as TEXT it would store above all numbers and break MAX/ORDER BY.
          if (numericCols.has(c) && !isNumericStr(val)) return null;
          return val;
        }));
      }
    });
    insertMany(rows);

    // Profile each column. Type/samples/counts come from the pre-pass above;
    // only numeric stats and categorical top values need the loaded DB.
    const columns: DataColumn[] = [];
    for (const meta of colMeta) {
      const col = meta.col;
      const type = meta.type;

      let columnStats: DataColumn['stats'] = undefined;
      let topValues: DataColumn['topValues'] = undefined;

      if (type === 'numeric') {
        const numStmt = db.prepare(`
          SELECT
            MIN(CAST("${escId(col)}" AS REAL)) as min_val,
            MAX(CAST("${escId(col)}" AS REAL)) as max_val,
            AVG(CAST("${escId(col)}" AS REAL)) as mean_val
          FROM "${escId(tableName)}"
          WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
        `);
        const numStats = numStmt.get() as any;

        const sortedStmt = db.prepare(`
          SELECT CAST("${escId(col)}" AS REAL) as val
          FROM "${escId(tableName)}"
          WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
          ORDER BY CAST("${escId(col)}" AS REAL)
        `);
        const sorted = sortedStmt.all().map((r: any) => r.val as number);
        const n = sorted.length;

        if (n > 0) {
          const percentile = (arr: number[], p: number) => {
            const idx = (p / 100) * (arr.length - 1);
            const lo = Math.floor(idx);
            const hi = Math.ceil(idx);
            return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
          };

          const mean = numStats.mean_val ?? 0;
          const variance = sorted.reduce((sum: number, v: number) => sum + (v - mean) ** 2, 0) / n;
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
      } else if (type === 'categorical' || type === 'date') {
        const topStmt = db.prepare(`
          SELECT "${escId(col)}" as value, COUNT(*) as count
          FROM "${escId(tableName)}"
          WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
          GROUP BY "${escId(col)}"
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `);
        topValues = topStmt.all() as { value: string; count: number }[];
      }

      const column: DataColumn = {
        name: col,
        type,
        sampleValues: meta.samples.slice(0, SAMPLE_DISPLAY_LIMIT),
        uniqueCount: meta.distinctCount,
        nullCount: meta.nullCount,
        totalCount: rows.length,
        stats: columnStats,
        topValues,
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
  const foreignKeys: ForeignKey[] = [];
  for (const entry of allColumns) {
    const colLower = entry.col.name.toLowerCase();
    if (
      entry.col.type === 'id' ||
      colLower.endsWith('_id') ||
      colLower.endsWith('id')
    ) {
      for (const other of allColumns) {
        if (other.table !== entry.table && other.col.name === entry.col.name) {
          // Avoid duplicate pairs
          const exists = foreignKeys.some(
            (fk) =>
              (fk.fromTable === entry.table &&
                fk.fromColumn === entry.col.name &&
                fk.toTable === other.table &&
                fk.toColumn === other.col.name) ||
              (fk.fromTable === other.table &&
                fk.fromColumn === other.col.name &&
                fk.toTable === entry.table &&
                fk.toColumn === entry.col.name)
          );
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

class CsvConnectedSource implements ConnectedSource {
  id: string;
  name: string;
  readonly type: DataSourceType = 'csv';
  private db: Database.Database;
  private schema: DataSchema;

  constructor(
    id: string,
    name: string,
    db: Database.Database,
    schema: DataSchema
  ) {
    this.id = id;
    this.name = name;
    this.db = db;
    this.schema = schema;
  }

  async getSchema(): Promise<DataSchema> {
    return this.schema;
  }

  invalidateSchema(): void {
    if (!this.schema) return;
    // Refresh each table's column list from the live database,
    // preserving existing column metadata and adding any new columns.
    for (const table of this.schema.tables) {
      const liveCols = this.db.prepare(`PRAGMA table_info("${table.name}")`).all() as any[];
      const liveColNames = liveCols.map((r: any) => r.name as string);
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

  private profileNewColumn(tableName: string, col: string, rowCount: number): DataColumn {
    const sampleStmt = this.db.prepare(
      `SELECT DISTINCT "${escId(col)}" FROM "${escId(tableName)}" WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != '' LIMIT ${SAMPLE_LIMIT}`
    );
    const samples = sampleStmt.all().map((r: any) => String(r[col]));

    const countStmt = this.db.prepare(
      `SELECT COUNT(DISTINCT "${escId(col)}") as cnt, COUNT(*) - COUNT("${escId(col)}") as nulls, COUNT(*) as total FROM "${escId(tableName)}"`
    );
    const stats = countStmt.get() as { cnt: number; nulls: number; total: number };
    const type = inferColumnType(col, samples, stats.cnt, rowCount);

    let columnStats: DataColumn['stats'] = undefined;
    let topValues: DataColumn['topValues'] = undefined;

    if (type === 'numeric') {
      const numStmt = this.db.prepare(`
        SELECT MIN(CAST("${escId(col)}" AS REAL)) as min_val, MAX(CAST("${escId(col)}" AS REAL)) as max_val, AVG(CAST("${escId(col)}" AS REAL)) as mean_val
        FROM "${escId(tableName)}" WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != ''
      `);
      const numStats = numStmt.get() as any;
      const sortedStmt = this.db.prepare(`
        SELECT CAST("${escId(col)}" AS REAL) as val FROM "${escId(tableName)}"
        WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != '' ORDER BY CAST("${escId(col)}" AS REAL)
      `);
      const sorted = sortedStmt.all().map((r: any) => r.val as number);
      const n = sorted.length;

      if (n > 0) {
        const percentile = (arr: number[], p: number) => {
          const idx = (p / 100) * (arr.length - 1);
          const lo = Math.floor(idx);
          const hi = Math.ceil(idx);
          return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
        };
        const mean = numStats.mean_val ?? 0;
        const variance = sorted.reduce((sum: number, v: number) => sum + (v - mean) ** 2, 0) / n;
        columnStats = {
          min: numStats.min_val, max: numStats.max_val, mean: numStats.mean_val,
          median: percentile(sorted, 50), stddev: Math.sqrt(variance),
          p25: percentile(sorted, 25), p75: percentile(sorted, 75),
        };
      }
    } else if (type === 'categorical' || type === 'date') {
      const topStmt = this.db.prepare(`
        SELECT "${escId(col)}" as value, COUNT(*) as count FROM "${escId(tableName)}"
        WHERE "${escId(col)}" IS NOT NULL AND "${escId(col)}" != '' GROUP BY "${escId(col)}" ORDER BY COUNT(*) DESC LIMIT 10
      `);
      topValues = topStmt.all() as { value: string; count: number }[];
    }

    return {
      name: col, type,
      sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
      uniqueCount: stats.cnt, nullCount: stats.nulls, totalCount: stats.total,
      stats: columnStats, topValues,
    };
  }

  async getSampleRows(tableName: string, count: number = 5): Promise<Record<string, any>[]> {
    const total = this.schema.tables.find(t => t.name === tableName)?.rowCount ?? 0;
    if (total === 0) return [];

    if (total <= count) {
      const stmt = this.db.prepare(`SELECT * FROM "${escId(tableName)}"`);
      return stmt.all() as Record<string, any>[];
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
    return stmt.all() as Record<string, any>[];
  }

  async executeQuery(sql: string): Promise<QueryExecutionResult> {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all() as Record<string, any>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      const typeMap = new Map<string, string>();
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
            if (!isNaN(num)) row[col] = num;
          }
        }
      }

      return { columns, rows };
    } catch (err: any) {
      return { columns: [], rows: [{ error: err.message }] };
    }
  }

  /** Get the underlying SQLite database handle. */
  getDatabase(): Database.Database {
    return this.db;
  }

  async close(): Promise<void> {
    try {
      this.db.close();
    } catch {
      // Already closed, ignore
    }
  }
}

export const csvConnector: DataConnector = {
  type: 'csv',

  async test(config: DataSourceConfig): Promise<{ ok: boolean; error?: string }> {
    const csvConfig = config as CsvSourceConfig;
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
      } else if (stat.isFile() && csvConfig.path.endsWith('.csv')) {
        return { ok: true };
      } else {
        return { ok: false, error: `Path is not a CSV file or directory: ${csvConfig.path}` };
      }
    } catch (err: any) {
      return { ok: false, error: `Cannot access path: ${err.message}` };
    }
  },

  async connect(config: DataSourceConfig): Promise<ConnectedSource> {
    const csvConfig = config as CsvSourceConfig;
    if (csvConfig.type !== 'csv') {
      throw new Error('Config type must be "csv"');
    }

    const stat = fs.statSync(csvConfig.path);
    let csvPaths: { filePath: string; tableName: string }[];

    if (stat.isDirectory()) {
      const files = fs.readdirSync(csvConfig.path).filter((f) => f.endsWith('.csv'));
      if (files.length === 0) {
        throw new Error(`No CSV files found in directory: ${csvConfig.path}`);
      }
      csvPaths = files.map((f) => ({
        filePath: path.join(csvConfig.path, f),
        tableName: toTableName(f),
      }));
    } else {
      csvPaths = [
        {
          filePath: csvConfig.path,
          tableName: toTableName(path.basename(csvConfig.path)),
        },
      ];
    }

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

    const schema: DataSchema = {
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
function applyManifest(
  db: Database.Database,
  config: CsvSourceConfig,
  tableNames: string[],
  source: CsvConnectedSource,
): void {
  const manifest = readManifest(resolveManifestPath(config));
  if (!manifest) return;

  const metadata = new TransformMetadata(db);
  metadata.init();

  let restoredAny = false;
  for (const tableName of tableNames) {
    const { replayed } = replayManifest(db, metadata, manifest, tableName);
    if (replayed.length > 0) restoredAny = true;
  }

  if (restoredAny) source.invalidateSchema();
}
