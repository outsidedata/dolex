/**
 * MySQL Connector
 *
 * Connects to a MySQL database via the `mysql2` library.
 * Introspects schema via information_schema views.
 * Detects foreign keys from database constraints.
 * Maps MySQL types to our column type system.
 */

import type {
  DataSourceType,
  DataSourceConfig,
  MysqlSourceConfig,
  DataSchema,
  DataTable,
  DataColumn,
  ForeignKey,
} from '../types.js';
import type { DataConnector, ConnectedSource, QueryExecutionResult } from './types.js';

const SAMPLE_LIMIT = 30;
const SAMPLE_DISPLAY_LIMIT = 20;

/**
 * Map a MySQL data_type (from information_schema) to our column type system.
 */
function mapMysqlType(
  mysqlType: string,
  columnName: string,
  uniqueCount: number,
  totalRows: number,
  extra: string
): DataColumn['type'] {
  const lower = columnName.toLowerCase();
  const typeLower = mysqlType.toLowerCase();

  // ID detection by name
  if (lower === 'id' || lower === 'rowid') return 'id';
  if (lower.endsWith('_id')) return 'id';

  // Auto-increment -> id
  if (extra && extra.toLowerCase().includes('auto_increment')) {
    return 'id';
  }

  // Numeric types
  if (
    typeLower === 'tinyint' ||
    typeLower === 'smallint' ||
    typeLower === 'mediumint' ||
    typeLower === 'int' ||
    typeLower === 'integer' ||
    typeLower === 'bigint' ||
    typeLower === 'float' ||
    typeLower === 'double' ||
    typeLower === 'decimal' ||
    typeLower === 'numeric' ||
    typeLower === 'real'
  ) {
    if (lower.endsWith('id') && uniqueCount > totalRows * 0.5) {
      return 'id';
    }
    return 'numeric';
  }

  // Date/time types
  if (
    typeLower === 'date' ||
    typeLower === 'datetime' ||
    typeLower === 'timestamp' ||
    typeLower === 'time' ||
    typeLower === 'year'
  ) {
    return 'date';
  }

  // Date detection by column name
  if (
    lower.includes('date') ||
    lower.includes('time') ||
    lower.includes('year') ||
    lower.includes('timestamp')
  ) {
    return 'date';
  }

  // Boolean (MySQL uses tinyint(1), already caught above as numeric)
  if (typeLower === 'bit') {
    return 'categorical';
  }

  // Text types
  if (
    typeLower === 'varchar' ||
    typeLower === 'char' ||
    typeLower === 'tinytext' ||
    typeLower === 'text' ||
    typeLower === 'mediumtext' ||
    typeLower === 'longtext'
  ) {
    if ((typeLower === 'text' || typeLower === 'mediumtext' || typeLower === 'longtext') &&
      uniqueCount > totalRows * 0.9) {
      return 'text';
    }
    return 'categorical';
  }

  // JSON -> text
  if (typeLower === 'json') {
    return 'text';
  }

  // Binary types -> text
  if (
    typeLower === 'binary' ||
    typeLower === 'varbinary' ||
    typeLower === 'blob' ||
    typeLower === 'tinyblob' ||
    typeLower === 'mediumblob' ||
    typeLower === 'longblob'
  ) {
    return 'text';
  }

  // Enum / set -> categorical
  if (typeLower === 'enum' || typeLower === 'set') {
    return 'categorical';
  }

  return 'categorical';
}

class MysqlConnectedSource implements ConnectedSource {
  id: string;
  name: string;
  readonly type: DataSourceType = 'mysql';
  private pool: any; // mysql2 Pool
  private config: MysqlSourceConfig;
  private cachedSchema: DataSchema | null = null;

  constructor(
    id: string,
    name: string,
    pool: any,
    config: MysqlSourceConfig
  ) {
    this.id = id;
    this.name = name;
    this.pool = pool;
    this.config = config;
  }

