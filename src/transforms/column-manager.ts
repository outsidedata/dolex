/**
 * SQLite column management for the Dolex derived data layer.
 *
 * Adds, overwrites, and drops columns in SQLite tables.
 * Works directly with better-sqlite3 Database instances.
 */
import type Database from 'better-sqlite3';
import type { DataColumn, DataTable } from '../types.js';

export class ColumnManager {
  constructor(private db: Database.Database) {}

  /** Add a new column to a table with computed values. */
  addColumn(tableName: string, columnName: string, values: any[], type: string): void {
    this.validateValueCount(tableName, values);
    this.assertColumnAbsent(tableName, columnName);

    this.db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${toSqlType(type)}`);
    this.writeValues(tableName, columnName, values);
  }

  /** Overwrite an existing column's values. */
  overwriteColumn(tableName: string, columnName: string, values: any[]): void {
    this.validateValueCount(tableName, values);
    this.writeValues(tableName, columnName, values);
  }

  /** Drop a column from a table. */
  dropColumn(tableName: string, columnName: string): void {
    this.assertColumnExists(tableName, columnName);
    this.db.exec(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`);
  }

  /** Profile a single column and return a DataColumn descriptor. */
  profileColumn(tableName: string, columnName: string, type: string): DataColumn {
    const SAMPLE_DISPLAY_LIMIT = 20;

    const samples = this.db.prepare(
      `SELECT DISTINCT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL AND "${columnName}" != '' LIMIT 100`
    ).all().map((r: any) => String(r[columnName]));

    const counts = this.db.prepare(
      `SELECT COUNT(DISTINCT "${columnName}") as cnt, COUNT(*) - COUNT("${columnName}") as nulls, COUNT(*) as total FROM "${tableName}"`
    ).get() as { cnt: number; nulls: number; total: number };

    return {
      name: columnName,
      type: type as DataColumn['type'],
      sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
      uniqueCount: counts.cnt,
      nullCount: counts.nulls,
      totalCount: counts.total,
      stats: type === 'numeric' ? this.profileNumeric(tableName, columnName) : undefined,
      topValues: type === 'categorical' || type === 'date'
        ? this.profileTopValues(tableName, columnName)
        : undefined,
    };
  }

  /** Rebuild a DataTable's columns array from the live database. */
  refreshTableSchema(tableName: string, existingTable: DataTable): DataTable {
    const existingMap = new Map(existingTable.columns.map(c => [c.name, c]));
    const columns = this.getColumnNames(tableName).map(name =>
      existingMap.get(name) ?? this.profileColumn(tableName, name, 'numeric')
    );

    return { name: tableName, columns, rowCount: existingTable.rowCount };
  }

  /** Get column names for a table from PRAGMA. */
  getColumnNames(tableName: string): string[] {
    return this.db.prepare(`PRAGMA table_info("${tableName}")`).all().map((r: any) => r.name as string);
  }

  /** Get all rows from a table. */
  getAllRows(tableName: string): Record<string, any>[] {
    return this.db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, any>[];
  }

  /** Get row count. */
  getRowCount(tableName: string): number {
    return (this.db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get() as { cnt: number }).cnt;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private validateValueCount(tableName: string, values: any[]): void {
    const rowCount = this.getRowCount(tableName);
    if (values.length !== rowCount) {
      throw new Error(`Value count mismatch: got ${values.length} values for ${rowCount} rows`);
    }
  }

  private assertColumnExists(tableName: string, columnName: string): void {
    if (!this.getColumnNames(tableName).includes(columnName)) {
      throw new Error(`Column '${columnName}' does not exist in table '${tableName}'`);
    }
  }

  private assertColumnAbsent(tableName: string, columnName: string): void {
    if (this.getColumnNames(tableName).includes(columnName)) {
      throw new Error(`Column '${columnName}' already exists in table '${tableName}'`);
    }
  }

  private profileNumeric(tableName: string, columnName: string): DataColumn['stats'] {
    const whereClause = `WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''`;

    const agg = this.db.prepare(`
      SELECT
        MIN(CAST("${columnName}" AS REAL)) as min_val,
        MAX(CAST("${columnName}" AS REAL)) as max_val,
        AVG(CAST("${columnName}" AS REAL)) as mean_val
      FROM "${tableName}" ${whereClause}
    `).get() as { min_val: number; max_val: number; mean_val: number };

    const sorted = this.db.prepare(`
      SELECT CAST("${columnName}" AS REAL) as val
      FROM "${tableName}" ${whereClause}
      ORDER BY CAST("${columnName}" AS REAL)
    `).all().map((r: any) => r.val as number);

    if (sorted.length === 0) return undefined;

    const mean = agg.mean_val ?? 0;
    const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;

    return {
      min: agg.min_val,
      max: agg.max_val,
      mean: agg.mean_val,
      median: percentile(sorted, 50),
      stddev: Math.sqrt(variance),
      p25: percentile(sorted, 25),
      p75: percentile(sorted, 75),
    };
  }

  private profileTopValues(tableName: string, columnName: string): { value: string; count: number }[] {
    return this.db.prepare(`
      SELECT "${columnName}" as value, COUNT(*) as count
      FROM "${tableName}"
      WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''
      GROUP BY "${columnName}"
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `).all() as { value: string; count: number }[];
  }

  private writeValues(tableName: string, columnName: string, values: any[]): void {
    const rowids = this.db.prepare(
      `SELECT rowid as _rid FROM "${tableName}" ORDER BY rowid`
    ).all() as { _rid: number }[];

    const update = this.db.prepare(
      `UPDATE "${tableName}" SET "${columnName}" = ? WHERE rowid = ?`
    );

    const tx = this.db.transaction(() => {
      for (let i = 0; i < values.length; i++) {
        update.run(coerceSqlValue(values[i]), rowids[i]._rid);
      }
    });
    tx();
  }
}

// ─── Module-level utilities ───────────────────────────────────────────────────

/** Linear interpolation percentile on a pre-sorted array. */
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Coerce a JS value to a SQLite-compatible value. */
function coerceSqlValue(val: any): number | string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

function toSqlType(type: string): string {
  switch (type) {
    case 'numeric': return 'REAL';
    case 'boolean': return 'INTEGER';
    case 'categorical':
    case 'date':
    case 'text':
    default: return 'TEXT';
  }
}
