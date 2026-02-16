/**
 * Dolex Data Source Connectors
 *
 * Public API — exports all connectors, the manager, and types.
 */
export type { DataConnector, ConnectedSource, QueryExecutionResult, ConnectorResult, SourceRegistryEntry, } from './types.js';
export { csvConnector } from './csv.js';
export { sqliteConnector } from './sqlite.js';
export { postgresConnector } from './postgres.js';
export { mysqlConnector } from './mysql.js';
export { SourceManager } from './manager.js';
//# sourceMappingURL=index.d.ts.map