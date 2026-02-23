const TABLE = '_dolex_transforms';
export class TransformMetadata {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Initialize the metadata table (CREATE TABLE IF NOT EXISTS). */
    init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        expr TEXT NOT NULL,
        type TEXT NOT NULL,
        layer TEXT NOT NULL CHECK(layer IN ('derived', 'working')),
        partition_by TEXT,
        "order" INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(table_name, column_name, layer)
      )
    `);
    }
    /** Add a transform record. */
    add(tableName, record) {
        const order = record.order ?? this.nextOrder(tableName);
        this.db.prepare(`
      INSERT INTO ${TABLE} (table_name, column_name, expr, type, layer, partition_by, "order")
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tableName, record.column, record.expr, record.type, record.layer, record.partitionBy ?? null, order);
    }
    /** Update a record's layer (working → derived on promote). */
    updateLayer(tableName, columnName, oldLayer, newLayer) {
        this.db.prepare(`
      UPDATE ${TABLE}
      SET layer = ?
      WHERE table_name = ? AND column_name = ? AND layer = ?
    `).run(newLayer, tableName, columnName, oldLayer);
    }
    /** Remove a record, optionally scoped to a specific layer. */
    remove(tableName, columnName, layer) {
        if (layer) {
            this.db.prepare(`
        DELETE FROM ${TABLE}
        WHERE table_name = ? AND column_name = ? AND layer = ?
      `).run(tableName, columnName, layer);
        }
        else {
            this.db.prepare(`
        DELETE FROM ${TABLE}
        WHERE table_name = ? AND column_name = ?
      `).run(tableName, columnName);
        }
    }
    /** Get all records for a table, optionally filtered by layer. Ordered by execution order. */
    list(tableName, layer) {
        if (layer) {
            return this.db.prepare(`SELECT * FROM ${TABLE} WHERE table_name = ? AND layer = ? ORDER BY "order"`).all(tableName, layer).map(rowToRecord);
        }
        return this.db.prepare(`SELECT * FROM ${TABLE} WHERE table_name = ? ORDER BY "order"`).all(tableName).map(rowToRecord);
    }
    /** Get a specific record. Working layer takes precedence over derived. */
    get(tableName, columnName) {
        const row = this.db.prepare(`
      SELECT * FROM ${TABLE}
      WHERE table_name = ? AND column_name = ?
      ORDER BY CASE layer WHEN 'working' THEN 0 ELSE 1 END
      LIMIT 1
    `).get(tableName, columnName);
        return row ? rowToRecord(row) : null;
    }
    /** Get the next execution order value for a table. */
    nextOrder(tableName) {
        const row = this.db.prepare(`
      SELECT COALESCE(MAX("order"), 0) + 1 as next_order
      FROM ${TABLE}
      WHERE table_name = ?
    `).get(tableName);
        return row.next_order;
    }
    /** Check if a column exists in any layer. */
    exists(tableName, columnName) {
        const row = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM ${TABLE}
      WHERE table_name = ? AND column_name = ?
    `).get(tableName, columnName);
        return row.cnt > 0;
    }
    /** Get the layer of a column. Returns null if not found (source column). */
    getLayer(tableName, columnName) {
        return this.get(tableName, columnName)?.layer ?? null;
    }
    /** Check if a column has a derived record (even if shadowed by working). */
    hasDerived(tableName, columnName) {
        return this.getDerived(tableName, columnName) !== null;
    }
    /** Get the derived record even if shadowed by a working layer override. */
    getDerived(tableName, columnName) {
        const row = this.db.prepare(`
      SELECT * FROM ${TABLE}
      WHERE table_name = ? AND column_name = ? AND layer = 'derived'
    `).get(tableName, columnName);
        return row ? rowToRecord(row) : null;
    }
}
function rowToRecord(row) {
    return {
        column: row.column_name,
        expr: row.expr,
        type: row.type,
        layer: row.layer,
        order: row.order,
        partitionBy: row.partition_by ?? undefined,
    };
}
//# sourceMappingURL=metadata.js.map