# Dolex CLI

`dolex` is a command-line data-analysis tool. Point it at a CSV file or directory —
or a live PostgreSQL or MongoDB database — describe what you want to see, and it
matches the visualization to the shape of your data and the question being asked,
runs your query, and writes a self-contained HTML chart (or a PNG) from the
43-pattern library. It runs locally on your own data.

> **The MCP server still ships.** An MCP client launching `dolex` over stdio gets the
> server (so `command: "dolex"` configs keep working); `dolex mcp` starts it explicitly.
> Everything an AI assistant could do through MCP, a human (or a shell script) can now do directly.

## Why a CLI is possible here

Dolex's intelligence was never coupled to MCP. The MCP server (`src/mcp/`) is a thin
frontend over transport-agnostic core modules:

- `selectPattern()` — scores all 43 patterns against data shape + intent
- `buildOutputHtml()` / `buildChartHtml()` — render a spec to self-contained HTML
- `SourceManager` + the connectors — CSV into in-memory SQLite, live Postgres queried in place, MongoDB via aggregation pipelines
- `buildAnalysisPlan()` — generate an analysis plan with ready-to-run SQL
- `registry` — the pattern catalog

The CLI is a **second frontend** over the exact same core. It is in fact *lighter* than
the MCP server: the core visualization/analysis commands don't need the MCP SDK at all.
`better-sqlite3` + `papaparse` are loaded lazily, only when a command actually touches a
CSV, so `dolex patterns` and inline-JSON visualization work with zero optional deps.

## Command surface

```
dolex <command> [arguments] [options]

  visualize <csv|source|->   Turn data into a chart (HTML, optionally PNG)
  refine <hash>              Tweak a chart by its hash: sort, filter, palette, switch type…
  query <csv|source> <sql>   Run SQL and print rows (table / json / csv / ndjson)
  analyze <csv|source>       Auto-generate an analysis plan with ready-to-run SQL
  describe <csv|source>      Profile columns: types, stats, top values, sample rows
  check <csv|source>         Audit for bad data & footguns (type traps, sentinels, dupes…)
  transform <csv|source>     Add a persisted derived column (--create … --expr …)
  columns <csv|source>       List columns by layer (source / derived / working)
  drop <csv|source>          Remove derived/working columns
  patterns [id]              List the 43 chart patterns, or show one in detail
  sources <list|add|…>       Register & manage data sources — CSV / Postgres / MongoDB (~/.dolex/sources.json)
  deps                       Report which data sources & optional features are available here
  mcp                        Run the MCP stdio server (for Claude Desktop / agents)
  help [command]             Show help; version with --version
```

### Data resolution (shared by visualize / query / analyze / describe)

The first positional is a **target**, resolved in this order:

1. An existing `.csv` file or a directory of CSVs → loaded into an **ephemeral**
   in-memory SQLite database (not registered anywhere).
2. Otherwise, the name or id of a **registered source** (`dolex sources add …`),
   stored in `~/.dolex/sources.json` — the same registry the MCP server uses.

`visualize` also accepts inline data:

- `--data <file.json>` — a JSON array of row objects
- `-` as the target, or `--stdin` — read a JSON array from stdin (pipe-friendly)

Table names are derived from the CSV filename (`video_games_sales.csv` →
`video_games_sales`). `describe` prints them, and SQL errors list the available
tables/columns, so you always know what to put in `FROM`.

### visualize

```
dolex visualize sales.csv -i "compare revenue by region"
dolex visualize sales.csv --sql "SELECT region, SUM(rev) revenue FROM sales GROUP BY 1" -i "revenue by region"
dolex visualize diamonds.csv -i "price vs carat" --pattern scatter --png chart.png
cat rows.json | dolex visualize - -i "trend over time" --stdout > chart.html
```

| Flag | Meaning |
|------|---------|
| `-i, --intent <text>` | What you want to see (drives pattern selection). **Recommended.** |
| `--sql <query>` | Slice/aggregate before charting (SELECT/CTE only). |
| `--pattern <id>` | Force a specific chart type (bypasses scoring). |
| `--title`, `--subtitle` | Chart titles, set upfront. |
| `--palette <name>` | Named palette (`blue`, `warm`, `blueRed`, …). |
| `--highlight <v,v>` | Emphasize specific category values. |
| `--color-field <col>` | Which column drives color. |
| `--no-table` | Omit the companion data table. |
| `--geo-level`, `--geo-region` | Geographic overrides for maps. |
| `-o, --out <file>` | Output HTML path (default: `~/.dolex/charts/chart-<id>.html`). |
| `--png <file>` | Also render a PNG (requires `playwright`). |
| `--open` | Open the chart in the default browser. |
| `--stdout` | Write the HTML to stdout instead of a file. |
| `--json` | Print the recommendation metadata as JSON. |
| `--data <file.json>`, `--stdin` | Inline data sources. |

