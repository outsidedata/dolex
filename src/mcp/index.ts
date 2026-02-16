#!/usr/bin/env node
/**
 * Dolex — Visualization MCP Server
 *
 * An MCP server that provides visualization intelligence from a handcrafted
 * pattern library that goes far beyond bar/line/pie.
 *
 * 17 tools:
 *   visualize              — Inline data + intent → ranked visualization recommendations
 *   visualize_from_source  — Source data (DSL query) + intent → ranked visualization recommendations
 *   list_patterns          — Browse all available visualization patterns
 *   refine_visualization   — Tweak a visualization spec
 *   create_dashboard       — Multi-view dashboard from a data source
 *   refine_dashboard       — Iterate on a dashboard (add/remove views, layout, filters, theme)
 *   add_source             — Connect a data source (CSV, SQLite, Postgres, MySQL)
 *   list_sources           — List connected data sources
 *   remove_source          — Disconnect a data source
 *   describe_source        — Re-examine column profiles and sample rows for a source
 *   analyze_source         — Generate a structured analysis plan with DSL queries
 *   query_source           — Run a declarative DSL query and see tabular results
 *   server_status          — Inspect cached data in server memory
 *   clear_cache            — Clear cached specs, results, and sessions
 *   export_html            — Get the full rendered HTML for a visualization by specId
 *   screenshot             — Render a visualization to PNG via headless Chromium
 *   report_bug             — Generate a sanitized bug report for GitHub issues
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';

import { visualizeInputSchema, handleVisualize } from './tools/visualize.js';
import { visualizeFromSourceInputSchema, handleVisualizeFromSource } from './tools/visualize-from-source.js';
import { handleListPatterns } from './tools/list-patterns.js';
import { refineInputSchema, handleRefine } from './tools/refine.js';
import {
  addSourceInputSchema,
  removeSourceInputSchema,
  describeSourceInputSchema,
  handleListSources,
  handleAddSource,
  handleRemoveSource,
  handleDescribeSource,
} from './tools/sources.js';
import { analyzeSourceInputSchema, handleAnalyzeSource } from './tools/analyze.js';
import { querySourceInputSchema, handleQuerySource } from './tools/query-source.js';
import { createDashboardInputSchema, handleCreateDashboard } from './tools/dashboard.js';
import { refineDashboardInputSchema, handleRefineDashboard } from './tools/dashboard-refine.js';
import {
  clearCacheInputSchema,
  handleServerStatus,
  handleClearCache,
} from './tools/server-privacy.js';
import { bugReportInputSchema, handleReportBug } from './tools/bug-report.js';
import { exportHtmlInputSchema, handleExportHtml } from './tools/export-html.js';
import { screenshotInputSchema, handleScreenshot, closeBrowser } from './tools/screenshot.js';
import { specStore } from './spec-store.js';
import { registerPrompts } from './prompts.js';

import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Pattern library imports
import { registry } from '../patterns/registry.js';
import { selectPattern } from '../patterns/selector.js';
// Connector imports
import { SourceManager } from '../connectors/manager.js';
// MCP Apps shell
import { getAppShellHtml, CHART_RESOURCE_URI } from './app-shell.js';

// ─── INITIALIZE ─────────────────────────────────────────────────────────────

const dolexDir = join(homedir(), '.dolex');
mkdirSync(dolexDir, { recursive: true });
const sourceManager = new SourceManager(join(dolexDir, 'sources.json'));

const serverStartTime = Date.now();

// ─── CREATE SERVER ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'dolex',
  version: '0.1.0',
});

// ─── Shared pattern selector callback ────────────────────────────────────────

function selectPatternCallback(input: { data: Record<string, any>[]; intent: string; columns?: any[]; forcePattern?: string; geoLevel?: string; geoRegion?: string }) {
  const columns = input.columns ?? [];
  const specOptions: Record<string, any> = {};
  if (input.geoLevel) specOptions.geoLevel = input.geoLevel;
  if (input.geoRegion) specOptions.geoRegion = input.geoRegion;
  const result = selectPattern(input.data, columns, input.intent, { forcePattern: input.forcePattern, specOptions });
  return {
    recommended: {
      pattern: result.recommended.pattern.id,
      spec: result.recommended.spec,
      reasoning: result.recommended.reasoning,
    },
    alternatives: result.alternatives.map(a => ({
      pattern: a.pattern.id,
      spec: a.spec,
      reasoning: a.reasoning,
    })),
  };
}

// ─── REGISTER TOOLS ─────────────────────────────────────────────────────────

// Inline data visualization tool
registerAppTool(
  server,
  'visualize',
  {
    title: 'Visualize Data',
    description: 'Takes inline data + intent and returns visualization recommendations from a handcrafted pattern library of 41 chart types (bump chart, beeswarm, waffle, slope chart, etc.). Use `pattern` to force a specific chart type by ID (use list_patterns to discover IDs).\n\nPass data as an array of row objects, OR pass `resultId` from a previous `query_source` call to reuse cached data (saves tokens). For source-based data (CSV, SQLite, Postgres), use `visualize_from_source` instead.\n\nSet `title` and `subtitle` upfront to avoid a refine round-trip.\n\n**Response**: Returns compact JSON with `specId` (for refine calls), recommended pattern + title + reasoning, alternative chart types, and data shape summary. Chart HTML is delivered via structuredContent.\n\nColor system: Request a palette or highlight specific values via colorPreferences. Palettes: categorical, blue, green, purple, warm, blueRed, greenPurple, tealOrange, redGreen, traffic-light, profit-loss, temperature. Highlight mode: specify values to emphasize — all others become muted gray.\n\nGeographic maps: For choropleth/proportional-symbol patterns, set `geoRegion` to a region code (US, CN, JP, AU, EU, world, etc.) and/or `geoLevel` ("country" or "subdivision"). If omitted, Dolex auto-detects the region from data values — US states, Chinese provinces, Japanese prefectures, European countries, and 18 other regions are recognized automatically.',
    inputSchema: visualizeInputSchema.shape,
    _meta: {
      ui: {
        resourceUri: CHART_RESOURCE_URI,
        csp: {
          resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
        },
      },
    },
  },
  handleVisualize(selectPatternCallback),
);

// Source-based visualization tool
registerAppTool(
  server,
  'visualize_from_source',
  {
    title: 'Visualize from Data Source',
    description: 'Takes a data source + DSL query + intent and returns visualization recommendations from a handcrafted pattern library of 41 chart types. Use this when data lives in a connected source (CSV, SQLite, Postgres, MySQL) — Dolex queries the data server-side.\n\nRequires a source from `add_source`. Pass `sourceId`, `table`, and a `query` (declarative DSL with select, groupBy, filter, join, orderBy, limit). Set `title` and `subtitle` upfront to avoid a refine round-trip.\n\n**DSL query example**:\n```json\n{\n  "select": ["region", { "field": "revenue", "aggregate": "sum", "as": "total" }],\n  "groupBy": ["region"],\n  "filter": { "field": "year", "equals": 2024 },\n  "orderBy": { "field": "total", "direction": "desc" },\n  "limit": 10\n}\n```\n\n**Filter shorthand**: `{ "field": "x", "equals": "y" }` — also `gt`, `gte`, `lt`, `lte`, `not_equals`. Single filters can be bare objects (no array needed). Canonical form: `{ "field", "op": "=", "value": "y" }`.\n\n**Joins**: Use `join` to combine tables within the same source (inner/left). Use `table.field` dot notation for joined fields. Multi-hop: `{ "table": "orders", "on": { "left": "order_id", "right": "id" } }, { "table": "customers", "on": { "left": "orders.customer_id", "right": "id" } }`.\n\n**Response**: Same as `visualize` — compact JSON with specId, recommended pattern, alternatives, data shape. Chart HTML via structuredContent.\n\nGeographic maps: For choropleth/proportional-symbol patterns, set `geoRegion` to a region code (US, CN, JP, AU, EU, world, etc.) and/or `geoLevel` ("country" or "subdivision"). If omitted, Dolex auto-detects the region from data values.',
    inputSchema: visualizeFromSourceInputSchema.shape,
    _meta: {
      ui: {
        resourceUri: CHART_RESOURCE_URI,
        csp: {
          resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
        },
      },
    },
  },
  handleVisualizeFromSource(selectPatternCallback, { sourceManager }),
);

server.registerTool(
  'list_patterns',
  {
    title: 'List Visualization Patterns',
    description: 'Browse all available visualization patterns with their descriptions, best-for hints, data requirements, and per-pattern capabilities (color encoding, config options). Also returns full color system documentation (palettes, highlight mode, usage).',
  },
  handleListPatterns(() => registry.getAll()),
);

registerAppTool(
  server,
  'refine_visualization',
  {
    title: 'Refine Visualization',
    description: 'Tweak a visualization — sort, limit, flip axes, change colors, highlight values, update title. Pass `specId` from a previous visualize or refine call (no data round-trip needed).\n\nUse `selectAlternative` with a pattern ID to switch to an alternative from the original visualize call (e.g., "line", "area"). Returns a new `specId` for further refinements.\n\nColor refinements: "use warm palette", "highlight North and South", "highlight Q1 in #ff6b6b", "mute to 30% opacity", "color by target" (alluvial). Palettes: categorical, blue, green, purple, warm, blueRed, greenPurple, tealOrange, redGreen, traffic-light, profit-loss, temperature.',
    inputSchema: refineInputSchema.shape,
    _meta: {
      ui: {
        resourceUri: CHART_RESOURCE_URI,
        csp: {
          resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
        },
      },
    },
  },
  handleRefine(),
);

// Data source management tools
server.registerTool(
  'add_source',
  {
    title: 'Add Data Source',
    description: 'Connect a data source: CSV file/directory, SQLite database, PostgreSQL, or MySQL connection.\n\nIMPORTANT — LOCAL FILESYSTEM ONLY (HARD REQUIREMENT):\nThis MCP server runs on the user\'s local machine and processes files directly from the local filesystem. File paths must be local paths (e.g. /Users/name/Downloads/data.csv), NOT paths from a cloud sandbox like /mnt/user-data/uploads/ or /home/claude/.\n\nWhen a user uploads a file via drag-and-drop, you do NOT have access to it through this tool. This is a deliberate design constraint. Do NOT work around this limitation by reading the file contents and passing them through other endpoints (e.g. inline data via visualize, query_source, or any other method). Workarounds are specifically unsupported and will produce incorrect or incomplete results. The only correct action is to ask the user to provide the full local path to the file on their machine.\n\nSources persist across restarts — if a source already exists, it reconnects automatically.\n\nSet `detail: "compact"` to get just column names/types + row counts (saves tokens). Default `"full"` includes stats, top values, and sample rows.',
    inputSchema: addSourceInputSchema,
  },
  handleAddSource({ sourceManager }),
);

server.registerTool(
  'list_sources',
  {
    title: 'List Data Sources',
    description: 'List all connected data sources with their IDs, types, and table counts.',
  },
  handleListSources({ sourceManager }),
);

server.registerTool(
  'remove_source',
  {
    title: 'Remove Data Source',
    description: 'Disconnect and remove a data source by its ID.',
    inputSchema: removeSourceInputSchema,
  },
  handleRemoveSource({ sourceManager }),
);

server.registerTool(
  'describe_source',
  {
    title: 'Describe Data Source',
    description: 'Returns column profiles for a previously-added data source. Use this to re-examine a source mid-conversation.\n\nSet `detail: "compact"` to get just column names/types + row counts (saves tokens). Default `"full"` includes stats, top values, and sample rows.',
    inputSchema: describeSourceInputSchema,
  },
  handleDescribeSource({ sourceManager }),
);

server.registerTool(
  'analyze_source',
  {
    title: 'Analyze Data Source',
    description: 'Examines a connected data source and generates a structured analysis plan with ready-to-execute DSL queries. Returns 4-6 analysis steps covering trends, comparisons, distributions, and relationships — each with a title, question, query, and suggested chart patterns.\n\nUse this after add_source to get an automatic analysis plan. Then execute each step with visualize_from_source.',
    inputSchema: analyzeSourceInputSchema.shape,
  },
  handleAnalyzeSource({ sourceManager }),
);

server.registerTool(
  'query_source',
  {
    title: 'Query Data Source',
    description: 'Run a declarative DSL query against a data source and see tabular results. Useful for exploration, validation, or answering data questions without visualizing.\n\nReturns a `resultId` — pass it to `visualize` with `resultId` to chart the same data without re-sending rows (saves tokens).\n\n**DSL query example**:\n```json\n{\n  "select": ["category", { "field": "amount", "aggregate": "sum", "as": "total" }],\n  "groupBy": ["category"],\n  "filter": { "field": "status", "op": "=", "value": "completed" },\n  "orderBy": { "field": "total", "direction": "desc" },\n  "limit": 20\n}\n```\n\n**Filter shorthand**: `{ "field": "status", "equals": "active" }` — also `gt`, `gte`, `lt`, `lte`, `not_equals`. Single filters can be bare objects (no array wrapping needed).\n\n**Joins**: Use `join` to combine tables. Use `table.field` dot notation for joined fields in select/groupBy/filter.\n```json\n{\n  "join": [\n    { "table": "orders", "on": { "left": "order_id", "right": "id" } },\n    { "table": "customers", "on": { "left": "orders.customer_id", "right": "id" } }\n  ],\n  "select": ["customers.name", { "field": "price", "aggregate": "sum", "as": "total" }],\n  "groupBy": ["customers.name"]\n}\n```\nMulti-hop: chain joins and use `table.field` in later join ON clauses to reference columns from earlier joins.',
    inputSchema: querySourceInputSchema,
  },
  handleQuerySource({ sourceManager }),
);

// Dashboard tools
registerAppTool(
  server,
  'create_dashboard',
  {
    title: 'Create Dashboard',
    description: 'Create a multi-view dashboard from a data source. Each view has its own DSL query and intent for pattern selection. Supports global filters (select, multi-select, range) and cross-view interactions (crossfilter, highlight).\n\nRequires an existing data source (from add_source). Each view specifies an intent and query — Dolex selects the best chart pattern for each.\n\nLayout: auto-calculated grid columns, or specify columns (1-4) and per-view colSpan/rowSpan.\n\nReturns the full DashboardSpec (pass to refine_dashboard for iterations).',
    inputSchema: createDashboardInputSchema.shape,
    _meta: {
      ui: {
        resourceUri: CHART_RESOURCE_URI,
        csp: {
          resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
        },
      },
    },
  },
  handleCreateDashboard({ sourceManager }),
);

registerAppTool(
  server,
  'refine_dashboard',
  {
    title: 'Refine Dashboard',
    description: 'Iterate on a dashboard — add/remove/modify views, change layout, add filters, switch themes, swap view positions, or override chart patterns.\n\nPass the currentSpec from a previous create_dashboard or refine_dashboard call, plus a natural language refinement.\n\nExamples:\n- "add a chart showing revenue by month"\n- "remove the bar chart"\n- "make it 3 columns"\n- "add a region filter"\n- "dark mode"\n- "swap view-1 and view-2"\n- "show the trend as a line chart"',
    inputSchema: refineDashboardInputSchema.shape,
    _meta: {
      ui: {
        resourceUri: CHART_RESOURCE_URI,
        csp: {
          resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
        },
      },
    },
  },
  handleRefineDashboard({ sourceManager }),
);

// Privacy / cache management tools
const privacyDeps = { sourceManager, serverStartTime };

server.registerTool(
  'server_status',
  {
    title: 'Server Status',
    description: 'Shows what data Dolex currently holds in memory: cached visualization specs (with data row counts), query result cache, connected data sources, and server uptime. Use this to audit data retention before clearing.',
  },
  handleServerStatus(privacyDeps),
);

server.registerTool(
  'clear_cache',
  {
    title: 'Clear Cache',
    description: 'Clears cached data from server memory. Scope options: "all" (specs + results), "specs" (visualization specs and their embedded data), "results" (query result cache). Use after working with sensitive data.',
    inputSchema: clearCacheInputSchema,
  },
  handleClearCache(privacyDeps),
);

server.registerTool(
  'report_bug',
  {
    title: 'Report Bug',
    description: 'Generate a sanitized bug report for a GitHub issue. Includes environment info, recent operation history, and visualization context — but never includes data values, connection strings, or file paths. Field names are anonymized by default; set includeFieldNames to show real names. Copy the markdown output and paste into a GitHub issue.',
    inputSchema: bugReportInputSchema.shape,
  },
  handleReportBug({ sourceManager, serverStartTime }),
);

server.registerTool(
  'export_html',
  {
    title: 'Export Chart HTML',
    description: 'Returns the full, self-contained HTML for a previously-created visualization. Pass a specId from visualize, visualize_from_source, or refine_visualization. The returned HTML is a complete document with embedded D3 and data — suitable for saving to a file, opening in a browser, or screenshotting programmatically.',
    inputSchema: exportHtmlInputSchema.shape,
  },
  handleExportHtml(),
);

server.registerTool(
  'screenshot',
  {
    title: 'Screenshot Visualization',
    description: 'Render a visualization to a PNG image via headless Chromium. Returns a base64-encoded PNG that Claude can see directly. Pass a specId from visualize, visualize_from_source, or refine_visualization.\n\nRequires Playwright: npm install playwright && npx playwright install chromium',
    inputSchema: screenshotInputSchema.shape,
  },
  handleScreenshot(),
);

// ─── MCP APPS RESOURCE ─────────────────────────────────────────────────────

registerAppResource(
  server,
  'Dolex Chart Viewer',
  CHART_RESOURCE_URI,
  {
    description: 'Interactive chart viewer for Dolex visualizations',
    _meta: {
      ui: {
        csp: {
          resourceDomains: ['https://d3js.org'],
        },
      },
    },
  },
  async () => ({
    contents: [{
      uri: CHART_RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: getAppShellHtml(),
      _meta: {
        ui: {
          csp: {
            resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
          },
        },
      },
    }],
  }),
);

// ─── REGISTER PROMPTS ──────────────────────────────────────────────────────

registerPrompts(server);

// ─── START ──────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Background cleanup: purge expired specs every 5 minutes
  setInterval(() => {
    specStore.purgeExpired();
  }, 5 * 60 * 1000);

  console.error('Dolex MCP server running on stdio');

  const shutdown = async () => {
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
