/**
 * `dolex sources` — manage the persistent data-source registry at
 * `~/.dolex/sources.json` (CSV / Postgres / MongoDB; shared with the MCP server's `load_source`).
 */
import { resolve } from 'path';
import { parseArgs, bool, str, num, list } from '../args.js';
import * as o from '../output.js';
import { persistentManager } from '../data-source.js';
import { resolveSourceConfig } from '../../connectors/source-factory.js';
export async function sourcesCommand(argv) {
    const args = parseArgs(argv, {
        booleans: ['json', 'help', 'verify'],
        aliases: { h: 'help' },
    });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const sub = args._[0] ?? 'list';
    const manager = await persistentManager();
    switch (sub) {
        case 'list': {
            const entries = manager.list();
            if (bool(args, 'json')) {
                o.out(JSON.stringify(entries, null, 2));
                return 0;
            }
            if (entries.length === 0) {
                o.hint('No registered sources. Add one:  dolex sources add <name> <path.csv>');
                return 0;
            }
            o.out(o.table(['name', 'id', 'type', 'location'], entries.map((e) => ({ name: e.name, id: e.id, type: e.type, location: describeLocation(e.config) }))));
            return 0;
        }
        case 'add': {
            const name = args._[1];
            const pathArg = args._[2];
            if (!name) {
                o.fail('Usage: dolex sources add <name> <path-to-csv-or-dir>');
                o.hint('Or a database source:  dolex sources add <name> --type postgres|mongodb --uri <conn-string>');
                return 1;
            }
            const type = str(args, 'type');
            // CSV path may come as a positional (backward-compatible) or --path.
            const path = str(args, 'path') ?? pathArg;
            let config;
            try {
                config = resolveSourceConfig({
                    type,
                    // Resolve CSV paths to absolute so the registry entry is cwd-independent.
                    path: path !== undefined ? resolve(path) : undefined,
                    uri: str(args, 'uri'),
                    host: str(args, 'host'),
                    port: num(args, 'port'),
                    database: str(args, 'database'),
                    user: str(args, 'user'),
                    password: str(args, 'password'),
                    passwordEnv: str(args, 'password-env'),
                    schema: str(args, 'schema'),
                    collections: list(args, 'collections'),
                });
            }
            catch (e) {
                o.fail(e instanceof Error ? e.message : String(e));
                return 1;
            }
            if (str(args, 'password')) {
                o.warn('--password is stored in plaintext in ~/.dolex/sources.json (locked to your user). Prefer --password-env <VAR> to keep the secret out of the file.');
            }
            // Config-first: register even if the DB is unreachable right now (unless --verify). liveness is
            // reported, not required — so setup never depends on the DB being up this second.
            const res = await manager.add(name, config, { verify: bool(args, 'verify') });
            if (!res.ok) {
                o.fail(res.error ?? 'Failed to add source.');
                return 1;
            }
            o.success(`Added "${name}" (${res.entry.id}) [${config.type}]`);
            if (config.type !== 'csv' && res.verified === false) {
                o.warn(`Registered, but couldn't connect yet: ${res.warning}`);
                o.hint(`Fix the DB/credentials, then verify:  dolex sources test ${name}   (or update:  dolex sources update ${name} --host … )`);
            }
            else {
                o.hint(`Use it:  dolex visualize ${name} -i "…"   ·   dolex analyze ${name}`);
            }
            return 0;
        }
        case 'test': {
            const idOrName = args._[1];
            if (!idOrName) {
                o.fail('Usage: dolex sources test <name|id>');
                return 1;
            }
            const r = await manager.testSource(idOrName);
            if (bool(args, 'json')) {
                o.out(JSON.stringify({ source: idOrName, ...r }, null, 2));
                return r.ok ? 0 : 1;
            }
            if (r.ok) {
                o.success(`"${idOrName}" is reachable ✓`);
                return 0;
            }
            o.fail(`"${idOrName}" is not reachable [${r.kind}]: ${r.error}`);
            const nextStep = {
                'driver-missing': 'install the driver (see the message above), then retry',
                'unreachable': 'start the database / check host+port, then:  dolex sources test ' + idOrName,
                'host-not-found': 'fix the host, then:  dolex sources update ' + idOrName + ' --host <host>',
                'timeout': 'check the network/firewall or the DB is slow to accept connections',
                'auth-failed': 'fix credentials:  dolex sources update ' + idOrName + ' --user <u> --password-env <VAR>',
                'db-not-found': 'fix the database name:  dolex sources update ' + idOrName + ' --database <db>',
            };
            if (r.kind && nextStep[r.kind])
                o.hint(nextStep[r.kind]);
            return 1;
        }
        case 'update': {
            const idOrName = args._[1];
            if (!idOrName) {
                o.fail('Usage: dolex sources update <name|id> [--host … --port … --database … --user … --password-env … --uri …]');
                return 1;
            }
            const patch = {};
            for (const k of ['uri', 'host', 'database', 'user', 'password', 'password-env', 'schema']) {
                const v = str(args, k);
                if (v !== undefined)
                    patch[k === 'uri' ? 'connectionString' : k === 'password-env' ? 'passwordEnv' : k] = v;
            }
            const p = num(args, 'port');
            if (p !== undefined)
                patch.port = p;
            if (Object.keys(patch).length === 0) {
                o.fail('Nothing to update. Pass at least one of --host/--port/--database/--user/--password-env/--uri/--schema.');
                return 1;
            }
            if (patch.password)
                o.warn('--password is stored in plaintext. Prefer --password-env <VAR>.');
            const res = await manager.update(idOrName, patch, { verify: bool(args, 'verify') });
            if (!res.ok) {
                o.fail(res.error ?? 'Failed to update source.');
                return 1;
            }
            o.success(`Updated "${idOrName}"`);
            if (res.verified === false)
                o.warn(`Saved, but still can't connect: ${res.warning}. Test again:  dolex sources test ${idOrName}`);
            return 0;
        }
        case 'remove':
        case 'rm': {
            const idOrName = args._[1];
            if (!idOrName) {
                o.fail('Usage: dolex sources remove <name|id>');
                return 1;
            }
            const res = await manager.remove(idOrName);
            if (!res.ok) {
                o.fail(res.error ?? 'Failed to remove source.');
                return 1;
            }
            o.success(`Removed "${idOrName}"`);
            return 0;
        }
        default:
            o.fail(`Unknown subcommand: ${sub}`);
            printHelp();
            return 1;
    }
}
/** One-line summary of where a source lives, for the `list` table. */
/** host:port/database for a live DB source (the connection string wins if present). */
const hostPortDb = (connStr, host, port, database) => connStr ?? [host, port].filter(Boolean).join(':') + (database ? `/${database}` : '');
function describeLocation(config) {
    switch (config.type) {
        case 'csv':
            return config.path ?? '';
        case 'postgres':
            return hostPortDb(config.connectionString, config.host, config.port, config.database);
        case 'mongodb':
            return hostPortDb(config.uri, config.host, config.port, config.database);
    }
}
function printHelp() {
    o.out(`${o.c.bold('dolex sources')} — manage the persistent source registry

${o.c.bold('USAGE')}
  dolex sources list
  dolex sources add <name> <path-to-csv-or-dir>
  dolex sources add <name> --type postgres --host <h> --database <db> [--user <u> --password-env PGPASSWORD]
  dolex sources add <name> --type mongodb  --host <h> --port <p> --database <db>
  dolex sources test <name|id>                       # is the saved DB reachable? (classified reason)
  dolex sources update <name|id> [--host … --port … --database … --user … --password-env … --uri …]
  dolex sources remove <name|id>

${o.c.bold('OPTIONS (add / update)')}
  --type          csv | postgres | mongodb   (default: csv)
  --uri           connection string (libpq DSN for postgres, URI for mongodb)
  --host/--port/--database/--user/--schema     discrete connection fields
  --password-env  name of an env var holding the password (preferred — keeps the secret OUT of the file)
  --password      literal password (stored in plaintext; --password-env is safer)
  --verify        require a successful connection to register (default: register config-first even if the DB is down)
  --collections   mongodb: comma-separated list to restrict introspection

${o.c.dim('Config-first: a source registers even if its DB is momentarily down — run `sources test` once it is up.')}
${o.c.dim('Stored in ~/.dolex/sources.json (locked to your user; passwords via --password-env are NOT written). Shared with the MCP server.')}`);
}
