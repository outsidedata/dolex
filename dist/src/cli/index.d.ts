#!/usr/bin/env node
/**
 * Dolex CLI — the primary entry point (`bin.dolex`).
 *
 * Dispatches subcommands. Command modules are dynamically imported so that
 * commands which never touch a CSV avoid loading the SQLite/papaparse optional
 * deps, and so the MCP server (whose `main()` runs on import) is loaded only
 * when actually serving — via the `dolex mcp` subcommand, or by a bare `dolex`
 * launched over piped stdio (how MCP clients spawn it).
 */
export {};
