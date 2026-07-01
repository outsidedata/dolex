/**
 * Postgres connector — the live-database twin of the CSV connector.
 *
 * Same ConnectedSource contract as CsvConnectedSource: a profiled DataSchema built
 * at connect (columns typed + stats + topValues + declared foreign keys), executeQuery
 * over a pooled libpq connection, representative sample rows. Parity, not a new shape.
 *
 * Numeric policy (proven in experiment 038): node-postgres returns NUMERIC/BIGINT as
 * strings; we let math happen in SQL and coerce a numeric-typed *result column* to a JS
 * number for consumer parity with the CSV path — never sum strings in JS, never blanket-
 * parse raw column pulls before aggregation.
 *
 * Declared FKs (experiment 039) are read from information_schema — a capability the CSV
 * path never had; it surfaces the multi-FK / redundant-source edges the model crawler misses.
 *
 * getDatabase() is intentionally NOT implemented — the SQLite ALTER+rowid path never touches
 * a live DB. Derivation flows through the source-agnostic seam instead: this connector DECLARES
 * `derivationCapabilities()` (materialization:'session-temp', rowKey:'id') and implements
 * `applyDerivation` — a derived column is materialized as a session-local shadow TEMP VIEW on a
 * pinned client (see applyDerivation), visible to later queries; the base table is never written.
 */
import type { Pool, PoolClient } from 'pg';
import type {
  DataColumn, DataSchema, DataTable, ForeignKey, DataSourceConfig, DataSourceType, PostgresSourceConfig,
} from '../../types.js';
import type { ConnectedSource, DataConnector, QueryExecutionResult, DerivationCapabilities } from '../types.js';
import { registerDerivedColumn } from '../types.js';
import { importOptional } from '../../utils/optional-deps.js';

/** Lazily load the pg driver so the base install never requires it — a missing package becomes a
 *  friendly "npm install pg", surfaced only when a Postgres source is actually used. */
const loadPg = () => importOptional<typeof import('pg')>('pg', 'postgres');

const q = (id: string) => '"' + id.replace(/"/g, '""') + '"';

function poolFor(PoolCtor: typeof import('pg').Pool, cfg: PostgresSourceConfig): Pool {
  if (cfg.connectionString) return new PoolCtor({ connectionString: cfg.connectionString, max: 4 });
  // The secret is either the literal password or (preferred) read from an env var at connect time,
  // so it need never be persisted in the registry file.
  const password = cfg.password ?? (cfg.passwordEnv ? process.env[cfg.passwordEnv] : undefined);
  return new PoolCtor({
    host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, password, max: 4,
  });
}

// Postgres type OIDs that should surface as JS numbers: int2/int4/int8, float4/float8, numeric.
const PG_NUMERIC_OIDS = new Set([20, 21, 23, 700, 701, 1700]);
const NUMERIC_TYPES = new Set(['numeric', 'integer', 'bigint', 'double precision', 'real', 'smallint', 'decimal']);
const DATE_TYPES = new Set(['date', 'timestamp without time zone', 'timestamp with time zone', 'time without time zone']);

function classify(dataType: string, name: string, distinct: number, total: number): DataColumn['type'] {
  if (NUMERIC_TYPES.has(dataType)) {
    if (/(^|_)id$/i.test(name) && total > 0 && distinct >= total * 0.9) return 'id';
    return 'numeric';
  }
  if (DATE_TYPES.has(dataType)) return 'date';
  // text-ish
  if (total > 0 && distinct <= Math.min(1000, Math.max(50, total * 0.5)) && distinct <= 200) return 'categorical';
  return 'text';
}

async function profileTable(pool: Pool, schema: string, table: string): Promise<DataTable> {
  // column list + pg data types
  const colRes = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
    [schema, table]
  );
  const cols: { name: string; dataType: string }[] = colRes.rows.map((r: any) => ({ name: r.column_name, dataType: r.data_type }));

  // one scan: COUNT(*) + per-column distinct + non-null counts
  const countSel = ['COUNT(*)::bigint AS __total'];
  for (const c of cols) {
    countSel.push(`COUNT(DISTINCT ${q(c.name)})::bigint AS ${q('d_' + c.name)}`);
    countSel.push(`COUNT(${q(c.name)})::bigint AS ${q('n_' + c.name)}`);
  }
  const counts = (await pool.query(`SELECT ${countSel.join(', ')} FROM ${q(schema)}.${q(table)}`)).rows[0];
  const total = Number(counts.__total);

  const columns: DataColumn[] = [];
  for (const c of cols) {
    const distinct = Number(counts['d_' + c.name]);
    const nonNull = Number(counts['n_' + c.name]);
    const type = classify(c.dataType, c.name, distinct, total);

    // sample values (distinct, for display)
    const sv = await pool.query(
      `SELECT DISTINCT ${q(c.name)}::text AS v FROM ${q(schema)}.${q(table)} WHERE ${q(c.name)} IS NOT NULL LIMIT 20`
    );
    const sampleValues = sv.rows.map((r: any) => String(r.v)).slice(0, 5);

    let stats: DataColumn['stats'] | undefined;
    let topValues: DataColumn['topValues'] | undefined;

    if (type === 'numeric' && nonNull > 0) {
      const s = (await pool.query(
        `SELECT MIN(${q(c.name)})::float8 AS min, MAX(${q(c.name)})::float8 AS max, AVG(${q(c.name)})::float8 AS mean,
                COALESCE(STDDEV_POP(${q(c.name)}),0)::float8 AS stddev,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY ${q(c.name)})::float8 AS median,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY ${q(c.name)})::float8 AS p25,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY ${q(c.name)})::float8 AS p75
         FROM ${q(schema)}.${q(table)} WHERE ${q(c.name)} IS NOT NULL`
      )).rows[0];
      stats = { min: s.min, max: s.max, mean: s.mean, median: s.median, stddev: s.stddev, p25: s.p25, p75: s.p75 };
    } else if (type === 'categorical' || type === 'date') {
      const tv = await pool.query(
        `SELECT ${q(c.name)}::text AS value, COUNT(*)::int AS count FROM ${q(schema)}.${q(table)}
         WHERE ${q(c.name)} IS NOT NULL GROUP BY ${q(c.name)} ORDER BY COUNT(*) DESC LIMIT 10`
      );
      topValues = tv.rows.map((r: any) => ({ value: String(r.value), count: r.count }));
    }

    columns.push({
      name: c.name, type, sampleValues,
      uniqueCount: distinct, nullCount: total - nonNull, totalCount: total,
      layer: 'source', stats, topValues,
    });
  }

  return { name: table, columns, rowCount: total };
}