  async getSchema(): Promise<DataSchema> {
    if (this.cachedSchema) return this.cachedSchema;

    // Get all user tables
    const [tableRows] = await this.pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this.config.database]
    );

    const tables: DataTable[] = [];

    for (const tableRow of tableRows as any[]) {
      const tableName = tableRow.table_name ?? tableRow.TABLE_NAME;

      // Get row count
      const [countRows] = await this.pool.query(
        `SELECT COUNT(*) as cnt FROM \`${tableName}\``
      );
      const rowCount = parseInt((countRows as any[])[0].cnt, 10);

      // Get columns from information_schema
      const [columnRows] = await this.pool.query(
        `SELECT column_name, data_type, is_nullable, column_default, extra
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [this.config.database, tableName]
      );

      const columns: DataColumn[] = [];

      for (const colRow of columnRows as any[]) {
        const colName = colRow.column_name ?? colRow.COLUMN_NAME;
        const mysqlType = colRow.data_type ?? colRow.DATA_TYPE;
        const extra = colRow.extra ?? colRow.EXTRA ?? '';

        // Get sample values
        let samples: string[] = [];
        try {
          const [sampleRows] = await this.pool.query(
            `SELECT DISTINCT CAST(\`${colName}\` AS CHAR) AS val FROM \`${tableName}\` WHERE \`${colName}\` IS NOT NULL LIMIT ?`,
            [SAMPLE_LIMIT]
          );
          samples = (sampleRows as any[]).map((r: any) => r.val);
        } catch {
          // Some types may fail to cast; skip samples
        }

        // Get stats
        let uniqueCount = 0;
        let nullCount = 0;
        let totalCount = rowCount;
        try {
          const [statsRows] = await this.pool.query(
            `SELECT COUNT(DISTINCT \`${colName}\`) as uniq, COUNT(*) - COUNT(\`${colName}\`) as nulls, COUNT(*) as total FROM \`${tableName}\``
          );
          uniqueCount = parseInt((statsRows as any[])[0].uniq, 10);
          nullCount = parseInt((statsRows as any[])[0].nulls, 10);
          totalCount = parseInt((statsRows as any[])[0].total, 10);
        } catch {
          // Fallback
        }

        const type = mapMysqlType(mysqlType, colName, uniqueCount, rowCount, extra);

        columns.push({
          name: colName,
          type,
          sampleValues: samples.slice(0, SAMPLE_DISPLAY_LIMIT),
          uniqueCount,
          nullCount,
          totalCount,
        });
      }

      tables.push({ name: tableName, columns, rowCount });
    }

    // Get foreign keys
    const foreignKeys = await this.getForeignKeys();

    this.cachedSchema = {
      tables,
      foreignKeys,
      source: {
        id: this.id,
        type: 'mysql',
        name: this.name,
        config: {
          ...this.config,
          password: '***',
        } as MysqlSourceConfig,
      },
    };

    return this.cachedSchema;
  }

  private async getForeignKeys(): Promise<ForeignKey[]> {
    const [rows] = await this.pool.query(
      `SELECT
        kcu.TABLE_NAME AS from_table,
        kcu.COLUMN_NAME AS from_column,
        kcu.REFERENCED_TABLE_NAME AS to_table,
        kcu.REFERENCED_COLUMN_NAME AS to_column
       FROM information_schema.KEY_COLUMN_USAGE AS kcu
       WHERE kcu.TABLE_SCHEMA = ?
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME`,
      [this.config.database]
    );

    return (rows as any[]).map((r: any) => ({
      fromTable: r.from_table,
      fromColumn: r.from_column,
      toTable: r.to_table,
      toColumn: r.to_column,
    }));
  }

  async getSampleRows(tableName: string, count: number = 5): Promise<Record<string, any>[]> {
    try {
      const [rows] = await this.pool.query(
        `SELECT * FROM \`${tableName}\` ORDER BY RAND() LIMIT ?`,
        [count]
      );
      return rows as Record<string, any>[];
    } catch {
      return [];
    }
  }

  async executeQuery(sql: string): Promise<QueryExecutionResult> {
    try {
      const [rows, fields] = await this.pool.query(sql);
      const columns = (fields as any[]).map((f: any) => f.name);
      return { columns, rows: rows as Record<string, any>[] };
    } catch (err: any) {
      return { columns: [], rows: [{ error: err.message }] };
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch {
      // Already closed, ignore
    }
  }
}

export const mysqlConnector: DataConnector = {
  type: 'mysql',

  async test(
    config: DataSourceConfig
  ): Promise<{ ok: boolean; error?: string }> {
    const myConfig = config as MysqlSourceConfig;
    if (myConfig.type !== 'mysql') {
      return { ok: false, error: 'Config type must be "mysql"' };
    }

    let mysql2: any;
    try {
      mysql2 = await import('mysql2/promise');
    } catch {
      return { ok: false, error: 'mysql2 package is not installed. Run: npm install mysql2' };
    }

    let connection;
    try {
      connection = await mysql2.createConnection({
        host: myConfig.host,
        port: myConfig.port,
        database: myConfig.database,
        user: myConfig.user,
        password: myConfig.password,
      });
      await connection.query('SELECT 1');
      await connection.end();
      return { ok: true };
    } catch (err: any) {
      try {
        if (connection) await connection.end();
      } catch {
        // Ignore cleanup error
      }
      return { ok: false, error: `MySQL connection failed: ${err.message}` };
    }
  },

  async connect(config: DataSourceConfig): Promise<ConnectedSource> {
    const myConfig = config as MysqlSourceConfig;
    if (myConfig.type !== 'mysql') {
      throw new Error('Config type must be "mysql"');
    }

    let mysql2: any;
    try {
      mysql2 = await import('mysql2/promise');
    } catch {
      throw new Error('mysql2 package is not installed. Run: npm install mysql2');
    }

    const pool = mysql2.createPool({
      host: myConfig.host,
      port: myConfig.port,
      database: myConfig.database,
      user: myConfig.user,
      password: myConfig.password,
      waitForConnections: true,
      connectionLimit: 5,
    });

    // Verify the connection works
    const conn = await pool.getConnection();
    conn.release();

    const sourceName = myConfig.database;
    const id = `mysql-${myConfig.host}-${myConfig.database}-${Date.now()}`;

    return new MysqlConnectedSource(id, sourceName, pool, myConfig);
  },
};
