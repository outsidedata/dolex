```
 ██████╗   ██████╗  ██╗      ███████╗ ██╗  ██╗
 ██╔══██╗ ██╔═══██╗ ██║      ██╔════╝ ╚██╗██╔╝
 ██║  ██║ ██║   ██║ ██║      █████╗    ╚███╔╝
 ██║  ██║ ██║   ██║ ██║      ██╔══╝    ██╔██╗
 ██████╔╝ ╚██████╔╝ ███████╗ ███████╗ ██╔╝ ██╗
 ╚═════╝   ╚═════╝  ╚══════╝ ╚══════╝ ╚═╝  ╚═╝
```

**Your AI data analyst.** Point Claude at a folder of CSV files and get expert-level analysis — no code, no setup, no data leaves your machine.

---

## The Problem

You've got a folder of CSV exports on your desktop. `sales-2024-Q1.csv`, `sales-2024-Q2.csv`, `customers.csv`, `products.csv`. Loose files from different periods, different systems. Right now, turning those into actual insight means one of two things:

1. **The Python REPL loop** — Claude writes a script, runs it, gets an error, fixes it, runs it again, gets a different error, and eventually produces a matplotlib chart with default styling that you'd be embarrassed to put in a deck.

2. **"Here's a bar chart"** — every AI assistant reaches for the same three chart types because they optimize for the most likely token, not the most informative visualization.

Dolex replaces both. No Python. No REPL. No `import pandas`. No `plt.show()`. No debugging dependency conflicts. Just tell Claude: *"load everything in ~/data/ and show me quarterly trends."*

## What It Actually Is

Dolex is an MCP server that gives Claude a complete data analysis toolkit. It runs locally inside Claude — you don't need to know how that works, just install it and Claude gains new abilities:

**Load a whole folder of CSV files at once** — point it at a directory and Dolex loads every CSV it finds, profiles each one automatically (column types, distributions, stats, sample values), and makes them all queryable. Loose quarterly exports, separate files per region, whatever you have — Dolex handles it.

**A built-in query engine** — aggregations (sum, avg, median, stddev, percentiles), time bucketing (group by month/quarter/year), window functions (lag, lead, rank, running totals, percent of total), automatic joins across files, and filters. Handles 500k+ rows. No code generation, no sandboxes — Dolex crunches the numbers directly.

**43 handcrafted visualization patterns** — not chart.js defaults. Bump charts for rankings, beeswarms for distributions, Sankey diagrams for flows, ridgeline plots for comparing distributions, connected dot plots for two-metric comparisons, calendar heatmaps for temporal patterns, and 37 more. Each pattern has selection rules that encode real data visualization expertise.

**Pattern intelligence** — Dolex doesn't just render charts. It analyzes the shape of your data and your intent, scores all 43 patterns, and recommends the one that actually communicates the insight — not the obvious one.

**Auto-analysis planning** — give it a dataset and it generates a structured analysis plan: which columns matter, what relationships to explore, what charts to build, with ready-to-execute queries for each step.

**100% local, 100% offline** — your data never leaves your machine. Charts render as self-contained HTML. 33 TopoJSON map files ship with the package. Zero CDN calls, zero external dependencies.

## Install

```bash
npm install -g @outsidedata/dolex
```

To update:

```bash
npm update -g @outsidedata/dolex
```

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

```bash
dolex
```

## The Query Engine

Point Claude at a folder of CSV files and start asking questions. No schema definition, no imports, no setup. Dolex loads every file, profiles your data automatically — column types, distributions, cardinality, sample values — and gives Claude everything it needs to answer your questions.

Claude never writes code or raw SQL. Instead it works with Dolex's built-in query language:

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
| `load_csv` | Load a CSV file or directory |
| `describe_data` | Profile columns, stats, sample rows |
| `analyze_data` | Auto-generate an analysis plan |
| `query_data` | Run SQL queries (JOINs, GROUP BY, window functions, CTEs) |
| `visualize` | Data → ranked chart recommendations (inline, cached, or CSV+SQL) |
| `refine_visualization` | Iterate on a chart |
| `transform_data` | Create derived columns with expressions |
| `promote_columns` | Persist working columns to disk |
| `list_transforms` | List columns by layer (source/derived/working) |
| `drop_columns` | Drop derived or working columns |
| `list_patterns` | Browse all 43 patterns |
| `export_html` | Get raw HTML |
| `screenshot` | Render to PNG |
| `server_status` | Inspect server state |
| `clear_cache` | Reset |
| `report_bug` | File a bug report |

## License

MIT
