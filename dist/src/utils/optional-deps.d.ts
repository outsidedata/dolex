/**
 * Graceful handling for OPTIONAL dependencies — features whose npm package is
 * not installed by default (to keep the base install small).
 *
 * When a user, OR an AI agent over MCP, invokes such a feature and its package
 * is missing, we must NOT crash with a cryptic `ERR_MODULE_NOT_FOUND`. Instead
 * we detect the missing package and surface a single, actionable message that
 * names the feature and the exact install command. The same message is printed
 * on the CLI (for the human) and returned through the MCP tool result (for the
 * agent) — so the agent can relay it to the user or trigger the install itself.
 */
export interface OptionalFeature {
    /** Human-facing feature name, e.g. "PNG export". */
    feature: string;
    /** The exact command(s) that enable it. */
    install: string;
}
/** The features that depend on packages outside the default install. */
export declare const OPTIONAL_FEATURES: {
    readonly png: {
        readonly feature: "PNG / screenshot export";
        readonly install: "npm install playwright && npx playwright install chromium";
    };
    readonly mcp: {
        readonly feature: "the MCP server (`dolex mcp`)";
        readonly install: "npm install @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps";
    };
    readonly postgres: {
        readonly feature: "Postgres data sources";
        readonly install: "npm install pg";
    };
    readonly mongodb: {
        readonly feature: "MongoDB data sources";
        readonly install: "npm install mongodb";
    };
};
export type OptionalFeatureKey = keyof typeof OPTIONAL_FEATURES;
/** Build the standard, agent-and-human friendly "install this" message. */
export declare function missingDependencyMessage(key: OptionalFeatureKey): string;
/**
 * Marker error so callers can distinguish a missing optional dependency from a
 * genuine runtime error and surface `.install` directly.
 */
export declare class MissingOptionalDependencyError extends Error {
    readonly feature: string;
    readonly install: string;
    constructor(key: OptionalFeatureKey);
}
/** True when an error is Node's "module/package not found" for an import. */
export declare function isModuleNotFound(e: unknown): boolean;
/**
 * Dynamically import an optional package, converting a missing-package failure
 * into a friendly {@link MissingOptionalDependencyError}. Any other error
 * (e.g. the package is present but throws on load) propagates unchanged.
 */
export declare function importOptional<T = unknown>(specifier: string, key: OptionalFeatureKey): Promise<T>;
