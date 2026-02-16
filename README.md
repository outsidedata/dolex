```
 ██████╗   ██████╗  ██╗      ███████╗ ██╗  ██╗
 ██╔══██╗ ██╔═══██╗ ██║      ██╔════╝ ╚██╗██╔╝
 ██║  ██║ ██║   ██║ ██║      █████╗    ╚███╔╝
 ██║  ██║ ██║   ██║ ██║      ██╔══╝    ██╔██╗
 ██████╔╝ ╚██████╔╝ ███████╗ ███████╗ ██╔╝ ██╗
 ╚═════╝   ╚═════╝  ╚══════╝ ╚══════╝ ╚═╝  ╚═╝
```

**Your AI data analyst.** Not a chart library — a complete analytical engine that turns raw data into insight.

---

## The Problem

Right now, getting real analysis out of an AI means one of two things:

1. **The Python REPL loop** — Claude writes a script, runs it, gets an error, fixes it, runs it again, gets a different error, and eventually produces a matplotlib chart with default styling that you'd be embarrassed to put in a deck.

2. **"Here's a bar chart"** — every AI assistant reaches for the same three chart types because they optimize for the most likely token, not the most informative visualization.

Dolex replaces both. No Python. No REPL. No `import pandas`. No `plt.show()`. No debugging dependency conflicts. Just point it at your data and ask questions.

## What It Actually Is

Dolex is an MCP server that gives your AI assistant a complete data analysis toolkit:

**A query engine** — point it at a CSV or SQLite file and query it with a declarative DSL. Joins across tables, aggregations (sum, avg, median, stddev, percentiles), time bucketing (group by month/quarter/year), window functions (lag, lead, rank, running totals, percent of total), filters, having clauses, sorting, and limits. Everything pandas can do, without the Python.

**43 handcrafted visualization patterns** — not chart.js defaults. Bump charts for rankings, beeswarms for distributions, Sankey diagrams for flows, ridgeline plots for comparing distributions, connected dot plots for two-metric comparisons, calendar heatmaps for temporal patterns, and 37 more. Each pattern has selection rules that encode real data visualization expertise.

**Pattern intelligence** — Dolex doesn't just render charts. It analyzes the shape of your data and your intent, scores all 43 patterns, and recommends the one that actually communicates the insight — not the obvious one.

**Multi-view dashboards** — N-panel layouts with global filter controls and cross-view interactions. Not static images — interactive HTML with linked highlighting.

**Auto-analysis planning** — give it a dataset and it generates a structured analysis plan: which columns matter, what relationships to explore, what charts to build, with ready-to-execute queries for each step.

**Offline everything** — charts render as self-contained HTML. 33 TopoJSON map files ship with the package. Zero CDN calls, zero external dependencies. Works air-gapped.

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

Drop a CSV on Claude and start asking questions. No schema definition, no imports, no setup. Dolex profiles your data automatically — column types, distributions, cardinality, sample values — and gives the LLM everything it needs to write smart queries.

The DSL compiles to SQL under the hood but the LLM never writes raw SQL. Instead it works with a structured, validated query language:

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
| `add_source` | Point at a CSV or SQLite file |
| `describe_source` | Profile columns, stats, sample rows |
| `analyze_source` | Auto-generate an analysis plan |
| `query_source` | Run queries with the full DSL |
| `visualize` | Inline data → ranked chart recommendations |
| `visualize_from_source` | Query + visualize in one step |
| `refine_visualization` | Iterate on a chart |
| `create_dashboard` | Multi-view dashboard with filters |
| `refine_dashboard` | Iterate on a dashboard |
| `list_patterns` | Browse all 43 patterns |
| `export_html` | Get raw HTML |
| `screenshot` | Render to PNG |
| `server_status` | Inspect server state |
| `clear_cache` | Reset |
| `report_bug` | File a bug report |

## License

MIT
