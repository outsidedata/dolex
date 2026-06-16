/**
 * `dolex drop` — remove derived (or working) columns. Validates dependencies
 * and updates the persisted manifest.
 */

import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { handleDropColumns } from '../../mcp/tools/drop-columns.js';

const BOOLEANS = ['json', 'help'];
const ALIASES: Record<string, string> = { h: 'help', from: 'table' };

export async function dropCommand(argv: string[]): Promise<number> {
  const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
  if (bool(args, 'help')) {
    printHelp();
    return 0;
  }

  const target = args._[0];
  const columns = args._.slice(1);
  if (!target || columns.length === 0) {
    o.fail('Usage: dolex drop <csv|source> <column...> [--layer derived|working]');
    return 1;
  }

  const opened = await openTarget(target, { table: str(args, 'table') });
  try {
    const table = opened.defaultTable;
    const drop = handleDropColumns({ sourceManager: opened.manager });
    const res = await drop({
      sourceId: opened.sourceId,
      table,
      columns,
      layer: str(args, 'layer') as 'derived' | 'working' | undefined,
    });
    const body = JSON.parse(res.content[0].text);
    if ((res as { isError?: boolean }).isError) {
      o.fail(body.error ?? 'Drop failed.');
      return 1;
    }

    if (bool(args, 'json')) {
      o.out(JSON.stringify(body, null, 2));
      return 0;
    }

    o.success(`Dropped ${(body.dropped as string[]).map((c) => o.c.bold(c)).join(', ')}`);
    if (body.restored?.length) {
      o.kv('restored', `${(body.restored as string[]).join(', ')} ${o.c.dim('(derived values under a removed working shadow)')}`);
    }
    o.kv('remaining', `${body.derived_remaining} derived, ${body.working_remaining} working`);
    return 0;
  } finally {
    await opened.close();
  }
}

function printHelp(): void {
  o.out(`${o.c.bold('dolex drop')} — remove derived/working columns

${o.c.bold('USAGE')}
  dolex drop <csv|source> <column...> [options]

${o.c.bold('OPTIONS')}
  --layer <derived|working>   Which layer to drop from (auto-detected if omitted)
  --table <name>              Pick a table when the source has several

${o.c.dim('Dropping a derived column that others depend on is rejected — drop dependents first.')}
${o.c.dim('Use "*" with --layer to drop every column in that layer.')}`);
}
