/**
 * `dolex visualize` — turn data into a chart.
 *
 * Data comes from a CSV path / registered source (optionally sliced with
 * `--sql`), an inline JSON array (`--data file.json`), or stdin (`-` /
 * `--stdin`). The pattern is auto-selected unless `--pattern` forces one.
 */
export declare function visualizeCommand(argv: string[]): Promise<number>;
