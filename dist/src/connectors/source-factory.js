/**
 * Source factory — turn generic frontend arguments (a `--type`, a connection
 * string, or discrete host/port/database fields) into a typed
 * `DataSourceConfig` the `SourceManager` can register and connect.
 *
 * Model-free and dependency-free: it only shapes/validates a config object; it
 * never opens a connection (the connector's `test()`/`connect()` does that).
 * Shared by the CLI `sources add` command; the MCP loader can adopt it later.
 *
 * Backward compatibility: an omitted `--type` with a bare path resolves to CSV,
 * so `dolex sources add <name> <path>` keeps working unchanged.
 */
const SUPPORTED_TYPES = ['csv', 'postgres', 'mongodb'];
/**
 * Resolve generic args into a typed `DataSourceConfig`. Throws an `Error` with
 * an actionable message when required fields are missing or the type is unknown.
 */
export function resolveSourceConfig(args) {
    const rawType = args.type?.trim().toLowerCase();
    const type = (rawType || 'csv');
    if (!SUPPORTED_TYPES.includes(type)) {
        throw new Error(`Unsupported source type "${args.type}". Use one of: ${SUPPORTED_TYPES.join(', ')}.`);
    }
    switch (type) {
        case 'csv':
            return resolveCsv(args);
        case 'postgres':
            return resolvePostgres(args);
        case 'mongodb':
            return resolveMongo(args);
    }
}
function resolveCsv(args) {
    if (!args.path) {
        throw new Error('CSV source requires a path to a .csv file or a directory of CSVs.');
    }
    return { type: 'csv', path: args.path };
}
function resolvePostgres(args) {
    const hasDiscrete = Boolean(args.host || args.database || args.user);
    if (!args.uri && !hasDiscrete) {
        throw new Error('Postgres source requires --uri <connection-string>, or discrete --host/--database (plus optional --port/--user/--password/--schema).');
    }
    const config = { type: 'postgres' };
    if (args.uri)
        config.connectionString = args.uri;
    if (args.host)
        config.host = args.host;
    if (args.port !== undefined)
        config.port = args.port;
    if (args.database)
        config.database = args.database;
    if (args.user)
        config.user = args.user;
    if (args.password)
        config.password = args.password;
    if (args.passwordEnv)
        config.passwordEnv = args.passwordEnv;
    if (args.schema)
        config.schema = args.schema;
    return config;
}
function resolveMongo(args) {
    if (!args.database) {
        throw new Error('Mongo source requires --database (a Mongo connection has no single default db).');
    }
    if (!args.uri && !args.host) {
        throw new Error('Mongo source requires --uri <connection-string> or --host (plus optional --port).');
    }
    const config = { type: 'mongodb', database: args.database };
    if (args.uri)
        config.uri = args.uri;
    if (args.host)
        config.host = args.host;
    if (args.port !== undefined)
        config.port = args.port;
    if (args.collections && args.collections.length > 0)
        config.collections = args.collections;
    return config;
}
