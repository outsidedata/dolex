# Dolex

**Visualization intelligence for AI.** 43 handcrafted chart patterns — far beyond bar, line, and pie.

Every AI assistant suggests a bar chart. Dolex suggests the *right* chart — bump charts for rankings, beeswarms for distributions, connected dot plots for two-metric comparisons, waffle charts for precise proportions.

## Features

- **43 Visualization Patterns** across 7 categories: comparison, distribution, composition, time, relationship, flow, and geo
- **Pattern Selector** — analyzes data shape + user intent, scores every pattern, returns ranked recommendations with reasoning
- **Data Source Connectors** — connect CSV, SQLite, PostgreSQL, or MySQL; query with a declarative DSL including joins, aggregations, and time bucketing
- **React Components** — 43 thin-wrapper components with D3 lifecycle management
- **HTML Builders** — 43 self-contained HTML documents, perfect for MCP Apps / iframes
- **MCP Server** — 17 tools for Claude Desktop, ChatGPT, VS Code, and any MCP-compatible client
- **Dashboard Builder** — multi-view dashboards with global filters and cross-view interactions
- **Compound Visualizations** — chart + data table with linked highlighting
- **Design System** — dark/light themes with color palettes, typography, and spacing tokens
- **Smart Labels** — truncation, abbreviation, collision avoidance, adaptive strategies
- **Offline Maps** — choropleth and proportional symbol maps with 33 embedded TopoJSON files covering world, continents, US states/counties, and 17 country subdivision maps

## Install

```bash
npm install @outsidedata/dolex
```

## MCP Server Setup

### Claude Desktop

Add this to your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "dolex": {
      "command": "npx",
      "args": ["@outsidedata/dolex"]
    }
  }
}
```

Restart Claude Desktop. You'll see Dolex's 17 tools available in the tool picker.

### Claude Code

```bash
claude mcp add dolex -- npx @outsidedata/dolex
```

### Other MCP Clients

Any MCP-compatible client (ChatGPT, VS Code, Goose, etc.) can connect via stdio:

```bash
npx @outsidedata/dolex
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `visualize` | Takes inline data + intent, returns visualization recommendations |
| `visualize_from_source` | Takes a data source + DSL query + intent, returns visualization recommendations |
| `list_patterns` | Browse all 43 available patterns |
| `refine_visualization` | Tweak a visualization — sort, limit, flip axes, change colors, update title |
| `add_source` | Connect a data source (CSV, SQLite, PostgreSQL, MySQL) |
| `list_sources` | List all connected data sources |
| `remove_source` | Disconnect and remove a data source |
| `describe_source` | Column profiles for a data source |
| `analyze_source` | Generate a structured analysis plan with ready-to-execute DSL queries |
| `query_source` | Run a declarative DSL query against a data source |
| `create_dashboard` | Multi-view dashboard with global filters and cross-view interactions |
| `refine_dashboard` | Iterate on a dashboard — add/remove views, change layout, filters, themes |
| `server_status` | Inspect cached data in server memory |
| `clear_cache` | Clear cached specs and query results |
| `report_bug` | Generate a sanitized bug report |
| `export_html` | Return full self-contained HTML for a visualization |
| `screenshot` | Render a visualization to PNG via headless Chromium |

## Pattern Catalog

| Category | Patterns |
|----------|----------|
| **Comparison** (9) | Bar, Diverging Bar, Slope Chart, Connected Dot Plot, Bump Chart, Lollipop, Bullet, Grouped Bar, Waterfall |
| **Distribution** (7) | Histogram, Beeswarm, Violin, Ridgeline, Strip Plot, Box Plot, Density Plot |
| **Composition** (9) | Stacked Bar, Waffle, Treemap, Sunburst, Circle Pack, Metric, Donut, Marimekko, Icicle |
| **Time** (7) | Line, Area, Small Multiples, Sparkline Grid, Calendar Heatmap, Stream Graph, Horizon Chart |
| **Relationship** (5) | Scatter, Connected Scatter, Parallel Coordinates, Radar, Heatmap |
| **Flow** (4) | Sankey, Alluvial, Chord, Funnel |
| **Geo** (2) | Choropleth, Proportional Symbol |

## Library Usage

### Pattern Selection

```typescript
import { selectPattern, registry } from '@outsidedata/dolex';

const result = selectPattern(data, columns, 'compare rankings over time');
console.log(result.recommended.pattern.name); // "Bump Chart"
console.log(result.recommended.reasoning);

const patterns = registry.getAll(); // 43 patterns
const comparison = registry.getByCategory('comparison'); // 9 patterns
```

### React Components

```tsx
import { BumpChart, Beeswarm, Waffle, Scatter, Line } from '@outsidedata/dolex/react';

function Dashboard({ spec }) {
  return <BumpChart spec={spec} width={800} height={500} />;
}
```

Available components: `Bar`, `DivergingBar`, `SlopeChart`, `BumpChart`, `ConnectedDotPlot`, `Lollipop`, `Bullet`, `GroupedBar`, `Waterfall`, `Histogram`, `Beeswarm`, `StripPlot`, `Violin`, `Ridgeline`, `BoxPlot`, `DensityPlot`, `StackedBar`, `Waffle`, `Treemap`, `Sunburst`, `CirclePack`, `Metric`, `Donut`, `Marimekko`, `Icicle`, `Line`, `Area`, `SmallMultiples`, `SparklineGrid`, `CalendarHeatmap`, `StreamGraph`, `HorizonChart`, `Scatter`, `ConnectedScatter`, `ParallelCoordinates`, `Radar`, `Heatmap`, `Sankey`, `Alluvial`, `Chord`, `Funnel`, `Choropleth`, `ProportionalSymbol`

### HTML Builders (MCP Apps / Iframes)

```typescript
import { buildChartHtml } from '@outsidedata/dolex/html';

const html = buildChartHtml(spec);
// Complete self-contained HTML document with embedded D3 + data
```

### Theme

```typescript
import { theme, getTheme } from '@outsidedata/dolex/theme';

const dark = getTheme('dark');
const palette = dark.palettes.categorical;
```

### Smart Labels

```typescript
import { labelStrategy, truncateLabel, abbreviate } from '@outsidedata/dolex/utils';

const strategy = labelStrategy(['January Sales', 'February Sales', ...], 400);
```

## Exports Map

| Import Path | Contents |
|-------------|----------|
| `@outsidedata/dolex` | Types, patterns, theme, utilities, HTML builders |
| `@outsidedata/dolex/react` | React components (requires React >=18) |
| `@outsidedata/dolex/html` | Self-contained HTML chart builders |
| `@outsidedata/dolex/theme` | Design system tokens |
| `@outsidedata/dolex/utils` | Smart labels, responsive, export utilities |
| `@outsidedata/dolex/patterns` | Pattern registry and selector |

## Development

```bash
npm run build        # TypeScript compilation
npm test             # Run tests (818 tests)
npm run dev          # Watch mode for MCP server
npm run mcp:stdio    # Run MCP server via tsx
```

## License

MIT
