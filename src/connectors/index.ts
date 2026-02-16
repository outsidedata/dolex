/**
 * Dolex Data Source Connectors
 *
 * Public API — exports all connectors, the manager, and types.
 */

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  DataConnector,
  ConnectedSource,
  QueryExecutionResult,
  ConnectorResult,
  SourceRegistryEntry,
} from './types.js';

// ─── Connectors ─────────────────────────────────────────────────────────────
export { csvConnector } from './csv.js';
export { sqliteConnector } from './sqlite.js';
export { postgresConnector } from './postgres.js';
export { mysqlConnector } from './mysql.js';

// ─── Manager ────────────────────────────────────────────────────────────────
export { SourceManager } from './manager.js';
