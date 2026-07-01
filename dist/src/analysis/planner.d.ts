import type { DataColumn } from '../types.js';
import type { AnalysisPlan } from './types.js';
import { type PlannerDialect } from './rules.js';
export declare function buildAnalysisPlan(columns: DataColumn[], table: string, sourceName: string, maxSteps?: number, dialect?: PlannerDialect): AnalysisPlan;
