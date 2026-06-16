/**
 * `dolex columns` (alias `transforms`) — list a table's columns by layer:
 * source (from the CSV), derived (persisted expressions), working (session-only,
 * normally empty for the stateless CLI).
 */
import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { handleListTransforms } from '../../mcp/tools/list-transforms.js';
const BOOLEANS = ['json', 'help'];
const ALIASES = { h: 'help', from: 'table' };
export async function columnsCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const target = args._[0];
    if (!target) {
        o.fail('Usage: dolex columns <csv|source>');
        return 1;
    }
    const opened = await openTarget(target, { table: str(args, 'table') });
    try {
        const table = opened.defaultTable;
        const list = handleListTransforms({ sourceManager: opened.manager });
        const body = JSON.parse((await list({ sourceId: opened.sourceId, table })).content[0].text);
        if (bool(args, 'json')) {
            o.out(JSON.stringify(body, null, 2));
            return 0;
        }
        o.heading(`${table} — ${body.total_columns} columns`);
        o.out(`  ${o.c.gray('source')} ${o.c.dim(`(${body.source_columns.length})`)}`);
        if (body.source_columns.length > 0) {
            o.out(`    ${o.c.dim(body.source_columns.join(', '))}`);
        }
        o.out('');
        o.out(`  ${o.c.cyan('derived')} ${o.c.dim(`(${body.derived_columns.length}, persisted)`)}`);
        for (const col of body.derived_columns) {
            const part = col.partitionBy ? o.c.dim(` partitionBy ${col.partitionBy}`) : '';
            o.out(`    ${o.c.bold(col.column)} ${o.c.dim(`[${col.type}]`)} = ${col.expr}${part}`);
        }
        if (body.working_columns.length > 0) {
            o.out('');
            o.out(`  ${o.c.yellow('working')} ${o.c.dim(`(${body.working_columns.length}, session-only)`)}`);
            for (const col of body.working_columns) {
                o.out(`    ${o.c.bold(col.column)} ${o.c.dim(`[${col.type}]`)} = ${col.expr}`);
            }
        }
        return 0;
    }
    finally {
        await opened.close();
    }
}
function printHelp() {
    o.out(`${o.c.bold('dolex columns')} — list columns by layer (source / derived / working)

${o.c.bold('USAGE')}
  dolex columns <csv|source> [--table <name>] [--json]`);
}
