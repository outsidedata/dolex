```
 ██████╗   ██████╗  ██╗      ███████╗ ██╗  ██╗
 ██╔══██╗ ██╔═══██╗ ██║      ██╔════╝ ╚██╗██╔╝
 ██║  ██║ ██║   ██║ ██║      █████╗    ╚███╔╝
 ██║  ██║ ██║   ██║ ██║      ██╔══╝    ██╔██╗
 ██████╔╝ ╚██████╔╝ ███████╗ ███████╗ ██╔╝ ██╗
 ╚═════╝   ╚═════╝  ╚══════╝ ╚══════╝ ╚═╝  ╚═╝
```

# Dolex turns your AI assistant into a data analyst you can trust on your own data.

A B2B data-analysis product that gives your AI assistant a rigorous analyst's discipline, working on your own files and handing back artifacts you keep.

Dolex connects to your data — a folder of CSV files, or a live PostgreSQL or MongoDB database — audits it, runs the analysis, and returns real results you own. It runs locally: point it at a folder of CSVs and they load as one joinable database, or connect a Postgres/MongoDB source and query it in place. It profiles every column, classifies what each one is, and builds a prioritized analysis plan with ready-to-run queries. Every answer traces back to an inspectable query, and the findings come back as artifacts you keep. Dolex ships as a published npm package with two front ends over one core: an MCP server any AI assistant can call, and a command-line tool your terminals, scripts, and pipelines run directly.

## What you get

- **Analysis on your own data.** Point Dolex at a folder of CSV files — they become one database your assistant can join across — or connect a live PostgreSQL or MongoDB database and query it in place. Same tools, same analysis, whatever the source.
- **Data you can stand behind.** A built-in audit surfaces type traps, sentinel values, leaked and duplicate columns, and outliers before they reach a conclusion.
- **Rigor on every result.** Full column profiling and statistics back the analysis, and each finding traces to a query you can inspect.
- **A real analysis plan.** Dolex classifies your columns and produces a prioritized analysis plan with ready-to-run queries; derived columns persist across sessions.
- **Artifacts you keep.** Findings render across 43 chart types as self-contained HTML or PNG, with React components, a design system, and the queries behind every result.
- **One analyst on call everywhere.** The same core serves your chat assistant and your pipelines, with concurrent work running in its own lane.

## Install

```bash
npm install -g @outsidedata/dolex
```

To update:

```bash
npm update -g @outsidedata/dolex
```

> **Optional — PNG export.** Rendering charts to PNG (the `--png` flag and the MCP `screenshot` tool) needs Playwright, which is *not* installed by default. Enable it once with `npm install playwright && npx playwright install chromium`. Everything else — HTML charts, querying, analysis, the MCP data tools — works without it.

### Claude Desktop

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "dolex": {
      "command": "dolex"
    }
  }
}
```

### Claude Code

```bash
claude mcp add dolex -- dolex
```

### Any MCP Client

Point your client's server command at `dolex`. Launched by an MCP client over stdio, it runs the server. To start it explicitly — or to confirm it boots from a terminal — use the subcommand:

```bash
dolex mcp
```

## Command Line

The same analysis engine, query layer, and 43 chart types are a CLI away — point
it at a CSV and get a chart, an analysis plan, or a data-quality audit.

```bash
# Chart a CSV — the pattern matches the shape of the data
dolex visualize sales.csv -i "compare revenue by region"

# Query first, then chart; force a type and palette; render a PNG
# (PNG export is optional — enable it once with:
#    npm install playwright && npx playwright install chromium)
dolex visualize games.csv \
  --sql "SELECT genre, SUM(na_sales) sales FROM video_games_sales GROUP BY 1" \
  -i "sales by genre" --pattern lollipop --palette blueRed --png genre.png

# Refine the last chart — works across separate invocations
dolex refine spec-1a2b3c4d --sort desc --limit 10   # hash printed by visualize

# Explore without charting
dolex check diamonds.csv          # audit data quality + footguns before trusting it
dolex query diamonds.csv "SELECT cut, MEDIAN(price) FROM diamonds GROUP BY 1" --format json
dolex analyze diamonds.csv        # auto analysis plan with ready-to-run SQL
dolex describe diamonds.csv       # column types, roles, stats, sample rows
dolex patterns                    # browse all 43 chart types

