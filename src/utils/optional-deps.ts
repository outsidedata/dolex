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
export const OPTIONAL_FEATURES = {
  png: {
    feature: 'PNG / screenshot export',
    install: 'npm install playwright && npx playwright install chromium',
  },
  mcp: {
    feature: 'the MCP server (`dolex mcp`)',
    install: 'npm install @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps',
  },
} as const satisfies Record<string, OptionalFeature>;

export type OptionalFeatureKey = keyof typeof OPTIONAL_FEATURES;

/** Build the standard, agent-and-human friendly "install this" message. */
export function missingDependencyMessage(key: OptionalFeatureKey): string {
  const f = OPTIONAL_FEATURES[key];
  return `${f.feature} needs an optional dependency that isn't installed.\n  Install it:  ${f.install}`;
}

/**
 * Marker error so callers can distinguish a missing optional dependency from a
 * genuine runtime error and surface `.install` directly.
 */
export class MissingOptionalDependencyError extends Error {
  readonly feature: string;
  readonly install: string;
  constructor(key: OptionalFeatureKey) {
    super(missingDependencyMessage(key));
    this.name = 'MissingOptionalDependencyError';
    this.feature = OPTIONAL_FEATURES[key].feature;
    this.install = OPTIONAL_FEATURES[key].install;
  }
}

/** True when an error is Node's "module/package not found" for an import. */
export function isModuleNotFound(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /Cannot find (module|package)/i.test(msg);
}

/**
 * Dynamically import an optional package, converting a missing-package failure
 * into a friendly {@link MissingOptionalDependencyError}. Any other error
 * (e.g. the package is present but throws on load) propagates unchanged.
 */
export async function importOptional<T = unknown>(
  specifier: string,
  key: OptionalFeatureKey,
): Promise<T> {
  try {
    return (await import(specifier)) as T;
  } catch (e) {
    if (isModuleNotFound(e)) throw new MissingOptionalDependencyError(key);
    throw e;
  }
}
