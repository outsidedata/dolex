/**
 * MCP Tool: refine_visualization
 * Takes a current visualization spec and a refinement request,
 * returns an updated spec.
 *
 * Supports both atomic VisualizationSpec and CompoundVisualizationSpec.
 * Accepts specId from a previous visualize/refine call.
 */
import { z } from 'zod';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import { errorResponse, jsonResponse, htmlResponse } from './shared.js';
import { logOperation } from './operation-log.js';
export const refineInputSchema = z.object({
    specId: z.string().describe('Spec ID from a previous visualize or refine call'),
    refinement: z.string().describe('What to change — e.g., "sort by value descending", "use warm palette", "highlight Engineering and Science", "mute to 30% opacity"'),
    selectAlternative: z.string().optional().describe('Switch to an alternative pattern by ID (e.g., "line"). Uses alternatives stored from the original visualize call.'),
});
// ─── PALETTE LOOKUP ─────────────────────────────────────────────────────────
/** Map natural language color terms to valid ColorPaletteName values */
const PALETTE_LOOKUP = [
    [/\bblue\s*red\b|\bblue[-_]?red\b/, 'blueRed', 'blueRed diverging palette'],
    [/\bgreen\s*purple\b|\bgreen[-_]?purple\b/, 'greenPurple', 'greenPurple diverging palette'],
    [/\bteal\s*orange\b|\bteal[-_]?orange\b/, 'tealOrange', 'tealOrange diverging palette'],
    [/\bred\s*green\b|\bred[-_]?green\b/, 'redGreen', 'redGreen diverging palette'],
    [/\btraffic\s*light\b|\bstoplight\b/, 'traffic-light', 'traffic-light palette'],
    [/\bprofit[-\s]*loss\b/, 'profit-loss', 'profit-loss palette'],
    [/\btemperature\b/, 'temperature', 'temperature palette'],
    [/\bwarm\b|\borange\b/, 'warm', 'warm palette'],
    [/\bpurple\b|\bviolet\b/, 'purple', 'purple palette'],
    [/\bgreen\b/, 'green', 'green palette'],
    [/\bblue\b|\bsequential\b|\bcool\b/, 'blue', 'blue palette'],
    [/\bdiverging\b/, 'blueRed', 'blueRed diverging palette'],
    [/\bcategorical\b|\bdistinct\b|\bqualitative\b/, 'categorical', 'categorical palette'],
];
function matchPalette(text) {
    const lower = text.toLowerCase();
    for (const [regex, palette, label] of PALETTE_LOOKUP) {
        if (regex.test(lower))
            return [palette, label];
    }
    return null;
}
// ─── HIGHLIGHT PARSING ──────────────────────────────────────────────────────
/** Parse highlight values from a refinement string */
function parseHighlight(refinement, lower) {
    // "highlight X and Y" or "highlight X, Y, Z"
    const highlightMatch = lower.match(/highlight\s+(.+?)(?:\s+in\s+(#[0-9a-f]{3,8}|\w+))?$/);
    if (!highlightMatch)
        return null;
    const rawValues = highlightMatch[1]
        // Remove trailing "in <color>" that may have been greedily captured
        .replace(/\s+in\s+#[0-9a-f]{3,8}$/i, '')
        .replace(/\s+in\s+\w+$/i, '');
    // Split on " and ", commas, or " & "
    const values = rawValues
        .split(/\s*(?:,\s*|\s+and\s+|\s*&\s*)\s*/)
        .map(v => v.trim())
        .filter(Boolean)
        // Restore original casing from the refinement string
        .map(v => {
        const idx = refinement.toLowerCase().indexOf(v);
        return idx >= 0 ? refinement.slice(idx, idx + v.length) : v;
    });
    if (values.length === 0)
        return null;
    const result = { values };
    if (highlightMatch[2])
        result.color = highlightMatch[2];
    return result;
}
/** Parse muted opacity from refinement */
function parseMutedOpacity(lower) {
    const match = lower.match(/mute\w*\s+(?:to\s+)?(\d+)%\s*opacity/);
    if (match)
        return parseInt(match[1], 10) / 100;
    const match2 = lower.match(/opacity\s+(\d+)%/);
    if (match2)
        return parseInt(match2[1], 10) / 100;
    const match3 = lower.match(/mute\w*\s+(?:to\s+)?(?:0?\.\d+)/);
    if (match3) {
        const val = parseFloat(match3[0].match(/\d+\.\d+/)[0]);
        return val > 0 && val <= 1 ? val : null;
    }
    return null;
}
// ─── APPLY REFINEMENT ───────────────────────────────────────────────────────
/** Apply refinements to an atomic visualization spec */
function applyRefinement(spec, refinement) {
    const changes = [];
    const updated = JSON.parse(JSON.stringify(spec));
    const lower = refinement.toLowerCase();
    // Sort refinements
    if (lower.includes('sort') && lower.includes('desc')) {
        if (updated.encoding.x)
            updated.encoding.x.sort = 'descending';
        if (updated.encoding.y)
            updated.encoding.y.sort = 'descending';
        changes.push('Applied descending sort');
    }
    else if (lower.includes('sort') && lower.includes('asc')) {
        if (updated.encoding.x)
            updated.encoding.x.sort = 'ascending';
        if (updated.encoding.y)
            updated.encoding.y.sort = 'ascending';
        changes.push('Applied ascending sort');
    }
    // Limit refinements
    const limitMatch = lower.match(/(?:top|limit|first)\s*(\d+)/);
    if (limitMatch) {
        const limit = parseInt(limitMatch[1], 10);
        updated.data = updated.data.slice(0, limit);
        changes.push(`Limited data to top ${limit} rows`);
    }
    // Orientation refinements
    if (lower.includes('horizontal') || lower.includes('flip')) {
        const { x, y } = updated.encoding;
        if (x && y) {
            updated.encoding.x = y;
            updated.encoding.y = x;
            changes.push('Flipped axes for horizontal layout');
        }
    }
    // Title refinements
    const titleMatch = refinement.match(/title[:\s]+"?([^"]+)"?/i);
    if (titleMatch) {
        updated.title = titleMatch[1].trim();
        changes.push(`Changed title to "${updated.title}"`);
    }
    // ── Palette refinements (replaces broken colorScheme block) ──
    if (lower.includes('color') || lower.includes('palette') || lower.includes('scheme') ||
        lower.includes('warm') || lower.includes('diverging') || lower.includes('sequential') ||
        lower.includes('categorical')) {
        const paletteResult = matchPalette(lower);
        if (paletteResult) {
            if (!updated.encoding.color)
                updated.encoding.color = {};
            updated.encoding.color.palette = paletteResult[0];
            changes.push(`Applied ${paletteResult[1]}`);
        }
    }
    // ── Highlight refinements ──
    if (lower.includes('highlight')) {
        const highlight = parseHighlight(refinement, lower);
        if (highlight && highlight.values.length > 0) {
            // Validate highlight values against actual data values in the color field
            const colorField = updated.encoding.color?.field;
            if (colorField) {
                const dataValues = new Set(updated.data.map(d => String(d[colorField]).toLowerCase()));
                const validValues = highlight.values.filter(v => dataValues.has(v.toLowerCase()));
                if (validValues.length > 0) {
                    if (!updated.encoding.color)
                        updated.encoding.color = {};
                    updated.encoding.color.highlight = {
                        values: validValues,
                        ...(highlight.color ? { color: highlight.color } : {}),
                    };
                    changes.push(`Highlighted values: ${validValues.join(', ')}`);
                }
                // If no values match data, skip highlight (it's likely descriptive text like "highlight differences")
            }
            else {
                // No color field — apply highlight as-is (may be used for x/y field matching)
                if (!updated.encoding.color)
                    updated.encoding.color = {};
                updated.encoding.color.highlight = {
                    values: highlight.values,
                    ...(highlight.color ? { color: highlight.color } : {}),
                };
                changes.push(`Highlighted values: ${highlight.values.join(', ')}`);
            }
        }
    }
    // ── Muted opacity refinements ──
    if (lower.includes('mute') || lower.includes('opacity')) {
        const opacity = parseMutedOpacity(lower);
        if (opacity !== null) {
            if (!updated.encoding.color)
                updated.encoding.color = {};
            if (!updated.encoding.color.highlight) {
                // Set opacity on existing highlight or create a placeholder
                updated.encoding.color.highlight = { values: [], mutedOpacity: opacity };
            }
            else {
                updated.encoding.color.highlight.mutedOpacity = opacity;
            }
            changes.push(`Set muted opacity to ${opacity}`);
        }
    }
    // ── colorBy refinements (for alluvial, sankey, chord) ──
    const colorByMatch = lower.match(/color\s*by\s+(\w+)/);
    if (colorByMatch) {
        updated.config.colorBy = colorByMatch[1];
        changes.push(`Set colorBy to "${colorByMatch[1]}"`);
    }
    // Percentage format
    if (lower.includes('percent') || lower.includes('%')) {
        if (updated.encoding.y) {
            updated.encoding.y.format = '.1%';
            changes.push('Applied percentage format to y-axis');
        }
    }
    if (changes.length === 0) {
        changes.push(`Refinement noted: "${refinement}" — manual adjustment may be needed`);
        updated.config._pendingRefinement = refinement;
    }
    return { spec: updated, changes };
}
/** Apply refinements to a compound visualization spec */
function applyCompoundRefinement(spec, refinement) {
    const changes = [];
    const updated = JSON.parse(JSON.stringify(spec));
    const lower = refinement.toLowerCase();
    // ── Remove table ──
    if (lower.includes('remove') && lower.includes('table')) {
        const chartView = updated.views.find(v => v.type === 'chart');
        if (chartView?.chart) {
            // Unwrap compound to atomic spec
            const atomicSpec = {
                ...chartView.chart,
                data: updated.data,
            };
            return { spec: atomicSpec, changes: ['Removed table, returned atomic chart spec'] };
        }
    }
    // ── Layout changes ──
    if (lower.includes('side by side') || lower.includes('columns') || lower.includes('right') || lower.includes('left')) {
        updated.layout.type = 'columns';
        changes.push('Changed layout to side-by-side columns');
    }
    else if (lower.includes('stack') || lower.includes('rows') || lower.includes('below') || lower.includes('above')) {
        updated.layout.type = 'rows';
        changes.push('Changed layout to stacked rows');
    }
    // ── Change interaction field ──
    const highlightFieldMatch = lower.match(/highlight\s+(?:by|on)\s+(\w+)/);
    if (highlightFieldMatch) {
        const field = highlightFieldMatch[1];
        updated.interactions = [{ type: 'highlight', field }];
        changes.push(`Changed highlight interaction field to "${field}"`);
    }
    // ── Table column visibility ──
    const hideMatch = lower.match(/hide\s+(?:the\s+)?(\w+)\s+column/);
    if (hideMatch) {
        const colName = hideMatch[1].toLowerCase();
        const tableView = updated.views.find(v => v.type === 'table');
        if (tableView?.table?.columns) {
            tableView.table.columns = tableView.table.columns.filter(c => c.field.toLowerCase() !== colName && (c.title || '').toLowerCase() !== colName);
            changes.push(`Hidden "${colName}" column from table`);
        }
    }
    // ── Title change ──
    const titleMatch = refinement.match(/title[:\s]+"?([^"]+)"?/i);
    if (titleMatch) {
        updated.title = titleMatch[1].trim();
        // Also update chart view title
        const chartView = updated.views.find(v => v.type === 'chart');
        if (chartView?.chart)
            chartView.chart.title = updated.title;
        changes.push(`Changed title to "${updated.title}"`);
    }
    // ── Delegate chart-specific refinements to the chart view ──
    if (changes.length === 0) {
        const chartView = updated.views.find(v => v.type === 'chart');
        if (chartView?.chart) {
            const chartSpec = {
                ...chartView.chart,
                data: updated.data,
            };
            const chartResult = applyRefinement(chartSpec, refinement);
            // Write chart changes back to compound spec
            const refinedChart = chartResult.spec;
            chartView.chart = {
                pattern: refinedChart.pattern,
                title: refinedChart.title,
                encoding: refinedChart.encoding,
                config: refinedChart.config,
            };
            updated.data = refinedChart.data;
            changes.push(...chartResult.changes);
        }
    }
    if (changes.length === 0) {
        changes.push(`Refinement noted: "${refinement}" — manual adjustment may be needed`);
    }
    return { spec: updated, changes };
}
// ─── BUILD HTML FOR OUTPUT ──────────────────────────────────────────────────
function buildOutputHtml(spec) {
    if (isCompoundSpec(spec)) {
        return buildCompoundHtml(spec);
    }
    if (isHtmlPatternSupported(spec.pattern)) {
        return buildChartHtml(spec);
    }
    return undefined;
}
// ─── HANDLER ────────────────────────────────────────────────────────────────
export function handleRefine() {
    return async (args) => {
        const start = Date.now();
        let spec;
        if (args.selectAlternative) {
            const altSpec = specStore.getAlternative(args.specId, args.selectAlternative);
            if (!altSpec) {
                return errorResponse(`Alternative pattern "${args.selectAlternative}" not found for specId "${args.specId}". Check the alternatives list from the original visualize call.`);
            }
            spec = altSpec;
        }
        else {
            const stored = specStore.get(args.specId);
            if (!stored) {
                return errorResponse(`Spec "${args.specId}" not found. It may have expired. Re-run visualize to get a new specId.`);
            }
            spec = stored.spec;
        }
        const result = isCompoundSpec(spec)
            ? applyCompoundRefinement(spec, args.refinement)
            : applyRefinement(spec, args.refinement);
        const outputHtml = buildOutputHtml(result.spec);
        const newSpecId = specStore.updateSpec(args.specId, result.spec);
        const body = { specId: newSpecId, changes: result.changes };
        const pattern = isCompoundSpec(result.spec)
            ? result.spec.views?.find((v) => v.type === 'chart')?.chart?.pattern
            : result.spec.pattern;
        logOperation({
            toolName: 'refine_visualization',
            timestamp: start,
            durationMs: Date.now() - start,
            success: true,
            meta: {
                pattern,
                specId: newSpecId,
                changes: result.changes,
            },
        });
        if (outputHtml) {
            return htmlResponse(body, outputHtml);
        }
        return jsonResponse(body);
    };
}
//# sourceMappingURL=refine.js.map