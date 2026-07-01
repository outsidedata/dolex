/**
 * Connector-specific types for Dolex data source connectors.
 */
/**
 * Reflect a session-derived column in a connector's cached schema, so downstream consumers
 * (schemaText, describe_data) see it. Shared by the live connectors' applyDerivation
 * (Postgres shadow view / Mongo $set) — idempotent; a no-op if the column already exists.
 */
export function registerDerivedColumn(schema, table, column) {
    const t = schema.tables.find((tt) => tt.name === table);
    if (t && !t.columns.find((cc) => cc.name === column)) {
        t.columns.push({ name: column, type: 'text', sampleValues: [], uniqueCount: 0, nullCount: 0, totalCount: t.rowCount, layer: 'derived' });
    }
}
