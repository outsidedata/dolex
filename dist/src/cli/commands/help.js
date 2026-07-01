/**
 * Top-level `dolex help` output.
 */
import * as o from '../output.js';
export function printMainHelp(version) {
    const v = version ? o.c.dim(`v${version}`) : '';
    o.out(`${o.c.bold('dolex')} ${v} — data visualization from the command line
${o.c.dim('a data analyst you can trust on your own data — profile, audit, analyze, and chart 43 ways')}

${o.c.bold('USAGE')}
  dolex <command> [arguments] [options]

${o.c.bold('COMMANDS')}
  ${o.c.cyan('visualize')}  <csv|source|->   Turn data into a chart (HTML, optionally PNG)
  ${o.c.cyan('refine')}     <hash>           Tweak a chart by its hash: sort, filter, palette, switch type…
  ${o.c.cyan('query')}      <csv|source> sql Run SQL and print rows (table/json/csv/ndjson)
  ${o.c.cyan('analyze')}    <csv|source>     Auto-generate an analysis plan with ready-to-run SQL
  ${o.c.cyan('describe')}   <csv|source>     Profile columns: types, roles, stats, sample rows
  ${o.c.cyan('check')}      <csv|source>     Audit for bad data & footguns (type traps, sentinels, dupes…)
  ${o.c.cyan('clean')}      <csv>            Remediate a column with a Python clean() you write (preview/apply)
  ${o.c.cyan('transform')}  <csv|source>     Add a persisted derived column (--create … --expr …)
  ${o.c.cyan('columns')}    <csv|source>     List columns by layer (source / derived / working)
  ${o.c.cyan('drop')}       <csv|source>     Remove derived/working columns
  ${o.c.cyan('patterns')}   [id]             List the 43 chart patterns, or show one
  ${o.c.cyan('sources')}    <list|add|rm>    Register & manage data sources (CSV / Postgres / MongoDB)
  ${o.c.cyan('deps')}                        Report which data sources & optional features are available here
  ${o.c.cyan('mcp')}                         Run the MCP stdio server (Claude Desktop / agents)
  ${o.c.cyan('help')}       [command]        Show help; \`--version\` for version

${o.c.bold('EXAMPLES')}
  dolex visualize sales.csv -i "compare revenue by region"
  dolex visualize games.csv --sql "SELECT genre, COUNT(*) n FROM games GROUP BY 1" -i "titles per genre"
  dolex refine spec-1a2b3c4d --sort desc --limit 10 --palette blueRed   # hash from the visualize output
  dolex query diamonds.csv "SELECT cut, MEDIAN(price) FROM diamonds GROUP BY 1" --format json
  dolex analyze diamonds.csv
  dolex transform diamonds.csv --create price_per_carat --expr "price / carat"
  cat rows.json | dolex visualize - -i "trend over time" --png chart.png

${o.c.dim('Run `dolex <command> --help` for command-specific options. Docs: docs/CLI.md')}`);
}
