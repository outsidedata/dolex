/**
 * Pattern-selection callback — bridges a VisualizeInput to a VisualizeOutput
 * by running the core `selectPattern` selector and mapping pattern objects to
 * their ids.
 *
 * Shared by both frontends (the MCP server and the CLI) so the bridging logic
 * lives in exactly one place.
 */
import type { VisualizeInput, VisualizeOutput } from '../types.js';
export declare function selectPatternsCallback(input: VisualizeInput): VisualizeOutput;
