/**
 * Shared types for Dolex - Visualization MCP + Query Engine
 */
export interface DataColumn {
    name: string;
    type: 'numeric' | 'categorical' | 'date' | 'id' | 'text';
    sampleValues: string[];
    uniqueCount: number;
    nullCount: number;
    totalCount: number;
    /** Numeric columns: summary statistics */
    stats?: {
        min: number;
        max: number;
        mean: number;
        median: number;
        stddev: number;
        p25: number;
        p75: number;
    };
    /** Categorical/date columns: most frequent values with counts */
    topValues?: {
        value: string;
        count: number;
    }[];
}
export interface DataTable {
    name: string;
    columns: DataColumn[];
    rowCount: number;
}
/** Enhanced table profile returned by load_csv — includes sample rows */
export interface DataProfiledTable extends DataTable {
    /** 5 representative sample rows picked for variety */
    sampleRows: Record<string, any>[];
}
export interface ForeignKey {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
}
export interface DataSchema {
    tables: DataTable[];
    foreignKeys: ForeignKey[];
    source: DataSourceInfo;
}
export type DataSourceType = 'csv';
export interface DataSourceInfo {
    id: string;
    type: DataSourceType;
    name: string;
    config: DataSourceConfig;
}
export type DataSourceConfig = CsvSourceConfig;
export interface CsvSourceConfig {
    type: 'csv';
    /** Directory containing CSV files, or path to a single CSV */
    path: string;
}
/** Aggregate function for the query DSL */
export type DslAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct' | 'median' | 'p25' | 'p75' | 'stddev' | 'percentile';
/** An aggregate select field */
export interface DslAggregateField {
    field: string;
    aggregate: DslAggregate;
    as: string;
    /** For aggregate: 'percentile' — the percentile value (0–1), e.g. 0.95 for p95 */
    percentile?: number;
}
/** Window function name */
export type DslWindowFunction = 'lag' | 'lead' | 'rank' | 'dense_rank' | 'row_number' | 'running_sum' | 'running_avg' | 'pct_of_total';
/** A window function select field — references base query output columns */
export interface DslWindowField {
    window: DslWindowFunction;
    /** Field to operate on (required for lag, lead, running_sum, running_avg, pct_of_total) */
    field?: string;
    /** Output column name */
    as: string;
    /** Partition columns (default: whole result set) */
    partitionBy?: string[];
    /** Sort order within the window (required for lag, lead, rank, dense_rank, row_number, running_sum, running_avg) */
    orderBy?: DslOrderBy[];
    /** Offset for lag/lead (default: 1) */
    offset?: number;
    /** Default value for lag/lead when offset is out of range */
    default?: any;
}
/** A field selection — plain string for pass-through, object for aggregation or window */
export type DslSelectField = string | DslAggregateField | DslWindowField;
/** Type guard: check if a select field is an aggregate field */
export declare function isDslAggregateField(field: DslSelectField): field is DslAggregateField;
/** Type guard: check if a select field is a window function field */
export declare function isDslWindowField(field: DslSelectField): field is DslWindowField;
/** A group-by field — plain string or time-bucketed */
export type DslGroupByField = string | {
    field: string;
    bucket: 'day' | 'week' | 'month' | 'quarter' | 'year';
};
/** Filter operator */
export type DslFilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in' | 'between' | 'is_null' | 'is_not_null';
/** A filter condition */
export interface DslFilter {
    field: string;
    op: DslFilterOp;
    value?: any;
}
/** Sort directive */
export interface DslOrderBy {
    field: string;
    direction: 'asc' | 'desc';
}
/** A join clause — attaches another table in the same source */
export interface DslJoin {
    /** Table name to join */
    table: string;
    /** Join key mapping */
    on: {
        /** Field from the left/current table (supports table.field dot notation) */
        left: string;
        /** Field from the joined table */
        right: string;
    };
    /** Join type. Default: 'left' */
    type?: 'inner' | 'left';
}
/** The full declarative query */
export interface DslQuery {
    join?: DslJoin[];
    select: DslSelectField[];
    groupBy?: DslGroupByField[];
    filter?: DslFilter[];
    having?: DslFilter[];
    orderBy?: DslOrderBy[];
    limit?: number;
}
/** Source-based input for visualize (alternative to inline data) */
export interface SourceDataRef {
    sourceId: string;
    table: string;
    query: DslQuery;
}
export type PatternCategory = 'comparison' | 'distribution' | 'composition' | 'time' | 'relationship' | 'flow' | 'geo';
export interface DataRequirements {
    /** Minimum number of data rows */
    minRows?: number;
    /** Maximum number of data rows (beyond this, consider alternatives) */
    maxRows?: number;
    /** Required column types */
    requiredColumns?: {
        type: DataColumn['type'];
        count: number;
        description: string;
    }[];
    /** Minimum number of categories */
    minCategories?: number;
    /** Maximum recommended categories */
    maxCategories?: number;
    /** Whether time-series data is required */
    requiresTimeSeries?: boolean;
    /** Whether hierarchical data is needed */
    requiresHierarchy?: boolean;
}
/** Selection rule: when should this pattern be chosen over others */
export interface SelectionRule {
    /** Human-readable condition description */
    condition: string;
    /** Priority weight (higher = preferred when rule matches) */
    weight: number;
    /** Function that evaluates whether this rule matches the data shape */
    matches: (ctx: PatternMatchContext) => boolean;
}
export interface PatternMatchContext {
    data: Record<string, any>[];
    columns: DataColumn[];
    intent: string;
    dataShape: {
        rowCount: number;
        categoryCount: number;
        seriesCount: number;
        numericColumnCount: number;
        categoricalColumnCount: number;
        dateColumnCount: number;
        hasTimeSeries: boolean;
        hasHierarchy: boolean;
        hasNegativeValues: boolean;
        valueRange: {
            min: number;
            max: number;
        };
    };
}
export interface VisualizationPattern {
    id: string;
    name: string;
    category: PatternCategory;
    description: string;
    /** When to use this instead of the obvious choice */
    bestFor: string;
    /** What NOT to use this for */
    notFor?: string;
    /** Data shape requirements */
    dataRequirements: DataRequirements;
    /** Rules for when to select this pattern */
    selectionRules: SelectionRule[];
    /** Generate the output spec from data */
    generateSpec: (data: Record<string, any>[], columns: string[], options?: Record<string, any>) => VisualizationSpec;
}
export interface VisualizationSpec {
    pattern: string;
    title: string;
    data: Record<string, any>[];
    encoding: {
        x?: AxisEncoding;
        y?: AxisEncoding;
        color?: ColorEncoding;
        size?: SizeEncoding;
        [key: string]: any;
    };
    /** Pattern-specific configuration */
    config: Record<string, any>;
}
export interface AxisEncoding {
    field: string;
    type: 'quantitative' | 'nominal' | 'ordinal' | 'temporal';
    title?: string;
    sort?: 'ascending' | 'descending' | null;
    format?: string;
}
export type ColorPaletteName = 'categorical' | 'blue' | 'green' | 'purple' | 'warm' | 'blueRed' | 'greenPurple' | 'tealOrange' | 'redGreen' | 'traffic-light' | 'profit-loss' | 'temperature';
export interface ColorEncoding {
    field?: string;
    type?: 'nominal' | 'ordinal' | 'quantitative';
    scale?: {
        domain?: any[];
        range?: string[];
    };
    title?: string;
    /** Named palette to use for color mapping (overrides default palette) */
    palette?: ColorPaletteName;
    /** Highlight mode: specific values get color, others are muted gray */
    highlight?: {
        /** Values to highlight (all others become muted) */
        values: any[];
        /** Color(s) for highlighted values. Single color or array matching values length. */
        color?: string | string[];
        /** Gray color for non-highlighted items (default: #6b7280) */
        mutedColor?: string;
        /** Opacity for muted items (default: 1.0, can reduce for stronger deemphasis) */
        mutedOpacity?: number;
    };
}
export interface SizeEncoding {
    field: string;
    type: 'quantitative';
    title?: string;
    range?: [number, number];
}
export interface VisualizationRecommendation {
    pattern: VisualizationPattern;
    spec: VisualizationSpec;
    score: number;
    reasoning: string;
}
export type GeoLevel = 'country' | 'subdivision';
export interface VisualizeInput {
    data: Record<string, any>[];
    intent: string;
    columns?: DataColumn[];
    dataShapeHints?: Partial<PatternMatchContext['dataShape']>;
    forcePattern?: string;
    geoLevel?: GeoLevel;
    geoRegion?: string;
}
export interface VisualizeOutput {
    recommended: {
        pattern: string;
        spec: VisualizationSpec;
        reasoning: string;
    };
    alternatives: {
        pattern: string;
        spec: VisualizationSpec;
        reasoning: string;
    }[];
}
export interface RefineInput {
    specId: string;
    sort?: {
        field?: string;
        direction: 'asc' | 'desc';
    } | null;
    limit?: number;
    filter?: Array<{
        field: string;
        op?: string;
        values: (string | number)[];
    }>;
    flip?: boolean;
    title?: string;
    subtitle?: string;
    xLabel?: string;
    yLabel?: string;
    palette?: string;
    highlight?: {
        values: (string | number)[];
        color?: string | string[];
        mutedColor?: string;
        mutedOpacity?: number;
    } | null;
    colorField?: string;
    flowColorBy?: 'source' | 'target';
    format?: string;
    switchPattern?: string;
    removeTable?: boolean;
    layout?: 'rows' | 'columns';
    hideColumns?: string[];
}
export interface RefineOutput {
    spec: VisualizationSpec | CompoundVisualizationSpec;
    changes: string[];
    notes: string[];
}
/** A compound visualization: multiple linked views of the same data. */
export interface CompoundVisualizationSpec {
    /** Discriminator — renderers check this to decide how to render */
    compound: true;
    /** Overall title for the compound visualization */
    title: string;
    /** Shared data — all views reference this instead of embedding their own copy */
    data: Record<string, any>[];
    /** The views that make up this compound visualization */
    views: CompoundView[];
    /** How views are arranged */
    layout: CompoundLayout;
    /** Interaction links between views */
    interactions: Interaction[];
}
/** A single view within a compound visualization */
export interface CompoundView {
    /** Unique ID within this compound spec */
    id: string;
    /** What kind of view this is */
    type: 'chart' | 'table';
    /** For chart views: a VisualizationSpec (minus data, which comes from parent) */
    chart?: Omit<VisualizationSpec, 'data'>;
    /** For table views: table-specific configuration */
    table?: TableViewSpec;
}
/** Configuration for a data table view */
export interface TableViewSpec {
    /** Which columns to display, in order. Omit to show all. */
    columns?: TableColumn[];
    /** Default sort */
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    /** Maximum rows to show before scrolling */
    pageSize?: number;
}
/** A column definition within a table view */
export interface TableColumn {
    /** Field name from the data */
    field: string;
    /** Display header (defaults to field name) */
    title?: string;
    /** Number format string (e.g., ',.0f' for integers, '$,.2f' for currency) */
    format?: string;
    /** Column width hint */
    width?: 'narrow' | 'medium' | 'wide' | number;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
}
/** How views are arranged in a compound visualization */
export interface CompoundLayout {
    /** Arrangement of views */
    type: 'rows' | 'columns';
    /** Relative sizes of each view (maps to CSS fr units) */
    sizes?: number[];
    /** Gap between views in pixels */
    gap?: number;
}
/** An interaction link between views */
export interface Interaction {
    /** What kind of linking */
    type: 'highlight';
    /** Which data field to link on */
    field: string;
    /** Which views participate (by ID). Omit to include all views. */
    views?: string[];
}
/** Type guard: check if a spec is a CompoundVisualizationSpec */
export declare function isCompoundSpec(spec: VisualizationSpec | CompoundVisualizationSpec): spec is CompoundVisualizationSpec;
/** A dashboard: multiple views with independent queries, global filters, and cross-filtering. */
export interface DashboardSpec {
    /** Discriminator — renderers check this to decide how to render */
    dashboard: true;
    /** Stable ID for persistence across conversation turns */
    id: string;
    /** Dashboard title */
    title: string;
    /** Optional description */
    description?: string;
    /** Single source for v1 */
    sourceId: string;
    /** Base table within the source */
    table: string;
    /** The views that make up this dashboard */
    views: DashboardViewSpec[];
    /** Global filter controls */
    globalFilters?: DashboardFilter[];
    /** Grid layout configuration */
    layout: DashboardLayout;
    /** Interaction links between views */
    interactions?: DashboardInteraction[];
    /** Color theme */
    theme?: 'dark' | 'light';
}
/** A single view within a dashboard — each has its own query */
export interface DashboardViewSpec {
    /** Stable, user-referenceable ID */
    id: string;
    /** View title */
    title: string;
    /** Intent string for pattern selection */
    intent: string;
    /** Per-view DSL query */
    query: DslQuery;
    /** Optional pattern override (auto-select if omitted) */
    pattern?: string;
    /** Color preferences for this view */
    colorPreferences?: {
        palette?: ColorPaletteName;
        highlight?: {
            values: any[];
            color?: string | string[];
            mutedColor?: string;
            mutedOpacity?: number;
        };
        colorField?: string;
    };
    /** Pattern-specific configuration overrides */
    config?: Record<string, any>;
}
/** A global filter control on the dashboard */
export interface DashboardFilter {
    /** Field name to filter on */
    field: string;
    /** Display label (defaults to field name) */
    label?: string;
    /** Filter control type */
    type: 'select' | 'multi-select' | 'range' | 'date-range';
    /** Allowed values (populated from data at render time if omitted) */
    values?: any[];
    /** Current filter state */
    currentValue?: any;
}
/** Grid layout configuration for a dashboard */
export interface DashboardLayout {
    /** Number of grid columns (1-4) */
    columns: number;
    /** Per-view size overrides: colSpan and rowSpan */
    viewSizes?: Record<string, {
        colSpan?: number;
        rowSpan?: number;
    }>;
}
/** An interaction link between dashboard views */
export interface DashboardInteraction {
    /** Interaction type */
    type: 'crossfilter' | 'highlight';
    /** Which data field to link on */
    field: string;
    /** Participating view IDs (all views if omitted) */
    views?: string[];
}
/** Type guard: check if a spec is a DashboardSpec */
export declare function isDashboardSpec(spec: VisualizationSpec | CompoundVisualizationSpec | DashboardSpec): spec is DashboardSpec;
//# sourceMappingURL=types.d.ts.map