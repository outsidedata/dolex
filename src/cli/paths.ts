/**
 * Resolves the Dolex state directory (specs, charts, source registry).
 *
 * Defaults to `~/.dolex`. Set `DOLEX_HOME` to relocate it — useful for tests,
 * CI, sandboxes, or isolating concurrent runs.
 */

import { homedir } from 'os';
import { join } from 'path';

export function dolexHome(): string {
  const override = process.env.DOLEX_HOME;
  return override && override.trim().length > 0 ? override : join(homedir(), '.dolex');
}
