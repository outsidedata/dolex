/**
 * `dolex query` — run read-only SQL against a CSV / source and print rows.
 * Formats: table (default), json, ndjson, csv.
 */
import { parseArgs, str, num, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
const BOOLEANS = ['json', 'help'];
const ALIASES = { h: 'help', f: 'format' };
export async function queryCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const target = args._[0];
    const sql = args._[1] ?? str(args, 'sql');
    if (!target || !sql) {
        o.fail('Usage: dolex query <csv|source> "SELECT …"');
        return 1;
    }
    const format = (bool(args, 'json') ? 'json' : str(args, 'format')) ?? 'table';
    const opened = await openTarget(target, { table: str(args, 'from') });
    try {
        const res = await opened.query(sql, num(args, 'limit'));
        if (!res.ok) {
            o.fail(res.error ?? 'Query failed.');
            return 1;
        }
        const rows = res.rows ?? [];
        const columns = res.columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
        switch (format) {
            case 'json':
                o.out(JSON.stringify(rows, null, 2));
                break;
            case 'ndjson':
                for (const r of rows)
                    o.out(JSON.stringify(r));
                break;
            case 'csv':
                o.out(o.toCsv(columns, rows));
                break;
            case 'table':
            default: {
                o.out(o.table(columns, rows));
                const summary = res.truncated
                    ? `${rows.length} rows ${o.c.yellow('(capped)')}`
                    : `${rows.length} rows`;
                o.err(o.c.dim(summary));
                break;
            }
        }
        return 0;
    }
    finally {
        await opened.close();
    }
}
function printHelp() {
    o.out(`${o.c.bold('dolex query')} — run SQL and print rows

${o.c.bold('USAGE')}
  dolex query <csv|source> "SELECT …" [options]

${o.c.bold('OPTIONS')}
  -f, --format <fmt>   table (default) | json | ndjson | csv
  --json               Shorthand for --format json
  --limit <n>          Max rows (default 10000)
  --from <table>       Pick a table when the source has several

${o.c.dim('Custom aggregates: MEDIAN, STDDEV, P25, P75, P10, P90. Read-only (SELECT/WITH) only.')}`);
}
