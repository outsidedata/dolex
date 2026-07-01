/**
 * MCP Tool: capabilities — what can Dolex do in THIS environment.
 *
 * An AI assistant calls this once to discover which source types are ready (CSV always; Postgres /
 * MongoDB only if their optional driver is installed) and what to run to enable the rest, so it can
 * drive Dolex within the available capabilities instead of attempting a source and hitting an error.
 * Pairs with the connectors' graceful failure: an unavailable source, if attempted anyway, returns
 * the same actionable "npm install …" message rather than a crash.
 */
import { jsonResponse } from './shared.js';
import { probeCapabilities } from '../../utils/capabilities.js';
export function handleCapabilities() {
    return async () => jsonResponse(probeCapabilities());
}
