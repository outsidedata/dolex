/**
 * Dolex Data Source Connectors
 *
 * Public API — exports all connectors, the manager, and types.
 */
export type { DataConnector, ConnectedSource, QueryExecutionResult, ConnectorResult, SourceRegistryEntry, } from './types.js';
export { csvConnector } from './csv.js';
export { pgConnector } from './pg/index.js';
export { mongoConnector } from './mongo/index.js';
export { SourceManager } from './manager.js';