# Persisted derived columns (survive across commands via a .dolex.json manifest)
dolex transform diamonds.csv --create price_per_carat --expr "price / carat"
dolex query     diamonds.csv "SELECT cut, AVG(price_per_carat) FROM diamonds GROUP BY 1"
dolex columns   diamonds.csv      # list source / derived / working columns
```

| Command | What it does |
|---------|-------------|
| `visualize` | Turn a CSV / source / inline JSON into a chart (HTML, optionally PNG) |
| `refine` | Tweak a chart by its hash — sort, filter, palette, switch type, … |
| `query` | Run SQL and print rows (`table` / `json` / `csv` / `ndjson`) |
| `analyze` | Auto-generate an analysis plan with ready-to-run SQL |
| `describe` | Profile columns: types, roles, stats, sample rows |
| `check` | Audit for bad data & footguns (type traps, sentinels, duplicate/leaked columns…) |
| `transform` | Add a persisted derived column (`--create … --expr …`) |
| `columns` | List columns by layer (source / derived / working) |
| `drop` | Remove derived/working columns |
| `patterns` | List the 43 chart patterns, or show one in detail |
| `sources` | Register & manage data sources — CSV, Postgres, MongoDB (shared with the MCP server) |
| `deps` | Report which data sources & optional features are available in this environment |
| `mcp` | Run the MCP stdio server |

Charts default to `~/.dolex/charts/`; pipe-friendly via `--stdout` / `--json`.
Full reference: [`docs/CLI.md`](https://github.com/outsidedata/dolex/blob/master/docs/CLI.md).

## Data Sources

Dolex works the same whether your data is files or a live database. Point it at:

- **CSV** — a single file or a whole folder, loaded as one joinable in-memory database (SQLite under the hood).
- **PostgreSQL** — a live database queried in place with real SQL; declared foreign keys are read straight from the schema.
- **MongoDB** — collections profiled as tables and queried with aggregation pipelines.

The Postgres and MongoDB drivers are **optional** — the base install stays lean and requires neither. Run `dolex deps` (or ask the assistant for `capabilities`) to see which sources are ready here and the exact one-line command to enable anything missing, so you get an install hint instead of a crash. Credentials stay out of the registry file: a Postgres password is read from an env var at connect time, and a source can be registered even while its database is down, then health-checked with `dolex sources test` / the `test_source` tool once it is up.

```bash
# CSV stays the zero-config default
dolex sources add sales ./data/sales.csv

# Live databases — driver installed on demand, secret via env var
dolex sources add warehouse --type postgres --host db.internal --database analytics --user reader --password-env PGPASSWORD
dolex sources add events    --type mongodb  --host localhost --port 27017 --database app
dolex sources test warehouse       # confirm it's reachable with its saved credentials
```

## The Query Engine

Point your assistant at a folder of CSV files — or a live Postgres/MongoDB database — and start asking questions. Dolex profiles your data — column types, distributions, cardinality, sample values — giving your assistant everything it needs to answer.

The built-in query language covers the analysis your assistant runs:

**Aggregations**: `sum`, `avg`, `min`, `max`, `count`, `count_distinct`, `median`, `stddev`, `p25`, `p75`, `percentile`

**Window functions**: `lag`, `lead`, `rank`, `dense_rank`, `row_number`, `running_sum`, `running_avg`, `pct_of_total` — with partition and order control

**Time bucketing**: group by `day`, `week`, `month`, `quarter`, `year` — automatic date parsing

**Joins**: inner and left joins across tables within the same source, with dot-notation field references and ambiguity detection

**Filters**: before aggregation (`filter`) and after (`having`), with operators `=`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not_in`, `between`, `like`, `is_null`, `is_not_null`

Every query is validated before execution — field names are checked against the schema with fuzzy "did you mean?" suggestions for typos.

## 43 Patterns

| Category | What they're for |
|----------|-----------------|
| **Comparison** (9) | Bar, Diverging Bar, Slope Chart, Connected Dot Plot, Bump Chart, Lollipop, Bullet, Grouped Bar, Waterfall |
| **Distribution** (7) | Histogram, Beeswarm, Violin, Ridgeline, Strip Plot, Box Plot, Density Plot |
| **Composition** (9) | Stacked Bar, Waffle, Treemap, Sunburst, Circle Pack, Metric, Donut, Marimekko, Icicle |
| **Time** (7) | Line, Area, Small Multiples, Sparkline Grid, Calendar Heatmap, Stream Graph, Horizon Chart |
| **Relationship** (5) | Scatter, Connected Scatter, Parallel Coordinates, Radar, Heatmap |
| **Flow** (4) | Sankey, Alluvial, Chord, Funnel |
| **Geo** (2) | Choropleth, Proportional Symbol — 33 offline maps (world, US, continents, 17 countries) |

## Tools

| Tool | What it does |
|------|-------------|
| `load_source` | Load a data source — CSV file/directory, PostgreSQL, or MongoDB |
| `list_data` | List loaded datasets |
| `remove_data` | Remove a loaded dataset |
| `capabilities` | Report which source types & optional drivers are available in this environment |
| `test_source` | Health-check a registered Postgres/Mongo source (reachable? credentials valid?) |
| `describe_data` | Profile columns, stats, sample rows |
| `analyze_data` | Auto-generate an analysis plan |
| `query_data` | Run queries (SQL for CSV/Postgres; aggregation pipelines for MongoDB) |
| `visualize` | Data → ranked chart recommendations (inline, cached, or source + query) |
| `refine_visualization` | Iterate on a chart |
| `transform_data` | Create derived columns with expressions |
| `promote_columns` | Persist working columns to disk |
| `list_transforms` | List columns by layer (source/derived/working) |
| `drop_columns` | Drop derived or working columns |
| `clean_column` | Fix one column with a Python `clean(value)` — parse dates, null sentinels, canonicalize categories; preview then non-destructive apply (requires python3) |
| `list_patterns` | Browse all 43 patterns |
| `export_html` | Get raw HTML |
| `screenshot` | Render to PNG |
| `server_status` | Inspect server state |
| `clear_cache` | Reset |

## License

MIT
