/**
 * `dolex visualize` — turn data into a chart.
 *
 * Data comes from a CSV path / registered source (optionally sliced with
 * `--sql`), an inline JSON array (`--data file.json`), or stdin (`-` /
 * `--stdin`). The chart is matched to the shape of the data; `--pattern` forces a specific one.
 */
export declare function visualizeCommand(argv: string[]): Promise<number>;
