#!/usr/bin/env node
/**
 * Dolex — Visualization MCP Server
 *
 * An MCP server that provides visualization intelligence from a handcrafted
 * pattern library that goes far beyond bar/line/pie.
 *
 * Tools:
 *   visualize              — Data (inline, cached, or CSV+SQL) + intent → ranked visualization recommendations
 *   list_patterns          — Browse all available visualization patterns
 *   refine_visualization   — Tweak a visualization spec
 *   load_source            — Load a CSV / Postgres / MongoDB source
 *   list_data              — List loaded datasets
 *   remove_data            — Remove a loaded dataset
 *   describe_data          — Re-examine column profiles and sample rows for a dataset
 *   analyze_data           — Generate a structured analysis plan with SQL queries
 *   query_data             — Run a declarative SQL query and see tabular results
 *   server_status          — Inspect cached data in server memory
 *   clear_cache            — Clear cached specs, results, and sessions
 *   export_html            — Get the full rendered HTML for a visualization by specId
 *   screenshot             — Render a visualization to PNG via headless Chromium
 *   transform_data         — Create derived columns with the expression language
 *   promote_columns        — Promote working columns to derived (persisted)
 *   list_transforms        — List columns by layer (source/derived/working)
 *   drop_columns           — Drop derived or working columns
 *   visualize_cli_only     — CLI ONLY: visualize + write to disk (no HTML in response)
 *   refine_visualization_cli_only — CLI ONLY: refine + write to disk (no HTML in response)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';

import { visualizeInputSchema, handleVisualize } from './tools/visualize.js';
import { handleListPatterns } from './tools/list-patterns.js';
import { refineInputSchema, handleRefine } from './tools/refine.js';
import {
  addSourceInputSchema,
  removeSourceInputSchema,
  describeSourceInputSchema,
  testSourceInputSchema,
  handleListSources,
  handleAddSource,
  handleRemoveSource,
  handleDescribeSource,
  handleTestSource,
} from './tools/sources.js';
import { analyzeSourceInputSchema, handleAnalyzeSource } from './tools/analyze.js';
import { querySourceInputSchema, handleQuerySource } from './tools/query-source.js';
import {
  clearCacheInputSchema,
  handleServerStatus,
  handleClearCache,
} from './tools/server-privacy.js';
import { exportHtmlInputSchema, handleExportHtml } from './tools/export-html.js';
import { handleCapabilities } from './tools/capabilities.js';
import { screenshotInputSchema, handleScreenshot, closeBrowser } from './tools/screenshot.js';
import { visualizeCliInputSchema, handleVisualizeCli } from './tools/visualize-cli.js';
import { refineCliInputSchema, handleRefineCli } from './tools/refine-cli.js';
import {
  transformDataBaseSchema,
  transformDataSchema,
  promoteColumnsSchema,
  listTransformsSchema,
  dropColumnsSchema,
} from './tools/transform-schemas.js';
import { handleTransformData } from './tools/transform-data.js';
import { handlePromoteColumns } from './tools/promote-columns.js';
import { handleListTransforms } from './tools/list-transforms.js';
import { handleDropColumns } from './tools/drop-columns.js';
import { cleanColumnSchema } from './tools/clean-schemas.js';
import { handleCleanColumn } from './tools/clean-column.js';
import { specStore } from './spec-store.js';

import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { packagePath } from '../utils/package-root.js';

// Pattern library imports
import { registry } from '../patterns/registry.js';
import { selectPatternsCallback as selectPatternCallback } from '../patterns/select-callback.js';
// Connector imports
import { SourceManager } from '../connectors/manager.js';
// MCP Apps shell
import { getAppShellHtml, CHART_RESOURCE_URI } from './app-shell.js';

// ─── INITIALIZE ─────────────────────────────────────────────────────────────

const dolexDir = join(homedir(), '.dolex');
mkdirSync(dolexDir, { recursive: true });
const sourceManager = new SourceManager(join(dolexDir, 'sources.json'));

const serverStartTime = Date.now();

const iconPath = packagePath(import.meta.url, 'assets', 'icon.svg');
let serverIcons: Array<{ src: string; mimeType: string }> | undefined;
try {
  const svgData = readFileSync(iconPath);
  serverIcons = [{ src: `data:image/svg+xml;base64,${svgData.toString('base64')}`, mimeType: 'image/svg+xml' }];
} catch {}

// ─── CREATE SERVER ──────────────────────────────────────────────────────────

const server = new McpServer(
  {
    name: 'dolex',
    version: '1.0.0',
    ...(serverIcons && { icons: serverIcons }),
  },
  {
    instructions: [
      "You are a data analyst working on the user's own CSV files: rigorous column profiling, data-quality auditing, a prioritized analysis plan, and findings rendered across 43 chart types as artifacts they keep.",
      '',
      'WORKFLOW:',
      '• Got a CSV file, Postgres, or MongoDB? → load_source(name, type, path|uri|host+database) — returns smart summary (column names, types, ranges, categorical values)',
      '• For a Postgres/MongoDB source, call capabilities first to confirm its driver is installed here; if not, it tells the user the exact command (e.g. `npm install pg`). Loading a source whose driver is missing returns that same install message, never a crash.',
      '• Got inline data? → visualize(data, intent) directly',
      '• Need to explore? → load_source → analyze_data → visualize(sourceId, sql, intent) per step',
      '',
      'CONTINUATION (dataset already loaded):',
      '• Chart from data → visualize(sourceId, sql, intent)',
      '• Want to SEE rows (answer a question, validate data, show a table)? → query_data',
      '• Want to CHART rows you already queried? → visualize(resultId=...) to reuse cached data',
      '• Want a table view? → query_data for raw data, or visualize with includeDataTable=true for a formatted table with chart',
      '• Tweak a chart → refine_visualization(specId, ...) — always use the MOST RECENT specId',
      '• specId expired? → re-run the original visualize call, then continue refining from the new specId',
      '',
      'TOOL GUIDE:',
      '• load_source: Load a CSV / Postgres / MongoDB source. Returns sourceId + smart summary (columns, types, ranges, categorical values) — enough to query.',
      '• describe_data: Full column stats, top values, sample rows. Call only when you need deep exploration.',
      '• analyze_data: Auto-generate analysis plan with ready SQL queries. Execute each step with visualize; present results one at a time.',
      '• query_data: Run SQL query, get rows. Returns resultId for visualize().',
      '• clean_column: Clean one column with a Python clean(value) you write — parse messy dates, null sentinels, canonicalize categories. Preview first, then apply:true writes a non-destructive <column>_clean. (Requires python3.)',
      '• visualize: Chart data. Pass inline data array, resultId from query_data, or sourceId + sql for server-side query. Matches a chart to the shape of the data. Set title/subtitle here to avoid a refine round-trip.',
      '• refine_visualization: Tweak a chart — sort, limit, filter, palette, highlight, flip, title, format. Each call returns a new specId.',
      '• list_patterns: Browse available chart types. Only needed when the user asks what charts are available or you need a pattern ID.',
      '',
      'Utility tools: list_data, remove_data, server_status (inspect cached data), clear_cache, export_html (get chart HTML by specId), screenshot (render to PNG).',
      '',
      'COLOR: Set palette (categorical/blue/warm/blueRed/etc.) and/or highlight specific values. Use colorField to control which column drives color.',
      'PATTERNS: 43 chart types matched to the shape of the data and the question being asked. When user names a specific chart type, pass pattern="<id>" to force it. Use list_patterns to browse.',
      '',
      'ERRORS: If a SQL query fails, check the error message for available columns/tables and retry. If specId is expired, re-run visualize.',
      '',
      'DON\'T use Dolex for: simple arithmetic, explanations of chart types, non-data questions, or file format conversions (CSV export, PowerPoint, etc.).',
      'DO use Dolex when the user asks "what chart should I use" — run visualize to match a chart to the shape of the data.',
    ].join('\n'),
  },
);

// ─── REGISTER TOOLS ─────────────────────────────────────────────────────────

// Inline data visualization tool
registerAppTool(
  server,
  'visualize',
  {
    title: 'Visualize Data',
    description: 'Produces the analysis as a finished chart. Takes inline data, a cached result, or a registered source, and produces a chart matched to the shape of the data — self-contained HTML the user keeps, with the analysis behind it inspectable. Set title and subtitle here.\n\nData source (provide one):\n• data: inline rows\n• resultId: reuse query_data result\n• sourceId + sql: query a loaded CSV server-side (saves tokens)\n\nReturns specId (for refine calls), the matched chart, and alternatives.\nPresent any notes to the user.',
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
  handleVisualize(selectPatternCallback, { sourceManager }),
);

server.registerTool(
  'list_patterns',
  {
    title: 'List Visualization Patterns',
    description: 'Browse all 43 chart types with data requirements, capabilities, and config options.',
  },
  handleListPatterns(() => registry.getAll()),
);

registerAppTool(
  server,
  'refine_visualization',
  {
    title: 'Refine Visualization',
    description: 'Tweak a chart. Pass the most recent specId — each call returns a new one.\nSort, limit, filter, flip, titles, labels, palette, highlight, colorField, switchPattern, format.\nCompound: removeTable, layout, hideColumns.\nReturns new specId + changes applied. Present any notes to the user.',
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

// CSV data management tools
server.registerTool(
  'load_source',
  {
    title: 'Load a data source',
    description: 'Load a data source: a CSV file/directory (type "csv" + path), a live Postgres database (type "postgres" + uri or host/database/user), or a MongoDB database (type "mongodb" + uri/host + database). Type defaults to "csv". Datasets persist across restarts.\nReturns sourceId + smart summary: column names, types, numeric ranges, categorical values.\nThis gives you enough to query. Call describe_data only if you need full stats.',
    inputSchema: addSourceInputSchema,
  },
  handleAddSource({ sourceManager }),
);

server.registerTool(
  'list_data',
  {
    title: 'List Loaded Data',
    description: 'List all loaded datasets with IDs and table counts.',
  },
  handleListSources({ sourceManager }),
);

server.registerTool(
  'remove_data',
  {
    title: 'Remove Data',
    description: 'Remove a loaded dataset by ID.',
    inputSchema: removeSourceInputSchema,
  },
  handleRemoveSource({ sourceManager }),
);

server.registerTool(
  'describe_data',
  {
    title: 'Describe Data',
    description: 'Full column profiles: stats (min/max/mean/median), top values with counts, sample rows.\nUse only when you need deep exploration — load_source already gives you enough to query.',
    inputSchema: describeSourceInputSchema,
  },
  handleDescribeSource({ sourceManager }),
);

server.registerTool(
  'analyze_data',
  {
    title: 'Analyze Data',
    description: 'Auto-generate an analysis plan with ready-to-execute SQL queries. Returns 4-6 steps covering trends, comparisons, distributions, and relationships.',
    inputSchema: analyzeSourceInputSchema.shape,
  },
  handleAnalyzeSource({ sourceManager }),
);

server.registerTool(
  'query_data',
  {
    title: 'Query Data',
    description: 'Run a SQL query on a loaded dataset. JOINs, GROUP BY, window functions, CTEs.\nCustom aggregates: MEDIAN, STDDEV, CV, MAD, P1/P5/P10/P25/P75/P90/P95/P99.\nReturns resultId for visualize().',
    inputSchema: querySourceInputSchema,
  },
  handleQuerySource({ sourceManager }),
);

// Derived data layer tools
server.registerTool(
  'transform_data',
  {
    title: 'Transform Data',
    description: 'Create derived columns using expressions. Single-column mode: create + expr. Batch mode: transforms array.\n\nExpressions: arithmetic (score * 2), functions (log, zscore, if_else), column-wise stats (col_mean, rank), string/date ops.\n\nColumns start as "working" (session-only). Use promote_columns to persist them.\n\nExamples:\n• create: "doubled", expr: "score * 2"\n• create: "grade", expr: "if_else(score > 90, \\"A\\", if_else(score > 80, \\"B\\", \\"C\\"))"\n• create: "z_score", expr: "zscore(score)", partitionBy: "group"\n• transforms: [{ create: "a", expr: "x + 1" }, { create: "b", expr: "a * 2" }]',
    inputSchema: transformDataBaseSchema.shape,
  },
  handleTransformData({ sourceManager }),
);

server.registerTool(
  'promote_columns',
  {
    title: 'Promote Columns',
    description: 'Promote working columns to derived (persisted). Derived columns are saved to .dolex.json and automatically restored when the CSV is reloaded.\n\nUse ["*"] to promote all working columns.',
    inputSchema: promoteColumnsSchema.shape,
  },
  handlePromoteColumns({ sourceManager }),
);

server.registerTool(
  'list_transforms',
  {
    title: 'List Transforms',
    description: 'List all columns for a table grouped by layer: source (original CSV), derived (persisted), working (session-only). Shows expressions and types for derived/working columns.',
    inputSchema: listTransformsSchema.shape,
  },
  handleListTransforms({ sourceManager }),
);

server.registerTool(
  'drop_columns',
  {
    title: 'Drop Columns',
    description: 'Drop derived or working columns. For derived columns, validates no other columns depend on it. For working columns shadowing a derived column, restores the derived values.\n\nUse ["*"] with layer to drop all columns in a layer.',
    inputSchema: dropColumnsSchema.shape,
  },
  handleDropColumns({ sourceManager }),
);

server.registerTool(
  'clean_column',
  {
    title: 'Clean Column',
    description: 'Clean one column by writing a Python `def clean(value):` function (you author it, the server runs it — the Python sibling of query_data). PREVIEW first (apply omitted/false): validates the fix and returns before→after stats + a sample WITHOUT writing. Then call again with apply:true to write a NEW column (<column>_clean) — NON-DESTRUCTIVE, the original column is kept.\n\nWHEN TO USE: after describe_data or the data-quality audit flags a column (a sentinel value, a mixed-type column, messy categories). Use it for fixes the SQL expression language can\'t do: parse a non-ISO date (datetime.strptime → ISO), null a sentinel (return None for "None"/"Undrafted"/999999), canonicalize a messy category (value.strip().lower()). NOTE: value arrives as a string (or None) — cast before numeric work.\n\nRequires python3 on PATH. Executes the Python you provide — same trust model as the SQL you pass to query_data.',
    inputSchema: cleanColumnSchema.shape,
  },
  handleCleanColumn({ sourceManager }),
);

// Privacy / cache management tools
const privacyDeps = { sourceManager, serverStartTime };

server.registerTool(
  'server_status',
  {
    title: 'Server Status',
    description: 'Inspect cached specs, query results, connected sources, and uptime.',
  },
  handleServerStatus(privacyDeps),
);

server.registerTool(
  'capabilities',
  {
    title: 'Environment Capabilities',
    description: 'What this Dolex install can do here: which source types are ready (CSV always; Postgres/MongoDB only if their optional driver is installed), whether python3 is present (for clean_column), and the exact command to enable anything missing. Call this before loading a Postgres/Mongo source so you can tell the user how to install a missing driver instead of hitting an error.',
  },
  handleCapabilities(),
);

server.registerTool(
  'test_source',
  {
    title: 'Test a Source',
    description: 'Health-check a registered Postgres/Mongo source: is its saved database reachable with its credentials? Returns a classified reason (unreachable / auth-failed / db-not-found / driver-missing) so you can tell the user exactly what to fix. A source can be registered even while its DB is down — use this to confirm it once it is up.',
    inputSchema: testSourceInputSchema,
  },
  handleTestSource({ sourceManager }),
);

server.registerTool(
  'clear_cache',
  {
    title: 'Clear Cache',
    description: 'Clear cached data from memory. Scope: "all" (specs + results), "specs" (visualization specs), "results" (query cache). Use after working with sensitive data.',
    inputSchema: clearCacheInputSchema,
  },
  handleClearCache(privacyDeps),
);

server.registerTool(
  'export_html',
  {
    title: 'Export Chart HTML',
    description: 'Get the full self-contained HTML for a visualization by specId. Suitable for saving to file or opening in a browser.\n\nUse writeTo param to save directly to disk (returns path, not HTML — saves tokens).',
    inputSchema: exportHtmlInputSchema.shape,
  },
  handleExportHtml(),
);

server.registerTool(
  'screenshot',
  {
    title: 'Screenshot Visualization',
    description: 'Render a visualization to PNG via headless Chromium. Returns base64-encoded image. Requires Playwright: npm install playwright && npx playwright install chromium.',
    inputSchema: screenshotInputSchema.shape,
  },
  handleScreenshot(),
);

// ─── CLI-ONLY TOOLS ────────────────────────────────────────────────────────
// These tools are for Claude Code / CLI use ONLY. They write HTML to disk
// instead of returning it. DO NOT use these in Claude Desktop.

server.registerTool(
  'visualize_cli_only',
  {
    title: 'CLI ONLY: Visualize to File',
    description: 'FOR CLAUDE CODE / CLI USE ONLY. DO NOT USE IN CLAUDE DESKTOP.\n\nSame as visualize but writes HTML directly to disk via writeTo parameter. NEVER returns HTML in response. Use this for article mode and programmatic workflows.',
    inputSchema: visualizeCliInputSchema.shape,
  },
  handleVisualizeCli(selectPatternCallback, { sourceManager }),
);

server.registerTool(
  'refine_visualization_cli_only',
  {
    title: 'CLI ONLY: Refine to File',
    description: 'FOR CLAUDE CODE / CLI USE ONLY. DO NOT USE IN CLAUDE DESKTOP.\n\nSame as refine_visualization but writes HTML directly to disk via writeTo parameter. NEVER returns HTML in response.',
    inputSchema: refineCliInputSchema.shape,
  },
  handleRefineCli(),
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
