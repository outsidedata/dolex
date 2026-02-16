/**
 * Pattern Registry — stores all visualization patterns and provides lookup.
 *
 * The registry is the single source of truth for all available patterns.
 * Patterns register themselves on import, and the registry provides
 * methods to query patterns by ID, category, or data requirements.
 */
// ─── COMPARISON ──────────────────────────────────────────────────────────────
import { barPattern } from './definitions/comparison/bar.js';
import { divergingBarPattern } from './definitions/comparison/diverging-bar.js';
import { slopeChartPattern } from './definitions/comparison/slope-chart.js';
import { connectedDotPlotPattern } from './definitions/comparison/connected-dot-plot.js';
import { bumpChartPattern } from './definitions/comparison/bump-chart.js';
import { lollipopPattern } from './definitions/comparison/lollipop.js';
import { bulletPattern } from './definitions/comparison/bullet.js';
import { groupedBarPattern } from './definitions/comparison/grouped-bar.js';
import { waterfallPattern } from './definitions/comparison/waterfall.js';
// ─── DISTRIBUTION ────────────────────────────────────────────────────────────
import { histogramPattern } from './definitions/distribution/histogram.js';
import { beeswarmPattern } from './definitions/distribution/beeswarm.js';
import { violinPattern } from './definitions/distribution/violin.js';
import { ridgelinePattern } from './definitions/distribution/ridgeline.js';
import { stripPlotPattern } from './definitions/distribution/strip-plot.js';
import { boxPlotPattern } from './definitions/distribution/box-plot.js';
import { densityPlotPattern } from './definitions/distribution/density-plot.js';
// ─── COMPOSITION ─────────────────────────────────────────────────────────────
import { stackedBarPattern } from './definitions/composition/stacked-bar.js';
import { wafflePattern } from './definitions/composition/waffle.js';
import { treemapPattern } from './definitions/composition/treemap.js';
import { sunburstPattern } from './definitions/composition/sunburst.js';
import { circlePackPattern } from './definitions/composition/circle-pack.js';
import { metricPattern } from './definitions/composition/metric.js';
import { donutPattern } from './definitions/composition/donut.js';
import { marimekkoPattern } from './definitions/composition/marimekko.js';
import { iciclePattern } from './definitions/composition/icicle.js';
// ─── TIME ────────────────────────────────────────────────────────────────────
import { linePattern } from './definitions/time/line.js';
import { areaPattern } from './definitions/time/area.js';
import { smallMultiplesPattern } from './definitions/time/small-multiples.js';
import { sparklineGridPattern } from './definitions/time/sparkline-grid.js';
import { calendarHeatmapPattern } from './definitions/time/calendar-heatmap.js';
import { streamGraphPattern } from './definitions/time/stream-graph.js';
import { horizonChartPattern } from './definitions/time/horizon-chart.js';
// ─── RELATIONSHIP ────────────────────────────────────────────────────────────
import { scatterPattern } from './definitions/relationship/scatter.js';
import { connectedScatterPattern } from './definitions/relationship/connected-scatter.js';
import { parallelCoordinatesPattern } from './definitions/relationship/parallel-coordinates.js';
import { radarPattern } from './definitions/relationship/radar.js';
import { heatmapPattern } from './definitions/relationship/heatmap.js';
// ─── FLOW ────────────────────────────────────────────────────────────────────
import { sankeyPattern } from './definitions/flow/sankey.js';
import { alluvialPattern } from './definitions/flow/alluvial.js';
import { chordPattern } from './definitions/flow/chord.js';
import { funnelPattern } from './definitions/flow/funnel.js';
// ─── GEO ─────────────────────────────────────────────────────────────────────
import { choroplethPattern } from './definitions/geo/choropleth.js';
import { proportionalSymbolPattern } from './definitions/geo/proportional-symbol.js';
// ─── REGISTRY ────────────────────────────────────────────────────────────────
class PatternRegistry {
    patterns = new Map();
    /**
     * Register a pattern. Throws if a pattern with the same ID already exists.
     */
    register(pattern) {
        if (this.patterns.has(pattern.id)) {
            throw new Error(`Pattern "${pattern.id}" is already registered.`);
        }
        this.patterns.set(pattern.id, pattern);
    }
    /**
     * Get a pattern by its unique ID.
     */
    get(id) {
        return this.patterns.get(id);
    }
    /**
     * Get all registered patterns.
     */
    getAll() {
        return Array.from(this.patterns.values());
    }
    /**
     * Get all patterns in a specific category.
     */
    getByCategory(category) {
        return this.getAll().filter((p) => p.category === category);
    }
    /**
     * Get all available categories with their pattern counts.
     */
    getCategories() {
        const categories = new Map();
        for (const pattern of this.patterns.values()) {
            const existing = categories.get(pattern.category) ?? [];
            existing.push(pattern.id);
            categories.set(pattern.category, existing);
        }
        return Array.from(categories.entries()).map(([category, patterns]) => ({
            category,
            count: patterns.length,
            patterns,
        }));
    }
    /**
     * Get patterns that are compatible with the given data requirements.
     * This is a structural check — it verifies that the data CAN work
     * with the pattern, not whether it SHOULD.
     */
    getCompatible(opts) {
        return this.getAll().filter((pattern) => {
            const req = pattern.dataRequirements;
            return isCompatible(req, opts);
        });
    }
    /**
     * Get a summary of all patterns suitable for external listing.
     */
    listPatterns() {
        return this.getAll().map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description,
            bestFor: p.bestFor,
            dataRequirements: p.dataRequirements,
        }));
    }
    /**
     * Total number of registered patterns.
     */
    get size() {
        return this.patterns.size;
    }
}
/**
 * Check whether data characteristics meet a pattern's requirements.
 */
