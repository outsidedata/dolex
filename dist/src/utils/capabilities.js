/**
 * Environment capability probe — the single source of truth for "what can Dolex do in THIS
 * install?". Shared by the `dolex deps` CLI command (human + --json) and the MCP `capabilities`
 * tool (an AI agent asks once, then drives within what's available instead of trying-and-crashing).
 *
 * Presence is resolved WITHOUT loading the package (no side effects); a missing optional package is
 * a fact to report, never a crash — the connectors themselves fail gracefully (importOptional).
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { OPTIONAL_FEATURES } from './optional-deps.js';
import { packagePath } from './package-root.js';
const require = createRequire(import.meta.url);
/** A package's version, resolved without loading it. `null` ⇒ not installed. */
function pkgVersion(spec) {
    try {
        return JSON.parse(readFileSync(require.resolve(`${spec}/package.json`), 'utf8')).version ?? null;
    }
    catch {
        return null;
    }
}
const PROBES = [
    { key: 'postgres', spec: 'pg', enables: 'Postgres data sources' },
    { key: 'mongodb', spec: 'mongodb', enables: 'MongoDB data sources' },
    { key: 'png', spec: 'playwright', enables: 'PNG / screenshot export' },
    { key: 'mcp', spec: '@modelcontextprotocol/sdk', enables: 'the MCP server (`dolex mcp`)' },
];
/** Probe the current environment for optional capabilities. Pure of side effects; never throws. */
export function probeCapabilities() {
    const coreOk = !!pkgVersion('better-sqlite3');
    const deps = PROBES.map((p) => {
        const version = pkgVersion(p.spec);
        return { package: p.spec, installed: !!version, version: version ?? undefined, enables: p.enables, install: version ? undefined : OPTIONAL_FEATURES[p.key].install };
    });
    const has = (spec) => deps.find((d) => d.package === spec).installed;
    let pyVersion;
    try {
        pyVersion = execFileSync('python3', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    }
    catch { /* absent */ }
    const python = { available: !!pyVersion, version: pyVersion, enables: 'data cleaning (clean_column / dolex clean)', install: pyVersion ? undefined : 'install python3 and put it on PATH' };
    let dolexVersion;
    try {
        dolexVersion = JSON.parse(readFileSync(packagePath('package.json'), 'utf8')).version;
    }
    catch { /* best-effort */ }
    return {
        dolexVersion, node: process.version, platform: process.platform, coreOk,
        sources: {
            csv: coreOk ? 'ready' : 'core missing — reinstall dolex',
            postgres: has('pg') ? 'ready' : 'needs: npm install pg',
            mongodb: has('mongodb') ? 'ready' : 'needs: npm install mongodb',
        },
        deps, python,
    };
}
