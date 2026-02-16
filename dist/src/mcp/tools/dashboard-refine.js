/**
 * MCP Tool: refine_dashboard
 *
 * Takes a current dashboard spec and a natural language refinement,
 * applies changes, re-executes affected queries, and returns the updated dashboard.
 *
 * Refinement categories:
 * - Add view: "add a chart showing X"
 * - Remove view: "remove the trend chart" / "remove view-2"
 * - Modify view: "change the bar chart to show top 5"
 * - Layout: "make it 3 columns" / "make view-1 wider"
 * - Filters: "add a region filter"
 * - Theme: "dark mode" / "light mode"
 * - Swap: "swap view-1 and view-2"
 * - Pattern override: "show the trend as an area chart"
 */
import { buildDashboardHtml } from '../../renderers/html/builders/dashboard.js';
import { refineDashboardInputSchema } from './dsl-schemas.js';
import { htmlResponse, executeDashboardViews, isViewExecutionError, } from './shared.js';
export { refineDashboardInputSchema };
// ─── VIEW MATCHING ──────────────────────────────────────────────────────────
/** Find a view by ID, title, or pattern match */
function findView(views, query) {
    const lower = query.toLowerCase();
    // Exact ID match
    const byId = views.find(v => v.id.toLowerCase() === lower);
    if (byId)
        return byId;
    // Title match (fuzzy)
    const byTitle = views.find(v => v.title.toLowerCase().includes(lower));
    if (byTitle)
        return byTitle;
    // Pattern match (e.g., "the bar chart")
    const patternNames = [
        'bar', 'line', 'scatter', 'histogram', 'treemap', 'sankey', 'waffle',
        'stacked-bar', 'diverging-bar', 'slope-chart', 'bump-chart', 'beeswarm',
        'violin', 'ridgeline', 'strip-plot', 'sunburst', 'small-multiples',
        'sparkline-grid', 'calendar-heatmap', 'connected-scatter', 'connected-dot-plot',
        'parallel-coordinates', 'radar', 'alluvial', 'chord', 'choropleth',
        'proportional-symbol', 'circle-pack', 'metric',
    ];
    for (const pname of patternNames) {
        if (lower.includes(pname)) {
            const byPattern = views.find(v => v.pattern === pname);
            if (byPattern)
                return byPattern;
        }
    }
    // Intent match
    const byIntent = views.find(v => v.intent.toLowerCase().includes(lower));
    if (byIntent)
        return byIntent;
    return undefined;
}
/**
 * Split a compound refinement into independent clauses.
 * Splits on commas and " and " between independent clauses,
 * but avoids splitting inside patterns like "swap X and Y".
 */
