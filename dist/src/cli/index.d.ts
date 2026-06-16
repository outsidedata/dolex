#!/usr/bin/env node
/**
 * Dolex CLI — the primary entry point (`bin.dolex`).
 *
 * Dispatches subcommands. Command modules are dynamically imported so that
 * commands which never touch a CSV avoid loading the SQLite/papaparse optional
 * deps, and so `dolex mcp` is the only path that loads (and starts) the MCP
 * server — whose `main()` runs on import.
 */
export {};
