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

const SAMPLE_LIMIT = 30;
const SAMPLE_DISPLAY_LIMIT = 20;

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

    // Create table with all TEXT columns (CSV data is untyped)
    const safeCols = colNames.map((c) => `"${c}" TEXT`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (${safeCols})`);

    // Batch insert
    const placeholders = colNames.map(() => '?').join(', ');
    const insert = db.prepare(
      `INSERT INTO "${tableName}" VALUES (${placeholders})`
    );
    const insertMany = db.transaction((batch: Record<string, string>[]) => {
      for (const row of batch) {
        insert.run(...colNames.map((c) => {
          const val = row[c];
          if (val === undefined || val === null || val === '\\N') return null;
          return val;
        }));
      }
    });
    insertMany(rows);

    // Analyze each column
    const columns: DataColumn[] = [];
    for (const col of colNames) {
      const sampleStmt = db.prepare(
        `SELECT DISTINCT "${col}" FROM "${tableName}" WHERE "${col}" IS NOT NULL AND "${col}" != '' LIMIT ${SAMPLE_LIMIT}`
      );
      const samples = sampleStmt.all().map((r: any) => r[col] as string);

      const countStmt = db.prepare(
        `SELECT COUNT(DISTINCT "${col}") as cnt, COUNT(*) - COUNT("${col}") as nulls, COUNT(*) as total FROM "${tableName}"`
      );
      const stats = countStmt.get() as { cnt: number; nulls: number; total: number };

      const type = inferColumnType(col, samples, stats.cnt, rows.length);

      // Rich profiling
      let columnStats: DataColumn['stats'] = undefined;
      let topValues: DataColumn['topValues'] = undefined;

      if (type === 'numeric') {
        const numStmt = db.prepare(`
          SELECT
            MIN(CAST("${col}" AS REAL)) as min_val,
            MAX(CAST("${col}" AS REAL)) as max_val,
            AVG(CAST("${col}" AS REAL)) as mean_val
          FROM "${tableName}"
          WHERE "${col}" IS NOT NULL AND "${col}" != ''
        `);
        const numStats = numStmt.get() as any;

        const sortedStmt = db.prepare(`
          SELECT CAST("${col}" AS REAL) as val
          FROM "${tableName}"
          WHERE "${col}" IS NOT NULL AND "${col}" != ''
          ORDER BY CAST("${col}" AS REAL)
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
          SELECT "${col}" as value, COUNT(*) as count
          FROM "${tableName}"
          WHERE "${col}" IS NOT NULL AND "${col}" != ''
          GROUP BY "${col}"
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `);
        topValues = topStmt.all() as { value: string; count: number }[];
      }

      const column: DataColumn = {
        name: col,
        type,
        sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
        uniqueCount: stats.cnt,
        nullCount: stats.nulls,
        totalCount: stats.total,
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
      `SELECT DISTINCT "${col}" FROM "${tableName}" WHERE "${col}" IS NOT NULL AND "${col}" != '' LIMIT ${SAMPLE_LIMIT}`
    );
    const samples = sampleStmt.all().map((r: any) => String(r[col]));

    const countStmt = this.db.prepare(
      `SELECT COUNT(DISTINCT "${col}") as cnt, COUNT(*) - COUNT("${col}") as nulls, COUNT(*) as total FROM "${tableName}"`
    );
    const stats = countStmt.get() as { cnt: number; nulls: number; total: number };
    const type = inferColumnType(col, samples, stats.cnt, rowCount);

    let columnStats: DataColumn['stats'] = undefined;
    let topValues: DataColumn['topValues'] = undefined;

    if (type === 'numeric') {
      const numStmt = this.db.prepare(`
        SELECT MIN(CAST("${col}" AS REAL)) as min_val, MAX(CAST("${col}" AS REAL)) as max_val, AVG(CAST("${col}" AS REAL)) as mean_val
        FROM "${tableName}" WHERE "${col}" IS NOT NULL AND "${col}" != ''
      `);
      const numStats = numStmt.get() as any;
      const sortedStmt = this.db.prepare(`
        SELECT CAST("${col}" AS REAL) as val FROM "${tableName}"
        WHERE "${col}" IS NOT NULL AND "${col}" != '' ORDER BY CAST("${col}" AS REAL)
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
        SELECT "${col}" as value, COUNT(*) as count FROM "${tableName}"
        WHERE "${col}" IS NOT NULL AND "${col}" != '' GROUP BY "${col}" ORDER BY COUNT(*) DESC LIMIT 10
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
      const stmt = this.db.prepare(`SELECT * FROM "${tableName}"`);
      return stmt.all() as Record<string, any>[];
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

    return new CsvConnectedSource(id, sourceName, db, schema);
  },
};
