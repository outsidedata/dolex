import { z } from 'zod';
export function registerPrompts(server) {
    server.registerPrompt('explore-data', {
        title: 'Explore a Dataset',
        description: 'Drop a data file and get automatic analysis — like having a data analyst at your desk',
        argsSchema: {
            path: z.string().describe('File path (CSV, SQLite) or connection string (Postgres, MySQL)'),
        },
    }, async ({ path }) => ({
        messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: [
                        `I want to explore a dataset. The file path is: ${path}`,
                        '',
                        'Please:',
                        '1. Connect it as a data source using add_source',
                        '2. Call analyze_source to get an automatic analysis plan',
                        '3. For each step in the plan, call visualize_from_source with the provided query and use one of the suggested patterns',
                        '4. After each chart, write a 2-3 sentence finding explaining what the data reveals — be specific about numbers, trends, and outliers',
                        '5. End with a "Key Takeaways" summary',
                        '',
                        'Use the full Dolex pattern library — the analysis plan suggests patterns like violin plots, sparkline grids, treemaps, and beeswarms. Use them instead of defaulting to bar charts.',
                    ].join('\n'),
                },
            }],
    }));
}
//# sourceMappingURL=prompts.js.map