function splitClauses(refinement) {
    // First split on commas
    const commaParts = refinement.split(/\s*,\s*/);
    const clauses = [];
    for (const part of commaParts) {
        // Split on " and " but not when part of "swap X and Y" or "X and Y filter"
        if (/\bswap\b/i.test(part) || /\bfilter\b.*\band\b/i.test(part)) {
            clauses.push(part.trim());
        }
        else {
            // Split on " and " only when followed by a verb/action keyword
            const andParts = part.split(/\s+and\s+(?=(?:make|show|change|switch|use|set|add|remove|delete))/i);
            for (const ap of andParts) {
                const trimmed = ap.trim();
                if (trimmed)
                    clauses.push(trimmed);
            }
        }
    }
    return clauses.length > 0 ? clauses : [refinement];
}
/** Known pattern names for matching */
const KNOWN_PATTERNS = [
    'bar', 'line', 'scatter', 'histogram', 'treemap', 'sankey', 'waffle',
    'stacked-bar', 'diverging-bar', 'slope-chart', 'bump-chart', 'beeswarm',
    'violin', 'ridgeline', 'strip-plot', 'sunburst', 'small-multiples',
    'sparkline-grid', 'calendar-heatmap', 'connected-scatter', 'connected-dot-plot',
    'parallel-coordinates', 'radar', 'alluvial', 'chord', 'choropleth',
    'proportional-symbol', 'circle-pack', 'metric', 'area',
];
/** Known palette keywords */
const PALETTE_KEYWORDS = {
    warm: 'warm',
    cool: 'blue',
    blue: 'blue',
    green: 'green',
    purple: 'purple',
    'teal-orange': 'tealOrange',
    'blue-red': 'blueRed',
    'green-purple': 'greenPurple',
    'red-green': 'redGreen',
};
/** Parse a single clause into a RefinementAction (or null if not recognized) */
function parseClause(clause, views) {
    const lower = clause.toLowerCase();
    // Theme
    if (lower.includes('dark mode') || lower.includes('dark theme')) {
        return { type: 'theme', details: { theme: 'dark' } };
    }
    if (lower.includes('light mode') || lower.includes('light theme')) {
        return { type: 'theme', details: { theme: 'light' } };
    }
    // Title
    const titleMatch = clause.match(/title[:\s]+"?([^"]+)"?/i);
    if (titleMatch) {
        return { type: 'title', details: { title: titleMatch[1].trim() } };
    }
    // Span/sizing: "full width" or "span N columns" or "spanning the full width"
    const fullWidthMatch = lower.match(/(?:(?:make|set)\s+)?(?:the\s+)?(.+?)\s+(?:span(?:ning)?|take)\s+(?:the\s+)?full\s+width/);
    const spanColMatch = lower.match(/(?:(?:make|set)\s+)?(?:the\s+)?(.+?)\s+span(?:ning)?\s+(\d+)\s+column/);
    if (fullWidthMatch) {
        const view = findView(views, fullWidthMatch[1].trim());
        if (view) {
            return { type: 'layout', details: { viewId: view.id, colSpan: 'full' } };
        }
    }
    if (spanColMatch) {
        const view = findView(views, spanColMatch[1].trim());
        if (view) {
            return { type: 'layout', details: { viewId: view.id, colSpan: parseInt(spanColMatch[2], 10) } };
        }
    }
    // Also match "X spanning the full width" where X comes before "spanning"
    const spanFullAlt = lower.match(/(.+?)\s+spanning\s+(?:the\s+)?full\s+width/);
    if (spanFullAlt) {
        const view = findView(views, spanFullAlt[1].trim());
        if (view) {
            return { type: 'layout', details: { viewId: view.id, colSpan: 'full' } };
        }
    }
    // Layout: column count
    const colMatch = lower.match(/(\d+)\s*column/);
    if (colMatch) {
        return { type: 'layout', details: { columns: parseInt(colMatch[1], 10) } };
    }
    // Layout: make view wider
    const widerMatch = lower.match(/(?:make|set)\s+(.+?)\s+wider/);
    if (widerMatch) {
        const view = findView(views, widerMatch[1].trim());
        if (view) {
            return { type: 'layout', details: { viewId: view.id, colSpan: 2 } };
        }
    }
    // Swap views
    const swapMatch = lower.match(/swap\s+(.+?)\s+and\s+(.+)/);
    if (swapMatch) {
        const v1 = findView(views, swapMatch[1].trim());
        const v2 = findView(views, swapMatch[2].trim());
        if (v1 && v2) {
            return { type: 'swap', details: { id1: v1.id, id2: v2.id } };
        }
    }
    // Remove view
    if (lower.includes('remove') || lower.includes('delete')) {
        const removeMatch = lower.match(/(?:remove|delete)\s+(?:the\s+)?(.+?)(?:\s+view|\s+chart|\s+panel)?$/);
        if (removeMatch) {
            const view = findView(views, removeMatch[1].trim());
            if (view) {
                return { type: 'remove_view', details: { viewId: view.id } };
            }
        }
    }
    // Add filter
    if (lower.includes('add') && lower.includes('filter')) {
        const filterMatch = lower.match(/add\s+(?:a\s+)?(?:(.+?)\s+)?filter/);
        if (filterMatch) {
            const field = filterMatch[1]?.trim();
            return {
                type: 'filter',
                details: {
                    action: 'add',
                    field: field || '',
                    filterType: lower.includes('multi') ? 'multi-select' : 'select',
                },
            };
        }
    }
    // Filter to value
    if (lower.includes('filter to') || lower.includes('filter by')) {
        const filterValMatch = lower.match(/filter\s+(?:to|by)\s+(.+)/);
        if (filterValMatch) {
            return {
                type: 'filter',
                details: { action: 'set', value: filterValMatch[1].trim() },
            };
        }
    }
    // Add view
    if (lower.includes('add') && (lower.includes('chart') || lower.includes('view') || lower.includes('showing'))) {
        const addMatch = lower.match(/add\s+(?:a\s+)?(?:new\s+)?(?:chart|view|panel)\s+(?:showing\s+)?(.+)/);
        const intent = addMatch ? addMatch[1].trim() : clause;
        return { type: 'add_view', details: { intent } };
    }
    // Color/palette: "use a warm palette" or "warm colors" or "use warm palette for X"
    for (const [keyword, palette] of Object.entries(PALETTE_KEYWORDS)) {
        if (lower.includes(keyword) && (lower.includes('palette') || lower.includes('color'))) {
            // Check if it targets a specific view
            const viewMatch = lower.match(/(?:for|on)\s+(?:the\s+)?(.+?)(?:\s+view|\s+chart|\s+panel)?$/);
            if (viewMatch) {
                const view = findView(views, viewMatch[1].trim());
                if (view) {
                    return { type: 'modify_view', details: { viewId: view.id, colorPreferences: { palette } } };
                }
            }
            // Apply to all views as a global color change
            return { type: 'modify_view', details: { allViews: true, colorPreferences: { palette } } };
        }
    }
    // Pattern override: "show X as a line chart" / "show the trend as a line"
    const patternOverride = lower.match(/(?:show|change|switch|display)\s+(?:the\s+)?(.+?)\s+(?:to|as)\s+(?:a\s+)?(\w[\w-]*)/);
    if (patternOverride) {
        const viewRef = patternOverride[1].trim();
        const patternCandidate = patternOverride[2].trim();
        // Only accept if the candidate is a known pattern or close to one
        const matchedPattern = KNOWN_PATTERNS.find(p => p === patternCandidate || p.startsWith(patternCandidate));
        if (matchedPattern) {
            const view = findView(views, viewRef);
            if (view) {
                return { type: 'modify_view', details: { viewId: view.id, pattern: matchedPattern } };
            }
        }
    }
    // Modify view: "change X to show top 5"
    const modifyMatch = lower.match(/(?:change|update|modify)\s+(?:the\s+)?(.+?)\s+to\s+(.+)/);
    if (modifyMatch) {
        const view = findView(views, modifyMatch[1].trim());
        if (view) {
            return { type: 'modify_view', details: { viewId: view.id, modification: modifyMatch[2].trim() } };
        }
    }
    return null;
}
/**
 * Parse a compound refinement into multiple actions.
 * Splits compound instructions, parses each clause independently.
 */