function isCompatible(req, opts) {
    if (req.minRows !== undefined && opts.rowCount < req.minRows)
        return false;
    if (req.maxRows !== undefined && opts.rowCount > req.maxRows * 2)
        return false; // Soft limit: allow 2x over
    if (req.requiresTimeSeries && !opts.hasTimeSeries && opts.dateColumnCount === 0)
        return false;
    if (req.requiresHierarchy && !opts.hasHierarchy)
        return false;
    if (req.requiredColumns) {
        for (const colReq of req.requiredColumns) {
            let available = 0;
            switch (colReq.type) {
                case 'numeric':
                    available = opts.numericColumnCount;
                    break;
                case 'categorical':
                    available = opts.categoricalColumnCount;
                    break;
                case 'date':
                    available = opts.dateColumnCount;
                    break;
                default:
                    available = opts.categoricalColumnCount + opts.numericColumnCount;
            }
            if (available < colReq.count)
                return false;
        }
    }
    return true;
}
// ─── SINGLETON INSTANCE ──────────────────────────────────────────────────────
/**
 * The global pattern registry. Populated with all built-in patterns on import.
 */
export const registry = new PatternRegistry();
// Register all built-in patterns
const ALL_PATTERNS = [
    // Comparison
    barPattern,
    divergingBarPattern,
    slopeChartPattern,
    connectedDotPlotPattern,
    bumpChartPattern,
    lollipopPattern,
    bulletPattern,
    groupedBarPattern,
    waterfallPattern,
    // Distribution
    histogramPattern,
    beeswarmPattern,
    violinPattern,
    ridgelinePattern,
    stripPlotPattern,
    boxPlotPattern,
    densityPlotPattern,
    // Composition
    stackedBarPattern,
    wafflePattern,
    treemapPattern,
    sunburstPattern,
    circlePackPattern,
    metricPattern,
    donutPattern,
    marimekkoPattern,
    iciclePattern,
    // Time
    linePattern,
    areaPattern,
    smallMultiplesPattern,
    sparklineGridPattern,
    calendarHeatmapPattern,
    streamGraphPattern,
    horizonChartPattern,
    // Relationship
    scatterPattern,
    connectedScatterPattern,
    parallelCoordinatesPattern,
    radarPattern,
    heatmapPattern,
    // Flow
    sankeyPattern,
    alluvialPattern,
    chordPattern,
    funnelPattern,
    // Geo
    choroplethPattern,
    proportionalSymbolPattern,
];
for (const pattern of ALL_PATTERNS) {
    registry.register(pattern);
}
//# sourceMappingURL=registry.js.map