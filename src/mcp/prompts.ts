import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'explore-data',
    {
      title: 'Explore a Dataset',
      description: 'Drop a data file and get automatic analysis — like having a data analyst at your desk',
      argsSchema: {
        path: z.string().describe('Path to a CSV file or directory of CSV files'),
      },
    },
    async ({ path }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            `I want to explore a dataset. The file path is: ${path}`,
            '',
            'Please:',
            '1. Load it using load_csv',
            '2. Call analyze_data to get an automatic analysis plan',
            '3. For each step in the plan, call visualize_data with the provided query and use one of the suggested patterns',
            '4. After each chart, write a 2-3 sentence finding explaining what the data reveals — be specific about numbers, trends, and outliers',
            '5. End with a "Key Takeaways" summary',
            '',
            'Use the full Dolex pattern library — the analysis plan suggests patterns like violin plots, sparkline grids, treemaps, and beeswarms. Use them instead of defaulting to bar charts.',
          ].join('\n'),
        },
      }],
    }),
  );
}