function parseRefinements(refinement, views) {
    const clauses = splitClauses(refinement);
    const actions = [];
    for (const clause of clauses) {
        const action = parseClause(clause, views);
        if (action) {
            actions.push(action);
        }
    }
    // If nothing matched, try the full string as one clause
    if (actions.length === 0) {
        const action = parseClause(refinement, views);
        if (action) {
            actions.push(action);
        }
        else {
            actions.push({ type: 'unknown', details: { refinement } });
        }
    }
    return actions;
}
// ─── HANDLER ────────────────────────────────────────────────────────────────
export function handleRefineDashboard(deps) {
    return async (args) => {
        const spec = JSON.parse(JSON.stringify(args.currentSpec));
        const refinement = args.refinement;
        const changes = [];
        const actions = parseRefinements(refinement, spec.views);
        for (const action of actions) {
            switch (action.type) {
                case 'theme': {
                    spec.theme = action.details.theme;
                    changes.push(`Changed theme to ${action.details.theme}`);
                    break;
                }
                case 'title': {
                    spec.title = action.details.title;
                    changes.push(`Changed title to "${action.details.title}"`);
                    break;
                }
                case 'layout': {
                    if (action.details.columns) {
                        spec.layout.columns = Math.min(4, Math.max(1, action.details.columns));
                        changes.push(`Changed layout to ${spec.layout.columns} columns`);
                    }
                    if (action.details.viewId && action.details.colSpan) {
                        if (!spec.layout.viewSizes)
                            spec.layout.viewSizes = {};
                        const span = action.details.colSpan === 'full' ? spec.layout.columns : action.details.colSpan;
                        spec.layout.viewSizes[action.details.viewId] = {
                            ...(spec.layout.viewSizes[action.details.viewId] || {}),
                            colSpan: span,
                        };
                        changes.push(`Made view "${action.details.viewId}" span ${span} columns`);
                    }
                    break;
                }
                case 'swap': {
                    const idx1 = spec.views.findIndex(v => v.id === action.details.id1);
                    const idx2 = spec.views.findIndex(v => v.id === action.details.id2);
                    if (idx1 >= 0 && idx2 >= 0) {
                        const tmp = spec.views[idx1];
                        spec.views[idx1] = spec.views[idx2];
                        spec.views[idx2] = tmp;
                        changes.push(`Swapped views "${action.details.id1}" and "${action.details.id2}"`);
                    }
                    break;
                }
                case 'remove_view': {
                    const before = spec.views.length;
                    spec.views = spec.views.filter(v => v.id !== action.details.viewId);
                    if (spec.views.length < before) {
                        changes.push(`Removed view "${action.details.viewId}"`);
                    }
                    else {
                        changes.push(`View "${action.details.viewId}" not found`);
                    }
                    break;
                }
                case 'add_view': {
                    const newId = `view-${spec.views.length + 1}`;
                    const newView = {
                        id: newId,
                        title: action.details.intent,
                        intent: action.details.intent,
                        query: { select: ['*'] },
                    };
                    spec.views.push(newView);
                    changes.push(`Added new view "${newId}" with intent: ${action.details.intent}`);
                    break;
                }
                case 'filter': {
                    if (action.details.action === 'add' && action.details.field) {
                        if (!spec.globalFilters)
                            spec.globalFilters = [];
                        const filter = {
                            field: action.details.field,
                            type: action.details.filterType || 'select',
                        };
                        spec.globalFilters.push(filter);
                        changes.push(`Added ${filter.type} filter for "${action.details.field}"`);
                    }
                    else if (action.details.action === 'set') {
                        changes.push(`Filter value noted: "${action.details.value}" — apply via globalFilters.currentValue`);
                    }
                    break;
                }
                case 'modify_view': {
                    // Handle allViews (e.g., global color change)
                    const targetViews = action.details.allViews
                        ? spec.views
                        : spec.views.filter(v => v.id === action.details.viewId);
                    for (const view of targetViews) {
                        if (action.details.pattern) {
                            view.pattern = action.details.pattern;
                            changes.push(`Changed view "${view.id}" pattern to ${action.details.pattern}`);
                        }
                        if (action.details.colorPreferences) {
                            if (!view.colorPreferences)
                                view.colorPreferences = {};
                            Object.assign(view.colorPreferences, action.details.colorPreferences);
                            changes.push(`Updated color preferences for view "${view.id}"`);
                        }
                        if (action.details.modification) {
                            const mod = action.details.modification.toLowerCase();
                            const limitMatch = mod.match(/(?:top|limit|first)\s*(\d+)/);
                            if (limitMatch) {
                                view.query.limit = parseInt(limitMatch[1], 10);
                                changes.push(`Limited view "${view.id}" to ${view.query.limit} rows`);
                            }
                            else {
                                changes.push(`Modification noted for view "${view.id}": ${action.details.modification}`);
                            }
                        }
                    }
                    break;
                }
                default:
                    changes.push(`Refinement noted: "${refinement}" — manual adjustment may be needed`);
            }
        }
        const viewResult = await executeDashboardViews(spec.views, spec.sourceId, spec.table, deps.sourceManager);
        if (isViewExecutionError(viewResult))
            return viewResult;
        const html = buildDashboardHtml(spec, viewResult.viewData);
        return htmlResponse({ dashboardSpec: spec, changes, viewReasonings: viewResult.viewReasonings }, html);
    };
}
//# sourceMappingURL=dashboard-refine.js.map