/**
 * `dolex transform` — add a derived column to a dataset using the expression
 * language, persisted so later commands (and the MCP server) can use it.
 *
 * The MCP server splits this into transform_data (creates a session-only
 * "working" column) + promote_columns (commits it to the persisted "derived"
 * layer). A CLI process is stateless, so a working column would vanish on exit;
 * `transform` therefore creates AND persists in one step by default. Use
 * `--dry-run` to compute and preview the column's stats without persisting.
 */

import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { handleTransformData } from '../../mcp/tools/transform-data.js';
import { handlePromoteColumns } from '../../mcp/tools/promote-columns.js';
import { resolveManifestPath } from '../../transforms/manifest.js';
import type { CsvSourceConfig } from '../../types.js';

const BOOLEANS = ['dry-run', 'json', 'help'];
const ALIASES: Record<string, string> = { h: 'help', from: 'table' };

export async function transformCommand(argv: string[]): Promise<number> {
  const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
  if (bool(args, 'help')) {
    printHelp();
    return 0;
  }

  const target = args._[0];
  const create = str(args, 'create');
  const expr = str(args, 'expr');
  if (!target || !create || !expr) {
    o.fail('Usage: dolex transform <csv|source> --create <name> --expr "<expression>"');
    o.hint('Example:  dolex transform diamonds.csv --create price_per_carat --expr "price / carat"');
    return 1;
  }

  const dryRun = bool(args, 'dry-run');
  const opened = await openTarget(target, { table: str(args, 'table') });
  try {
    const table = opened.defaultTable;

    const transform = handleTransformData({ sourceManager: opened.manager });
    const tRes = await transform({
      sourceId: opened.sourceId,
      table,
      create,
      expr,
      type: str(args, 'type') as any,
      partitionBy: str(args, 'partition-by'),
    } as any);
    const tBody = JSON.parse(tRes.content[0].text);
    if ((tRes as { isError?: boolean }).isError) {
      o.fail(tBody.error ?? 'Transform failed.');
      return 1;
    }

    const col = tBody.created?.[0] ?? { column: create, expr, type: 'unknown' };

    let manifestPath: string | undefined;
    if (!dryRun) {
      const promote = handlePromoteColumns({ sourceManager: opened.manager });
      const pRes = await promote({ sourceId: opened.sourceId, table, columns: [create] });
      const pBody = JSON.parse(pRes.content[0].text);
      if ((pRes as { isError?: boolean }).isError) {
        o.fail(pBody.error ?? 'Could not persist the column.');
        return 1;
      }
      const entry = opened.manager.get(opened.sourceId);
      if (entry?.config) manifestPath = resolveManifestPath(entry.config as CsvSourceConfig);
    }

    if (bool(args, 'json')) {
      o.out(JSON.stringify({ ...tBody, persisted: !dryRun, manifest: manifestPath }, null, 2));
      return 0;
    }

    o.success(`${dryRun ? 'Previewed' : 'Created'} ${o.c.bold(col.column)}  ${o.c.dim('= ' + col.expr)}`);
    o.kv('type', col.type);
    if (col.stats && typeof col.stats === 'object') {
      const fmt = (v: unknown) =>
        typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v);
      for (const [k, v] of Object.entries(col.stats)) o.kv(k, fmt(v));
    }
    if (tBody.warnings?.length) for (const w of tBody.warnings as string[]) o.warn(w);

    if (dryRun) {
      o.warn('Preview only — not persisted. Re-run without --dry-run to keep it.');
    } else {
      if (manifestPath) o.kv('persisted', manifestPath);
      o.hint(`Use it:  dolex query ${target} "SELECT ${col.column} FROM ${table} LIMIT 5"`);
    }
    return 0;
  } finally {
    await opened.close();
  }
}

function printHelp(): void {
  o.out(`${o.c.bold('dolex transform')} — add a persisted derived column

${o.c.bold('USAGE')}
  dolex transform <csv|source> --create <name> --expr "<expression>" [options]

${o.c.bold('OPTIONS')}
  --create <name>        Name of the new column
  --expr <expression>    Expression (see below)
  --type <t>             Force output type: numeric | categorical | date | boolean
  --partition-by <col>   Compute column-wise stats (zscore, rank, …) within groups
  --table <name>         Pick a table when the source has several
  --dry-run              Compute and show stats without persisting
  --json                 Emit the raw transform result

${o.c.bold('EXPRESSIONS')}
  arithmetic   price / carat,  W / G * 100,  player_weight / (player_height/100)^2
  functions    log(price),  zscore(x),  rank(x),  percentile_rank(x),  sqrt(x)
  conditional  if_else(age > 18, "adult", "minor")
               case(price < 1000, "budget", price < 5000, "mid", "luxury")
  strings      lower(name),  upper(code)

  ${o.c.bold('Column names:')} bare for simple names (price); BACKTICKS for names with
  spaces/special chars (\`World Wide Sales (in $)\`). Double quotes are STRING
  LITERALS, not columns — misquoting a column is a hard error, never silent.

${o.c.dim('Derived columns persist to a .dolex.json manifest next to the CSV and are')}
${o.c.dim('restored automatically on the next load. List them with `dolex columns`,')}
${o.c.dim('remove them with `dolex drop`.')}`);
}