Every run prints the **chosen pattern, the reasoning, and ranked alternatives** — the
design intelligence is the point. It also prints the `specId`, which `refine` consumes.

### refine

Charts are persisted to `~/.dolex/specs/<hash>.json` (set `DOLEX_HOME` to relocate the
state dir) so refinement works **across separate CLI invocations** (the MCP server kept
specs only in memory). Pass the **hash**
that `visualize`/`refine` printed — there is deliberately no shared "last" pointer, which
would cross streams between concurrent CLI processes (parallel agents). Each `refine`
prints a fresh hash; pass it back to chain. The `spec-` prefix is optional on input.

```
dolex refine spec-1a2b3c4d --sort desc --limit 10
dolex refine spec-1a2b3c4d --palette blueRed --highlight "North,South"
dolex refine 1a2b3c4d --switch-pattern lollipop --flip      # prefix optional
```

Supports every operation the MCP `refine_visualization` tool does: `--sort field:dir`,
`--limit N`, `--filter 'field op v,v'`, `--flip`, `--palette`, `--highlight`,
`--color-field`, `--format`, `--switch-pattern`, `--title/--subtitle/--x-label/--y-label`,
and compound ops (`--remove-table`, `--layout`, `--hide-columns`). Output flags
(`-o`, `--png`, `--open`, `--stdout`, `--json`) match `visualize`.

### query

```
dolex query games.csv "SELECT genre, COUNT(*) n FROM video_games_sales GROUP BY 1 ORDER BY n DESC"
dolex query games.csv "SELECT * FROM video_games_sales LIMIT 5" --format json
```

`--format table|json|csv|ndjson` (default `table`), `--limit N`. Custom aggregates
`MEDIAN/STDDEV/P25/P75/P10/P90` are available. Read-only (SELECT/WITH) is enforced.

### transform / columns / drop — the derived-column layer

Add computed columns that **persist** to a `.dolex.json` manifest next to the CSV and
are restored automatically on the next load (the connector replays the manifest on
connect, so they survive across separate CLI invocations and are shared with the MCP
server). The MCP server splits this into `transform_data` (a session-only "working"
column) + `promote_columns` (commit to the persisted "derived" layer); since a CLI
process is stateless, `transform` creates **and** persists in one step.

```
dolex transform diamonds.csv --create price_per_carat --expr "price / carat"
dolex transform diamonds.csv --create z_ppc --expr "zscore(price_per_carat)"   # chains on the prior column
dolex query     diamonds.csv "SELECT cut, AVG(price_per_carat) FROM diamonds GROUP BY 1"
dolex columns   diamonds.csv                 # source / derived / working
dolex drop      diamonds.csv z_ppc           # dependents must be dropped first
```

`transform` flags: `--create <name>`, `--expr "<expression>"`, `--type`, `--partition-by <col>`,
`--table <name>`, `--dry-run` (compute + show stats without persisting), `--json`.
Expressions support arithmetic, `log/zscore/rank/percentile_rank/sqrt`, `if_else`/`case`,
and string ops. `drop` takes `--layer derived|working` and supports `"*"`.

**Column names in `--expr`:** use them bare (`price / carat`) or, for names with spaces
or special characters, in **backticks** (`` `World Wide Sales (in $)` ``). Double quotes
are **string literals**, not column references. The engine fails loud rather than compute
silently-wrong results: a quoted literal matching a column name, or any expression that
collapses to all-null, is a hard error — never a quietly-bad column.

### check — audit data before you trust it

A read-only data-quality + footgun audit. Run it first on unfamiliar data.

```
dolex check sales.csv            # human report, grouped by severity
dolex check data/ --json         # machine-readable (every table in the dir)
```

Flags, ranked HIGH / MEDIUM / LOW: **type traps** (numbers stored as text →
lexicographic comparisons), **accounting-style negatives** (`(1,234)` that SQLite
reads as `0`, silently dropping the sign), **mixed-type** columns, **all-null /
constant** columns, **identical/leaked** columns, **duplicate rows**, **missing-value
sentinels** (`N/A`, `-999`, …), **suspicious zeros** (a `0` that's really a missing
value), **boolean variants** (`yes`/`Y`/`true` counted as separate categories),
**invisible whitespace** (leading/trailing spaces, non-breaking/zero-width unicode),
numeric **outliers**, and **quoting footguns** (names needing backticks,
year-as-number). **Exits non-zero on HIGH-severity findings**, so scripts/agents can
gate on it.

