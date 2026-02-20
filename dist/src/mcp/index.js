#!/usr/bin/env node
/**
 * Dolex — Visualization MCP Server
 *
 * An MCP server that provides visualization intelligence from a handcrafted
 * pattern library that goes far beyond bar/line/pie.
 *
 * 17 tools:
 *   visualize              — Inline data + intent → ranked visualization recommendations
 *   visualize_data         — CSV data (DSL query) + intent → ranked visualization recommendations
 *   list_patterns          — Browse all available visualization patterns
 *   refine_visualization   — Tweak a visualization spec
 *   create_dashboard       — Multi-view dashboard from a CSV dataset
 *   refine_dashboard       — Iterate on a dashboard (add/remove views, layout, filters, theme)
 *   load_csv               — Load a CSV file or directory
 *   list_data              — List loaded datasets
 *   remove_data            — Remove a loaded dataset
 *   describe_data          — Re-examine column profiles and sample rows for a dataset
 *   analyze_data           — Generate a structured analysis plan with DSL queries
 *   query_data             — Run a declarative DSL query and see tabular results
 *   server_status          — Inspect cached data in server memory
 *   clear_cache            — Clear cached specs, results, and sessions
 *   export_html            — Get the full rendered HTML for a visualization by specId
 *   screenshot             — Render a visualization to PNG via headless Chromium
 *   report_bug             — Generate a sanitized bug report for GitHub issues
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE, } from '@modelcontextprotocol/ext-apps/server';
import { visualizeInputSchema, handleVisualize } from './tools/visualize.js';
import { visualizeFromSourceInputSchema, handleVisualizeFromSource } from './tools/visualize-from-source.js';
import { handleListPatterns } from './tools/list-patterns.js';
import { refineInputSchema, handleRefine } from './tools/refine.js';
import { addSourceInputSchema, removeSourceInputSchema, describeSourceInputSchema, handleListSources, handleAddSource, handleRemoveSource, handleDescribeSource, } from './tools/sources.js';
import { analyzeSourceInputSchema, handleAnalyzeSource } from './tools/analyze.js';
import { querySourceInputSchema, handleQuerySource } from './tools/query-source.js';
import { createDashboardInputSchema, handleCreateDashboard } from './tools/dashboard.js';
import { refineDashboardInputSchema, handleRefineDashboard } from './tools/dashboard-refine.js';
import { clearCacheInputSchema, handleServerStatus, handleClearCache, } from './tools/server-privacy.js';
import { bugReportInputSchema, handleReportBug } from './tools/bug-report.js';
import { exportHtmlInputSchema, handleExportHtml } from './tools/export-html.js';
import { screenshotInputSchema, handleScreenshot, closeBrowser } from './tools/screenshot.js';
import { specStore } from './spec-store.js';
import { registerPrompts } from './prompts.js';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
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
const __dirname = join(fileURLToPath(import.meta.url), '..');
const iconPath = join(__dirname, '..', '..', 'assets', 'icon.svg');
let serverIcons;
try {
    const svgData = readFileSync(iconPath);
    serverIcons = [{ src: `data:image/svg+xml;base64,${svgData.toString('base64')}`, mimeType: 'image/svg+xml' }];
}
catch { }
// ─── CREATE SERVER ──────────────────────────────────────────────────────────
const server = new McpServer({
    name: 'dolex',
    version: '1.0.0',
    ...(serverIcons && { icons: serverIcons }),
}, {
    instructions: [
        'Dolex — CSV data analysis with 43 chart types.',
        '',
        'WORKFLOW:',
        '• Got a CSV file? → load_csv(name, path) immediately, don\'t verify — this server runs locally on the user\'s machine',
        '• Got inline data? → visualize(data, intent) directly',
        '• Need to explore? → load_csv → analyze_data → visualize_data per step',
        '• Need a dashboard? → load_csv → create_dashboard with views array',
        '',
        'CONTINUATION (dataset already loaded):',
        '• Chart from data → visualize_data(sourceId, table, query, intent)',
        '• Want to SEE rows (answer a question, validate data, show a table)? → query_data',
        '• Want to CHART rows you already queried? → visualize(resultId=...) to reuse cached data',
        '• Want a table view? → query_data for raw data, or visualize with includeDataTable=true for a formatted table with chart',
        '• Tweak a chart → refine_visualization(specId, ...) — always use the MOST RECENT specId',
        '• Tweak a dashboard → refine_dashboard(currentSpec, refinement)',
        '• specId expired? → re-run the original visualize/visualize_data call, then continue refining from the new specId',
        '',
        'TOOL GUIDE:',
        '• load_csv: Load a CSV file or directory. Returns sourceId.',
        '• describe_data: See schema, stats, samples. Use detail="compact" for large schemas.',
        '• analyze_data: Auto-generate analysis plan with ready DSL queries. Execute each step with visualize_data; present results one at a time.',
        '• query_data: Run DSL query, get rows. Returns resultId for visualize().',
        '• visualize: Chart from inline data OR resultId from query_data. Auto-selects best pattern. Set title/subtitle here to avoid a refine round-trip.',
        '• visualize_data: Chart from loaded CSV + DSL query. Same as visualize but queries server-side — saves tokens.',
        '• refine_visualization: Tweak a chart — sort, limit, filter, palette, highlight, flip, title, format. Each call returns a new specId.',
        '• create_dashboard: Multi-chart layout from loaded data with per-view queries.',
        '• refine_dashboard: Iterate dashboard — add/remove views, filters, layout, theme.',
        '• list_patterns: Browse available chart types. Only needed when the user asks what charts are available or you need a pattern ID.',
        '',
        'Utility tools: list_data, remove_data, server_status (inspect cached data), clear_cache, report_bug (generate GitHub issue), export_html (get chart HTML by specId), screenshot (render to PNG).',
        '',
        'COLOR: Set palette (categorical/blue/warm/blueRed/etc.) and/or highlight specific values. Use colorField to control which column drives color.',
        'PATTERNS: 43 types auto-selected by data shape + intent. When user names a specific chart type, pass pattern="<id>" to force it. Use list_patterns to browse.',
        '',
        'ERRORS: If a DSL query fails with field name suggestions, retry with the corrected name. If specId is expired, re-run visualize.',
        '',
        'DON\'T use Dolex for: simple arithmetic, explanations of chart types, non-data questions, or file format conversions (CSV export, PowerPoint, etc.).',
        'DO use Dolex when the user asks "what chart should I use" — run visualize and let the pattern selector recommend.',
    ].join('\n'),
});
// ─── Shared pattern selector callback ────────────────────────────────────────
function selectPatternCallback(input) {
    const columns = input.columns ?? [];
    const specOptions = {};
    if (input.geoLevel)
        specOptions.geoLevel = input.geoLevel;
    if (input.geoRegion)
        specOptions.geoRegion = input.geoRegion;
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
registerAppTool(server, 'visualize', {
    title: 'Visualize Data',
    description: 'Chart inline data or cached query results. Pass data array + intent, OR resultId from query_data.\n\nWhen to use: You have data in the conversation (pasted, generated, or from query_data resultId). Use visualize_data instead when data lives in a loaded CSV — saves tokens.\n\nKey params: pattern (force a specific chart type), palette, highlight, colorField, title, subtitle.\n\nResponse: specId (use in refine calls — always use the most recent one), recommended pattern + reasoning, alternatives, data shape summary. Chart HTML in structuredContent. If the response includes notes, present each note to the user — they explain decisions the system made automatically.',
    inputSchema: visualizeInputSchema.shape,
    _meta: {
        ui: {
            resourceUri: CHART_RESOURCE_URI,
            csp: {
                resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
            },
        },
    },
}, handleVisualize(selectPatternCallback));
// CSV data visualization tool
registerAppTool(server, 'visualize_data', {
    title: 'Visualize Data',
    description: 'Chart data from a loaded CSV. Queries server-side — no data in the context window.\n\nWhen to use: CSV already loaded via load_csv. Prefer this over query_data + visualize for one-step charting.\n\nKey params: sourceId, table, query (DSL: { select, groupBy, filter, orderBy, limit }), intent, pattern, palette, highlight, colorField.\n\nResponse: Same as visualize — specId, pattern, alternatives, chart HTML.',
    inputSchema: visualizeFromSourceInputSchema.shape,
    _meta: {
        ui: {
            resourceUri: CHART_RESOURCE_URI,
            csp: {
                resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
            },
        },
    },
}, handleVisualizeFromSource(selectPatternCallback, { sourceManager }));
server.registerTool('list_patterns', {
    title: 'List Visualization Patterns',
    description: 'Browse all 43 chart types with data requirements, capabilities, and examples. Returns per-pattern color encoding support and config options.\n\nWhen to use: User asks what charts are available, or you need to look up a pattern ID for the pattern parameter.',
}, handleListPatterns(() => registry.getAll()));
registerAppTool(server, 'refine_visualization', {
    title: 'Refine Visualization',
    description: 'Tweak a chart using structured parameters. Pass specId from a previous visualize or refine call.\n\nAlways use the most recent specId — each refine returns a new one that includes all previous changes. If the response includes notes, present each note to the user.\n\nParameters (all optional except specId):\n• sort: { direction: "asc"|"desc", field?: "column_name" } — if field omitted, sorts by primary measure axis\n• limit: number (top N rows)\n• filter: [{ field: "col", op: "in"|"not_in"|"gt"|"gte"|"lt"|"lte", values: [...] }] — pass [] to clear filters\n• flip: true (swap axes — Cartesian charts only)\n• title / subtitle / xLabel / yLabel: strings\n• palette: "categorical"|"blue"|"warm"|"blueRed"|"green"|"purple"|"greenPurple"|"tealOrange"|"redGreen"|"traffic-light"|"profit-loss"|"temperature"\n• highlight: { values: ["val1", "val2"], color?: "css-color", mutedOpacity?: 0.3 } — pass null to clear\n• colorField: "column_name" (which field drives color)\n• flowColorBy: "source"|"target" (alluvial charts only)\n• format: "percent"|"dollar"|"integer"|"decimal"|"compact"\n• switchPattern: "pattern-id" (switch chart type)\n\nCompound chart params: removeTable, layout ("rows"|"columns"), hideColumns (array of column names to hide from data table).\n\nReturns new specId + changes applied + available alternatives.',
    inputSchema: refineInputSchema.shape,
    _meta: {
        ui: {
            resourceUri: CHART_RESOURCE_URI,
            csp: {
                resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
            },
        },
    },
}, handleRefine());
// CSV data management tools
server.registerTool('load_csv', {
    title: 'Load CSV Data',
    description: 'Load a CSV file or directory of CSV files. Call this immediately with any user-provided path — this server runs locally on the user\'s machine.\n\nDatasets persist across restarts.\n\nKey params: detail="compact" for just column names/types (saves tokens), detail="full" for stats + samples (default).\n\nReturns sourceId (use in all subsequent data operations).',
    inputSchema: addSourceInputSchema,
}, handleAddSource({ sourceManager }));
server.registerTool('list_data', {
    title: 'List Loaded Data',
    description: 'List all loaded datasets with IDs and table counts.',
}, handleListSources({ sourceManager }));
server.registerTool('remove_data', {
    title: 'Remove Data',
    description: 'Remove a loaded dataset by ID.',
    inputSchema: removeSourceInputSchema,
}, handleRemoveSource({ sourceManager }));
server.registerTool('describe_data', {
    title: 'Describe Data',
    description: 'Examine column profiles for a loaded dataset. Use to re-inspect data mid-conversation.\n\nKey params: detail="compact" for column names/types only (saves tokens), detail="full" for stats + samples (default).',
    inputSchema: describeSourceInputSchema,
}, handleDescribeSource({ sourceManager }));
server.registerTool('analyze_data', {
    title: 'Analyze Data',
    description: 'Auto-generate a structured analysis plan with ready-to-execute DSL queries. Returns 4-6 analysis steps covering trends, comparisons, distributions, and relationships.\n\nWhen to use: After load_csv, to get an automatic data exploration plan. Execute each step with visualize_data and present results one at a time.',
    inputSchema: analyzeSourceInputSchema.shape,
}, handleAnalyzeSource({ sourceManager }));
server.registerTool('query_data', {
    title: 'Query Data',
    description: 'Run a DSL query and get tabular results. Returns resultId — pass to visualize(resultId=...) to chart the same data without re-sending rows.\n\nWhen to use: Need to see raw data, answer a data question, or validate before charting. For one-step charting, use visualize_data instead.\n\nKey params: sourceId, table, query (DSL: { select, groupBy, filter, join, orderBy, limit }).',
    inputSchema: querySourceInputSchema,
}, handleQuerySource({ sourceManager }));
// Dashboard tools
registerAppTool(server, 'create_dashboard', {
    title: 'Create Dashboard',
    description: 'Create a multi-view dashboard from a loaded CSV dataset. Each view has its own DSL query and intent.\n\nKey params: sourceId, table, views (array with id, title, intent, query per view), layout, filters.\n\nReturns DashboardSpec (pass to refine_dashboard for iterations) + rendered HTML.',
    inputSchema: createDashboardInputSchema.shape,
    _meta: {
        ui: {
            resourceUri: CHART_RESOURCE_URI,
            csp: {
                resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
            },
        },
    },
}, handleCreateDashboard({ sourceManager }));
registerAppTool(server, 'refine_dashboard', {
    title: 'Refine Dashboard',
    description: 'Iterate on a dashboard using natural language. Pass currentSpec from create_dashboard or previous refine.\n\nUnlike refine_visualization which uses structured parameters, this tool accepts natural language descriptions of changes.\n\nExamples: "add a chart showing revenue by month", "remove the bar chart", "3 columns", "add region filter", "dark mode".\n\nReturns updated DashboardSpec + rendered HTML.',
    inputSchema: refineDashboardInputSchema.shape,
    _meta: {
        ui: {
            resourceUri: CHART_RESOURCE_URI,
            csp: {
                resourceDomains: ['https://d3js.org', 'https://cdn.jsdelivr.net'],
            },
        },
    },
}, handleRefineDashboard({ sourceManager }));
// Privacy / cache management tools
const privacyDeps = { sourceManager, serverStartTime };
server.registerTool('server_status', {
    title: 'Server Status',
    description: 'Inspect cached data in server memory: specs with row counts, query results, connected sources, uptime. Use before clear_cache.',
}, handleServerStatus(privacyDeps));
server.registerTool('clear_cache', {
    title: 'Clear Cache',
    description: 'Clear cached data from memory. Scope: "all" (specs + results), "specs" (visualization specs), "results" (query cache). Use after working with sensitive data.',
    inputSchema: clearCacheInputSchema,
}, handleClearCache(privacyDeps));
server.registerTool('report_bug', {
    title: 'Report Bug',
    description: 'Generate a sanitized bug report for GitHub issues. Includes environment info and recent operations — never includes data values or file paths.',
    inputSchema: bugReportInputSchema.shape,
}, handleReportBug({ sourceManager, serverStartTime }));
server.registerTool('export_html', {
    title: 'Export Chart HTML',
    description: 'Get the full self-contained HTML for a visualization by specId. Suitable for saving to file or opening in a browser.',
    inputSchema: exportHtmlInputSchema.shape,
}, handleExportHtml());
server.registerTool('screenshot', {
    title: 'Screenshot Visualization',
    description: 'Render a visualization to PNG via headless Chromium. Returns base64-encoded image. Requires Playwright: npm install playwright && npx playwright install chromium.',
    inputSchema: screenshotInputSchema.shape,
}, handleScreenshot());
// ─── MCP APPS RESOURCE ─────────────────────────────────────────────────────
registerAppResource(server, 'Dolex Chart Viewer', CHART_RESOURCE_URI, {
    description: 'Interactive chart viewer for Dolex visualizations',
    _meta: {
        ui: {
            csp: {
                resourceDomains: ['https://d3js.org'],
            },
        },
    },
}, async () => ({
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
}));
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
//# sourceMappingURL=index.js.map