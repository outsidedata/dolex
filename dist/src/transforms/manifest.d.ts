import type Database from 'better-sqlite3';
import type { CsvSourceConfig } from '../types.js';
import type { ManifestData } from './types.js';
import { TransformMetadata } from './metadata.js';
/** Resolve the manifest file path for a source config. */
export declare function resolveManifestPath(config: CsvSourceConfig): string;
/** Read and validate a manifest file. Returns null if not found or invalid. */
export declare function readManifest(manifestPath: string): ManifestData | null;
/** Write the manifest to disk from the metadata table. */
export declare function writeManifest(metadata: TransformMetadata, tables: string[], manifestPath: string): void;
/** Replay manifest transforms after CSV load. */
export declare function replayManifest(db: Database.Database, metadata: TransformMetadata, manifest: ManifestData, tableName: string): {
    replayed: string[];
    skipped: {
        column: string;
        reason: string;
    }[];
};
//# sourceMappingURL=manifest.d.ts.map