The CSV loader also defends correctness at load time: numeric columns get NUMERIC
affinity (so `MAX`/`ORDER BY` are numeric, not lexicographic), and any
non-numeric cell in a numeric column (`''`, `N/A`, stray text) is stored as NULL
rather than silently poisoning aggregates.

### analyze / describe / patterns

```
dolex analyze diamonds.csv               # 4-6 step plan, each with ready SQL + suggested pattern
dolex describe diamonds.csv              # column roles, stats, top values, sample rows
dolex patterns                           # all 43, grouped by category
dolex patterns bump-chart                # one pattern in detail
```

`--json` is available on `analyze`, `describe`, and `patterns` for scripting.

### sources — the data-source registry

`dolex sources` registers named sources in `~/.dolex/sources.json` (the same registry
the MCP server reads). A source is a **CSV** file/directory, a **PostgreSQL** database,
or a **MongoDB** database — once registered, every command (`visualize`, `query`,
`analyze`, `describe`, `check`) takes the name in place of a path.

```
dolex sources add sales ./data/sales.csv                                             # CSV (default type)
dolex sources add warehouse --type postgres --host db --database analytics --user reader --password-env PGPASSWORD
dolex sources add events    --type mongodb  --host localhost --port 27017 --database app
dolex sources list                                                                   # name / id / type / location
dolex sources test warehouse             # is the DB reachable with its saved credentials?
dolex sources update warehouse --host new-db   # patch a connection field
dolex sources remove sales
```

Credentials never land in the registry: pass `--password-env <VAR>` and Dolex reads the
secret from that env var at connect time. A database source can be registered while its DB
is down — `sources test` classifies exactly what's wrong (unreachable / auth-failed /
db-not-found / driver-missing) so you know what to fix. Flags: `--type`, `--uri`
(libpq DSN or Mongo URI), `--host/--port/--database/--user/--schema`, `--password-env`,
and `--collections` (Mongo: restrict introspection).

### deps — what can I connect to here?

The environment twin of `check`: `check` audits your **data**, `deps` audits your
**install**. It reports which source types are ready (CSV always; Postgres/MongoDB only
when their optional driver is installed), whether `python3` is present (for `clean`), and
the one command to enable anything missing — so an agent can confirm readiness before it
tries to connect.

```
dolex deps            # human-readable table: sources + optional features + how to enable
dolex deps --json     # machine-readable capability report (for an AI agent to gate on)
```

Exits non-zero only when a **core** dependency is missing (a broken base install); a
missing optional DB driver is reported, not failed.

## Architecture

```
src/cli/
  index.ts            dispatcher: argv → command; `mcp` dynamic-imports the server
  args.ts             dependency-free flag/positional parser
  output.ts           TTY-aware colors, ASCII tables, sections (NO_COLOR honored)
  spec-disk.ts        disk-backed StoredSpec store at ~/.dolex/specs/ (+ `last` pointer)
  data-source.ts      target resolution (file → ephemeral SM, name → persistent SM), inline JSON
  render.ts           write HTML, open in browser, render PNG (lazy playwright)
  commands/
    visualize.ts  refine.ts  query.ts  analyze.ts  describe.ts  check.ts  clean.ts
    patterns.ts  sources.ts  deps.ts  transform.ts  columns.ts  drop.ts  mcp.ts  help.ts
```

Reused unchanged from the core: `selectPattern`, `handleVisualizeCore`, `handleRefine`,
`buildAnalysisPlan`, `registry`, `SourceManager`, `buildOutputHtml`, and the four derived-
layer handlers (`handleTransformData`, `handlePromoteColumns`, `handleListTransforms`,
`handleDropColumns`). Small additive changes enable the CLI without changing behavior:

- `src/patterns/select-callback.ts` — the `VisualizeInput → VisualizeOutput` bridge,
  extracted from `mcp/index.ts` so both frontends share one copy.
- `SpecStore.restore(id, entry)` — hydrate an in-memory spec from disk before reusing
  the existing `handleRefine` logic.
- **Manifest replay wired into the CSV connector** (`connect()` now replays a source's
  `.dolex.json` derived columns). This was a documented-but-unwired behavior; finishing
  it makes persisted derived columns work for both the CLI (stateless) and the MCP
  server (across restarts). `dolex transform` then composes `transform_data` +
  `promote_columns` in one step so a stateless invocation produces a durable column.

### Entry point

`package.json` `bin.dolex` now points at the CLI dispatcher (`dist/src/cli/index.js`).
`dolex mcp` dynamic-imports `mcp/index.js` (whose `main()` runs on import) so the server
only starts for that subcommand. `.mcp.json` and `scripts/mcp-server.sh` invoke the
server via `dolex mcp` / the compiled entry.