async function readForeignKeys(pool: Pool, schema: string): Promise<ForeignKey[]> {
  const res = await pool.query(
    `SELECT tc.table_name AS ft, kcu.column_name AS fc, ccu.table_name AS tt, ccu.column_name AS tcol
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=$1
     ORDER BY ft, fc`,
    [schema]
  );
  return res.rows.map((r: any) => ({ fromTable: r.ft, fromColumn: r.fc, toTable: r.tt, toColumn: r.tcol }));
}

class PgConnectedSource implements ConnectedSource {
  readonly type: DataSourceType = 'postgres';
  /** Once a derivation exists, ALL queries ride this ONE pinned client so pg_temp (the shadow
   *  view + temp table) is visible — a pooled connection would not see them (exp 043). */
  private pinned: PoolClient | null = null;
  /** table → derived columns materialized this session, in creation order. */
  private derived = new Map<string, { column: string; expr: string }[]>();
  constructor(
    public id: string,
    public name: string,
    private pool: Pool,
    private schemaName: string,
    private schema: DataSchema
  ) {}

  async getSchema(): Promise<DataSchema> {
    return this.schema;
  }

  /** The query runner: the pinned client once a derivation is active, else the pool. */
  private runner(): Pool | PoolClient {
    return this.pinned ?? this.pool;
  }

  async executeQuery(sql: string): Promise<QueryExecutionResult> {
    try {
      const r = await this.runner().query(sql);
      // Coerce by the RESULT column's actual Postgres type (OID), not by source-column
      // name — so aliased aggregates (AVG/SUM AS x) and computed columns are typed
      // correctly. node-postgres returns numeric/bigint as strings; we surface them as JS
      // numbers for consumer parity with the CSV path (charts/aggregation downstream).
      // Math already happened in SQL (policy B, exp 038); this final cast is display-side and
      // carries the same float64 ceiling the CSV connector has.
      const columns = r.fields.map((f: any) => f.name);
      const numericField = new Set(r.fields.filter((f: any) => PG_NUMERIC_OIDS.has(f.dataTypeID)).map((f: any) => f.name));
      const rows = r.rows.map((row: any) => {
        const out: Record<string, any> = {};
        for (const col of columns) {
          const v = row[col];
          if (numericField.has(col) && typeof v === 'string' && v !== '' && !isNaN(Number(v))) out[col] = Number(v);
          else out[col] = v;
        }
        return out;
      });
      return { columns, rows };
    } catch (err: any) {
      return { columns: [], rows: [{ error: err.message }] };
    }
  }

