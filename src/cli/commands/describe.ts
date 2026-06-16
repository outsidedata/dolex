/**
 * `dolex describe` — profile a dataset: per-column type/role/stats/top values
 * plus a few sample rows.
 */

import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { classifyColumns } from '../../analysis/classify.js';

const BOOLEANS = ['json', 'help'];
const ALIASES: Record<string, string> = { h: 'help' };

export async function describeCommand(argv: string[]): Promise<number> {
  const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
  if (bool(args, 'help')) {
    printHelp();
    return 0;
  }

  const target = args._[0];
  if (!target) {
    o.fail('Usage: dolex describe <csv|source>');
    return 1;
  }

  const opened = await openTarget(target, { table: str(args, 'from') });
  try {
    if (bool(args, 'json')) {
      o.out(JSON.stringify(opened.schema, null, 2));
      return 0;
    }

    for (const t of opened.tables) {
      o.heading(`${t.name}  ${o.c.dim(`(${t.rowCount} rows × ${t.columns.length} cols)`)}`);

      const roles = new Map(classifyColumns(t.columns).map((c) => [c.name, c.role]));
      const colRows = t.columns.map((col) => ({
        column: col.name,
        type: col.type,
        role: roles.get(col.name) ?? '',
        unique: col.uniqueCount,
        nulls: col.nullCount,
        summary: summarize(col),
      }));
      o.out(o.table(['column', 'type', 'role', 'unique', 'nulls', 'summary'], colRows));

      const sample = await opened.query(`SELECT * FROM "${t.name}" LIMIT 6`);
      if (sample.ok && sample.rows && sample.rows.length > 0) {
        const cols = sample.columns ?? Object.keys(sample.rows[0]);
        o.out('');
        o.out(o.c.dim('  sample rows'));
        o.out(
          o
            .table(cols, sample.rows)
            .split('\n')
            .map((l) => '  ' + l)
            .join('\n'),
        );
      }
    }
    return 0;
  } finally {
    await opened.close();
  }
}

function summarize(col: { type: string; stats?: { min: number; max: number; mean: number }; topValues?: { value: string; count: number }[] }): string {
  if (col.stats) {
    const { min, max, mean } = col.stats;
    return `${fmtNum(min)} … ${fmtNum(max)} (mean ${fmtNum(mean)})`;
  }
  if (col.topValues && col.topValues.length > 0) {
    return col.topValues.slice(0, 3).map((v) => `${v.value} (${v.count})`).join(', ');
  }
  return '';
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function printHelp(): void {
  o.out(`${o.c.bold('dolex describe')} — profile a dataset's columns

${o.c.bold('USAGE')}
  dolex describe <csv|source> [options]

${o.c.bold('OPTIONS')}
  --from <table>   Pick a table when the source has several
  --json           Emit the full schema as JSON`);
}
