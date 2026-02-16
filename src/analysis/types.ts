import type { DslQuery } from '../types.js';

export type ColumnRole = 'measure' | 'dimension' | 'time' | 'hierarchy' | 'id' | 'text';

export interface ClassifiedColumn {
  name: string;
  originalType: 'numeric' | 'categorical' | 'date' | 'id' | 'text';
  role: ColumnRole;
  uniqueCount: number;
  nullCount: number;
  totalCount: number;
  stats?: { min: number; max: number; mean: number; median: number; stddev: number; p25: number; p75: number };
  topValues?: { value: string; count: number }[];
}

export type AnalysisCategory = 'trend' | 'comparison' | 'distribution' | 'composition' | 'relationship' | 'ranking';

export interface AnalysisStep {
  title: string;
  question: string;
  intent: string;
  query: DslQuery;
  table: string;
  suggestedPatterns: string[];
  rationale: string;
  category: AnalysisCategory;
}

export interface AnalysisPlan {
  summary: string;
  steps: AnalysisStep[];
}
