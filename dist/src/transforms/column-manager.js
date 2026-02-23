export class ColumnManager {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Add a new column to a table with computed values. */
    addColumn(tableName, columnName, values, type) {
        this.validateValueCount(tableName, values);
        this.assertColumnAbsent(tableName, columnName);
        this.db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${toSqlType(type)}`);
        this.writeValues(tableName, columnName, values);
    }
    /** Overwrite an existing column's values. */
    overwriteColumn(tableName, columnName, values) {
        this.validateValueCount(tableName, values);
        this.writeValues(tableName, columnName, values);
    }
    /** Drop a column from a table. */
    dropColumn(tableName, columnName) {
        this.assertColumnExists(tableName, columnName);
        this.db.exec(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`);
    }
    /** Profile a single column and return a DataColumn descriptor. */
    profileColumn(tableName, columnName, type) {
        const SAMPLE_DISPLAY_LIMIT = 20;
        const samples = this.db.prepare(`SELECT DISTINCT "${columnName}" FROM "${tableName}" WHERE "${columnName}" IS NOT NULL AND "${columnName}" != '' LIMIT 100`).all().map((r) => String(r[columnName]));
        const counts = this.db.prepare(`SELECT COUNT(DISTINCT "${columnName}") as cnt, COUNT(*) - COUNT("${columnName}") as nulls, COUNT(*) as total FROM "${tableName}"`).get();
        return {
            name: columnName,
            type: type,
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
    refreshTableSchema(tableName, existingTable) {
        const existingMap = new Map(existingTable.columns.map(c => [c.name, c]));
        const columns = this.getColumnNames(tableName).map(name => existingMap.get(name) ?? this.profileColumn(tableName, name, 'numeric'));
        return { name: tableName, columns, rowCount: existingTable.rowCount };
    }
    /** Get column names for a table from PRAGMA. */
    getColumnNames(tableName) {
        return this.db.prepare(`PRAGMA table_info("${tableName}")`).all().map((r) => r.name);
    }
    /** Get all rows from a table. */
    getAllRows(tableName) {
        return this.db.prepare(`SELECT * FROM "${tableName}"`).all();
    }
    /** Get row count. */
    getRowCount(tableName) {
        return this.db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get().cnt;
    }
    // ─── Private helpers ──────────────────────────────────────────────────────────
    validateValueCount(tableName, values) {
        const rowCount = this.getRowCount(tableName);
        if (values.length !== rowCount) {
            throw new Error(`Value count mismatch: got ${values.length} values for ${rowCount} rows`);
        }
    }
    assertColumnExists(tableName, columnName) {
        if (!this.getColumnNames(tableName).includes(columnName)) {
            throw new Error(`Column '${columnName}' does not exist in table '${tableName}'`);
        }
    }
    assertColumnAbsent(tableName, columnName) {
        if (this.getColumnNames(tableName).includes(columnName)) {
            throw new Error(`Column '${columnName}' already exists in table '${tableName}'`);
        }
    }
    profileNumeric(tableName, columnName) {
        const whereClause = `WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''`;
        const agg = this.db.prepare(`
      SELECT
        MIN(CAST("${columnName}" AS REAL)) as min_val,
        MAX(CAST("${columnName}" AS REAL)) as max_val,
        AVG(CAST("${columnName}" AS REAL)) as mean_val
      FROM "${tableName}" ${whereClause}
    `).get();
        const sorted = this.db.prepare(`
      SELECT CAST("${columnName}" AS REAL) as val
      FROM "${tableName}" ${whereClause}
      ORDER BY CAST("${columnName}" AS REAL)
    `).all().map((r) => r.val);
        if (sorted.length === 0)
            return undefined;
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
    profileTopValues(tableName, columnName) {
        return this.db.prepare(`
      SELECT "${columnName}" as value, COUNT(*) as count
      FROM "${tableName}"
      WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''
      GROUP BY "${columnName}"
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `).all();
    }
    writeValues(tableName, columnName, values) {
        const rowids = this.db.prepare(`SELECT rowid as _rid FROM "${tableName}" ORDER BY rowid`).all();
        const update = this.db.prepare(`UPDATE "${tableName}" SET "${columnName}" = ? WHERE rowid = ?`);
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
function percentile(sorted, p) {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
/** Coerce a JS value to a SQLite-compatible value. */
function coerceSqlValue(val) {
    if (val === null || val === undefined)
        return null;
    if (typeof val === 'boolean')
        return val ? 1 : 0;
    return val;
}
function toSqlType(type) {
    switch (type) {
        case 'numeric': return 'REAL';
        case 'boolean': return 'INTEGER';
        case 'categorical':
        case 'date':
        case 'text':
        default: return 'TEXT';
    }
}
//# sourceMappingURL=column-manager.js.map