  async getSampleRows(tableName: string, count = 5): Promise<Record<string, any>[]> {
    const total = this.schema.tables.find((t) => t.name === tableName)?.rowCount ?? 0;
    if (total === 0) return [];
    if (total <= count) {
      return (await this.pool.query(`SELECT * FROM ${q(this.schemaName)}.${q(tableName)}`)).rows;
    }
    // block-level server-side sample; fall back to a bounded scan if it under-fills
    const pct = Math.min(100, Math.max(1, Math.ceil((count / total) * 100 * 20)));
    let rows = (await this.pool.query(
      `SELECT * FROM ${q(this.schemaName)}.${q(tableName)} TABLESAMPLE SYSTEM(${pct}) LIMIT ${count}`
    )).rows;
    if (rows.length < count) {
      rows = (await this.pool.query(`SELECT * FROM ${q(this.schemaName)}.${q(tableName)} LIMIT ${count}`)).rows;
    }
    return rows;
  }

  // getDatabase intentionally omitted → the derivation seam no longer keys on a raw db handle.
  /**
   * Postgres derives via a session-local TEMP TABLE keyed by `id`, exposed to arbitrary later
   * queries through a same-named TEMP VIEW on ONE pinned client. Declared here; the materialization
   * itself is wired in a subsequent stage.
   */
  derivationCapabilities(): DerivationCapabilities {
    return { canDerive: true, materialization: 'session-temp', rowKey: 'id', serverSideQueryable: true };
  }

  /**
   * Materialize a derived column as a session-local shadow TEMP VIEW on the pinned client.
   * `expr` is a Postgres SQL expression over the table's columns. pg_temp precedes the schema in
   * search_path, so a later unqualified `FROM <table>` transparently reads the view. The base
   * table (schema-qualified inside the view) is never written. Multiple derivations accumulate.
   */
  async applyDerivation(table: string, column: string, expr: string): Promise<void> {
    if (/;|--|\/\*/.test(expr)) throw new Error('derivation expr must be a single SQL expression (no ";" or comments)');
    if (!this.pinned) this.pinned = await this.pool.connect();
    const c = this.pinned;
    const cols = this.derived.get(table) ?? [];
    const existing = cols.find((d) => d.column === column);
    if (existing) existing.expr = expr; else cols.push({ column, expr });
    this.derived.set(table, cols);
    const projected = cols.map((d) => `(${d.expr}) AS ${q(d.column)}`).join(', ');
    await c.query(`DROP VIEW IF EXISTS pg_temp.${q(table)}`);
    await c.query(`CREATE TEMP VIEW ${q(table)} AS SELECT b.*, ${projected} FROM ${q(this.schemaName)}.${q(table)} b`);
    registerDerivedColumn(this.schema, table, column);
  }

  async close(): Promise<void> {
    try { if (this.pinned) { this.pinned.release(); this.pinned = null; } } catch { /* noop */ }
    try { await this.pool.end(); } catch { /* already closed */ }
  }
}

export const pgConnector: DataConnector = {
  type: 'postgres' as DataSourceType,

  async test(config: DataSourceConfig): Promise<{ ok: boolean; error?: string }> {
    const cfg = config as unknown as PostgresSourceConfig;
    if (cfg.type !== 'postgres') return { ok: false, error: 'Config type must be "postgres"' };
    const { Pool } = await loadPg();
    const pool = poolFor(Pool, cfg);
    try {
      await pool.query('SELECT 1');
      return { ok: true };
    } catch (err: any) {
      // A connection refusal often arrives as an AggregateError with an empty top-level message;
      // fall back to the code / nested reason so the caller (and the AI agent) gets something actionable.
      const reason = err?.message || err?.code || err?.errors?.map((e: any) => e?.message || e?.code).filter(Boolean).join('; ') || String(err);
      return { ok: false, error: `Cannot connect to Postgres: ${reason}` };
    } finally {
      await pool.end();
    }
  },

  async connect(config: DataSourceConfig): Promise<ConnectedSource> {
    const cfg = config as unknown as PostgresSourceConfig;
    if (cfg.type !== 'postgres') throw new Error('Config type must be "postgres"');
    const schema = cfg.schema || 'public';
    const { Pool } = await loadPg();
    const pool = poolFor(Pool, cfg);

    const tableRes = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name`,
      [schema]
    );
    const tables: DataTable[] = [];
    for (const row of tableRes.rows) {
      tables.push(await profileTable(pool, schema, row.table_name));
    }
    const foreignKeys = await readForeignKeys(pool, schema);

    const dataSchema: DataSchema = {
      tables, foreignKeys,
      source: { id: '', type: 'postgres' as DataSourceType, name: cfg.database || 'postgres', config },
    };
    const id = `pg-${cfg.database || 'db'}`;
    dataSchema.source.id = id;
    return new PgConnectedSource(id, cfg.database || 'postgres', pool, schema, dataSchema);
  },
};
