/**
 * `dolex visualize` — turn data into a chart.
 *
 * Data comes from a CSV path / registered source (optionally sliced with
 * `--sql`), an inline JSON array (`--data file.json`), or stdin (`-` /
 * `--stdin`). The chart is matched to the shape of the data; `--pattern` forces a specific one.
 */

import { parseArgs, str, bool, num, list, type ParsedArgs } from '../args.js';
import * as o from '../output.js';
import { openTarget, readInlineRows } from '../data-source.js';
import { persistSpec, purgeOldSpecs } from '../spec-disk.js';
import { emitChart } from '../emit.js';
import { handleVisualizeCore } from '../../mcp/tools/visualize.js';
import { selectPatternsCallback } from '../../patterns/select-callback.js';
import { specStore } from '../../mcp/spec-store.js';

const BOOLEANS = ['table', 'open', 'stdout', 'json', 'stdin', 'help'];
const ALIASES: Record<string, string> = { i: 'intent', o: 'out', h: 'help' };

export async function visualizeCommand(argv: string[]): Promise<number> {
  const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
  if (bool(args, 'help')) {
    printHelp();
    return 0;
  }

  const intent = str(args, 'intent') ?? '';
  const target = args._[0];
  const usedStdin = bool(args, 'stdin') || target === '-';
  const dataFile = str(args, 'data');

  let data: Record<string, any>[];
  let queryMeta: { truncated?: boolean; totalSourceRows?: number } | undefined;

  if (usedStdin || dataFile) {
    data = await readInlineRows(dataFile, usedStdin);
  } else if (target) {
    const opened = await openTarget(target, { table: str(args, 'from') });
    try {
      const sql = str(args, 'sql') ?? `SELECT * FROM "${opened.defaultTable}"`;
      const res = await opened.query(sql);
      if (!res.ok) {
        o.fail(res.error ?? 'Query failed.');
        return 1;
      }
      data = res.rows ?? [];
      queryMeta = { truncated: res.truncated, totalSourceRows: res.totalRows };
    } finally {
      await opened.close();
    }
    if (data.length === 0) {
      o.fail('Query returned no rows.');
      return 1;
    }
  } else {
    o.fail('No data. Pass a CSV path / source name, `-` (or `--stdin`), or `--data file.json`.');
    o.hint('Try:  dolex visualize sales.csv -i "compare revenue by region"');
    return 1;
  }

  const highlightValues = list(args, 'highlight');
  const coreArgs = {
    intent,
    pattern: str(args, 'pattern'),
    title: str(args, 'title'),
    subtitle: str(args, 'subtitle'),
    includeDataTable: args.table === false ? false : undefined,
    palette: str(args, 'palette'),
    highlight: highlightValues ? { values: highlightValues } : undefined,
    colorField: str(args, 'color-field'),
    maxAlternativeChartTypes: num(args, 'alternatives'),
    geoLevel: str(args, 'geo-level') as 'country' | 'subdivision' | undefined,
    geoRegion: str(args, 'geo-region'),
  };

  const core = handleVisualizeCore(selectPatternsCallback, 'cli_visualize');
  const result = core(data, coreArgs, queryMeta);
  const body = JSON.parse(result.content[0].text);
  const html = (result as { structuredContent?: { html?: string } }).structuredContent?.html;

  // Persist the spec so `dolex refine` can pick it up in a later invocation.
  purgeOldSpecs();
  const stored = specStore.get(body.specId);
  if (stored) persistSpec(body.specId, stored);

  return emitChart({ args, body, html });
}

function printHelp(): void {
  o.out(`${o.c.bold('dolex visualize')} — turn data into a chart

${o.c.bold('USAGE')}
  dolex visualize <csv|source|-> [options]
  dolex visualize --data rows.json [options]

${o.c.bold('DATA')}
  <csv|source>            A .csv file, a directory of CSVs, or a registered source name
  -, --stdin              Read a JSON array of rows from stdin
  --data <file.json>      Read a JSON array of rows from a file
  --sql <query>           Slice/aggregate before charting (SELECT/CTE only)
  --from <table>          Pick a table when the source has several

${o.c.bold('CHART')}
  -i, --intent <text>     What you want to see (drives pattern selection)
  --pattern <id>          Force a chart type (see \`dolex patterns\`)
  --title, --subtitle     Chart titles
  --palette <name>        Named palette (blue, warm, blueRed, …)
  --highlight <v,v>       Emphasize specific category values
  --color-field <col>     Column that drives color
  --no-table              Omit the companion data table
  --alternatives <n>      How many alternative chart types to report (default 2)
  --geo-level, --geo-region   Map overrides

${o.c.bold('OUTPUT')}
  -o, --out <file>        HTML output path (default: ~/.dolex/charts/chart-<id>.html)
  --png <file>            Also render a PNG (requires playwright)
  --open                  Open the chart in your browser
  --stdout                Write HTML to stdout instead of a file
  --json                  Print recommendation metadata as JSON`);
}
