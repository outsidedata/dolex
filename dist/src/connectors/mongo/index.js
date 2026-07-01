import { registerDerivedColumn } from '../types.js';
import { importOptional } from '../../utils/optional-deps.js';
/** Lazily load the mongodb driver so the base install never requires it — a missing package
 *  becomes a friendly "npm install mongodb", surfaced only when a Mongo source is actually used. */
const loadMongo = () => importOptional('mongodb', 'mongodb');
const SAMPLE_DOCS = 200; // docs sampled to discover the key universe + candidate types
function uriFor(cfg) {
    if (cfg.uri)
        return cfg.uri;
    return `mongodb://${cfg.host || 'localhost'}:${cfg.port || 27017}`;
}
const NUMERIC = (v) => typeof v === 'number';
/** Duck-type a BSON ObjectId without importing the driver class (an ObjectId has toHexString()). */
const isObjectId = (v) => v != null && typeof v === 'object' && typeof v.toHexString === 'function';
/** Coerce a BSON value to a JS-friendly value for consumer parity (charts/markdown/JSON). */
function jsValue(v) {
    if (v == null)
        return v;
    if (isObjectId(v))
        return v.toString();
    if (v instanceof Date)
        return v.toISOString();
    return v;
}
/** Candidate type from a sampled value (refined by distinct/total in classify). */
function candidateType(v) {
    if (typeof v === 'number')
        return 'numeric';
    if (v instanceof Date)
        return 'date';
    if (isObjectId(v))
        return 'id';
    return 'text'; // string/bool/other → text, refined to categorical by cardinality
}
function classify(cand, name, distinct, total) {
    if (name === '_id')
        return 'id';
    if (cand === 'numeric') {
        if (/(^|_)id$/i.test(name) && total > 0 && distinct >= total * 0.9)
            return 'id';
        return 'numeric';
    }
    if (cand === 'date' || cand === 'id')
        return cand;
    // text-ish: low cardinality ⇒ categorical
    if (total > 0 && distinct <= Math.min(200, Math.max(50, total * 0.5)))
        return 'categorical';
    return 'text';
}
async function profileCollection(db, name) {
    const coll = db.collection(name);
    const total = await coll.countDocuments();
    // Phase 1 — sample docs to discover the key universe + a candidate type per key.
    const sampled = await coll.find({}, { limit: SAMPLE_DOCS }).toArray();
    const keys = [];
    const candByKey = new Map();
    const sampleValsByKey = new Map();
    for (const doc of sampled) {
        for (const k of Object.keys(doc)) {
            if (!candByKey.has(k)) {
                keys.push(k);
                candByKey.set(k, candidateType(doc[k]));
                sampleValsByKey.set(k, []);
            }
            const sv = sampleValsByKey.get(k);
            const v = doc[k];
            if (v != null && sv.length < 5)
                sv.push(String(jsValue(v)));
        }
    }
    if (total === 0 || keys.length === 0)
        return { name, columns: [], rowCount: total };
    // Phase 2 — ONE $facet: per-key non-null + distinct counts, numeric stats, categorical top-values.
    const facet = {};
    for (const k of keys) {
        const cand = candByKey.get(k);
        facet[`${k}__nn`] = [{ $match: { [k]: { $ne: null, $exists: true } } }, { $count: 'n' }];
        facet[`${k}__dc`] = [{ $group: { _id: `$${k}` } }, { $count: 'n' }];
        if (cand === 'numeric') {
            // Mongo 5.0 has no $percentile; sort + $push then pick positional elements server-side
            // (the array stays inside the sub-pipeline — the facet only stores the scalar result).
            facet[`${k}__st`] = [
                { $match: { [k]: { $type: 'number' } } },
                { $sort: { [k]: 1 } },
                { $group: { _id: null, vals: { $push: `$${k}` }, min: { $min: `$${k}` }, max: { $max: `$${k}` }, avg: { $avg: `$${k}` }, sd: { $stdDevPop: `$${k}` }, n: { $sum: 1 } } },
                { $project: {
                        min: 1, max: 1, avg: 1, sd: 1,
                        median: { $arrayElemAt: ['$vals', { $floor: { $multiply: ['$n', 0.5] } }] },
                        p25: { $arrayElemAt: ['$vals', { $floor: { $multiply: ['$n', 0.25] } }] },
                        p75: { $arrayElemAt: ['$vals', { $floor: { $multiply: ['$n', 0.75] } }] },
                    } },
            ];
        }
        else if (k !== '_id') {
            facet[`${k}__tv`] = [{ $match: { [k]: { $ne: null } } }, { $sortByCount: `$${k}` }, { $limit: 10 }];
        }
    }
    const [f] = await coll.aggregate([{ $facet: facet }], { allowDiskUse: true }).toArray();
    const one = (arr) => (arr && arr.length ? arr[0] : undefined);
    const columns = keys.map((k) => {
        const nonNull = Number(one(f[`${k}__nn`])?.n ?? 0);
        const distinct = Number(one(f[`${k}__dc`])?.n ?? 0);
        const type = classify(candByKey.get(k), k, distinct, total);
        let stats;
        let topValues;
        if (type === 'numeric') {
            const s = one(f[`${k}__st`]);
            if (s)
                stats = { min: s.min, max: s.max, mean: s.avg, median: s.median, stddev: s.sd ?? 0, p25: s.p25, p75: s.p75 };
        }
        else if (k !== '_id') {
            const tv = f[`${k}__tv`];
            if (tv?.length)
                topValues = tv.map((r) => ({ value: String(jsValue(r._id)), count: r.count }));
        }
        return {
            name: k, type, sampleValues: sampleValsByKey.get(k) ?? [],
            uniqueCount: distinct, nullCount: total - nonNull, totalCount: total,
            layer: 'source', stats, topValues,
        };
    });
    return { name, columns, rowCount: total };
}
const tryParseJson = (q) => { try {
    return JSON.parse(q);
}
catch {
    return undefined;
} };
/** Append the closers for any unclosed { or [ (string-aware) — repairs a common caller near-miss:
 *  a correct pipeline whose outer envelope is missing its trailing brace. */
function balanceBrackets(q) {
    const stack = [];
    let inStr = false, esc = false;
    for (const ch of q) {
        if (esc) {
            esc = false;
            continue;
        }
        if (ch === '\\') {
            esc = true;
            continue;
        }
        if (ch === '"') {
            inStr = !inStr;
            continue;
        }
        if (inStr)
            continue;
        if (ch === '{' || ch === '[')
            stack.push(ch);
        else if (ch === '}' || ch === ']')
            stack.pop();
    }
    let out = q;
    for (let i = stack.length - 1; i >= 0; i--)
        out += stack[i] === '{' ? '}' : ']';
    return out;
}
/**
 * TOLERANT seam parse. Callers reliably produce correct aggregation STAGES but fumble the
 * hand-written JSON ENVELOPE, so accept, in order: the full {"collection","pipeline":[…]}; a BARE
 * pipeline array [<stages>] (wrapped with the primary collection); or an envelope missing its
 * trailing brace(s), repaired by balancing. Empty/garbage is rejected with an actionable message —
 * never silently "repaired" into a fake pipeline.
 */
export function parseSeam(query, defaultCollection) {
    const raw = (query ?? '').trim();
    const parsed = tryParseJson(raw) ?? tryParseJson(balanceBrackets(raw));
    if (Array.isArray(parsed) && defaultCollection)
        return { collection: defaultCollection, pipeline: parsed };
    if (parsed && typeof parsed.collection === 'string' && Array.isArray(parsed.pipeline))
        return { collection: parsed.collection, pipeline: parsed.pipeline };
    if (parsed && Array.isArray(parsed.pipeline) && defaultCollection)
        return { collection: defaultCollection, pipeline: parsed.pipeline };
    throw new Error('Mongo query must be a JSON aggregation pipeline: a bare array [<stages>], or {"collection":"<name>","pipeline":[<stages>]}');
}
class MongoConnectedSource {
    id;
    name;
    client;
    db;
    schema;
    type = 'mongodb';
    /** collection → derived fields materialized this session (a $set expr each), in creation order. */
    derived = new Map();
    constructor(id, name, client, db, schema) {
        this.id = id;
        this.name = name;
        this.client = client;
        this.db = db;
        this.schema = schema;
    }
    async getSchema() {
        return this.schema;
    }
    async executeQuery(query) {
        try {
            const { collection, pipeline } = parseSeam(query, this.schema.tables[0]?.name);
            // Prepend a $set for each session-derived field so every aggregation sees it transparently,
            // without ever writing the base collection.
            const derived = this.derived.get(collection) ?? [];
            const setStage = derived.length ? [{ $set: Object.fromEntries(derived.map((d) => [d.field, d.expr])) }] : [];
            const docs = await this.db.collection(collection).aggregate([...setStage, ...pipeline]).toArray();
            // Columns: union of keys across result docs, in first-seen order (docs are ragged).
            const seen = new Set();
            const columns = [];
            for (const d of docs)
                for (const k of Object.keys(d))
                    if (!seen.has(k)) {
                        seen.add(k);
                        columns.push(k);
                    }
            const rows = docs.map((d) => {
                const out = {};
                for (const k of columns)
                    out[k] = jsValue(d[k]);
                return out;
            });
            return { columns, rows };
        }
        catch (err) {
            return { columns: [], rows: [{ error: err.message }] };
        }
    }
    async getSampleRows(collectionName, count = 5) {
        const total = this.schema.tables.find((t) => t.name === collectionName)?.rowCount ?? 0;
        if (total === 0)
            return [];
        const docs = total <= count
            ? await this.db.collection(collectionName).find({}, { limit: count }).toArray()
            : await this.db.collection(collectionName).aggregate([{ $sample: { size: count } }]).toArray();
        return docs.map((d) => {
            const out = {};
            for (const k of Object.keys(d))
                out[k] = jsValue(d[k]);
            return out;
        });
    }
    // getDatabase intentionally omitted → the derivation seam no longer keys on a raw db handle.
    /**
     * Mongo derives a FIELD via a `$set` aggregation expression prepended to every incoming pipeline
     * (see executeQuery). No sidecar, no write to the base collection — the derived field is computed
     * server-side on read. `materialization:'computed-set'` reflects that.
     */
    derivationCapabilities() {
        return { canDerive: true, materialization: 'computed-set', rowKey: '_id', serverSideQueryable: true };
    }
    /** Register a derived field: `expr` is a JSON Mongo aggregation expression (e.g. a $cond). It is
     *  prepended as a $set to every subsequent aggregation; the base collection is never written. */
    async applyDerivation(table, column, expr) {
        let parsed;
        try {
            parsed = JSON.parse(expr);
        }
        catch {
            throw new Error('Mongo derivation expr must be a JSON aggregation expression, e.g. {"$cond":[...]}');
        }
        const cols = this.derived.get(table) ?? [];
        const existing = cols.find((d) => d.field === column);
        if (existing)
            existing.expr = parsed;
        else
            cols.push({ field: column, expr: parsed });
        this.derived.set(table, cols);
        registerDerivedColumn(this.schema, table, column);
    }
    async close() {
        try {
            await this.client.close();
        }
        catch { /* already closed */ }
    }
}
export const mongoConnector = {
    type: 'mongodb',
    async test(config) {
        const cfg = config;
        if (cfg.type !== 'mongodb')
            return { ok: false, error: 'Config type must be "mongodb"' };
        if (!cfg.database)
            return { ok: false, error: 'Mongo config requires a "database"' };
        const { MongoClient } = await loadMongo();
        const client = new MongoClient(uriFor(cfg));
        try {
            await client.connect();
            await client.db(cfg.database).command({ ping: 1 });
            return { ok: true };
        }
        catch (err) {
            const reason = err?.message || err?.code || err?.errors?.map((e) => e?.message || e?.code).filter(Boolean).join('; ') || String(err);
            return { ok: false, error: `Cannot connect to MongoDB: ${reason}` };
        }
        finally {
            await client.close().catch(() => { });
        }
    },
    async connect(config) {
        const cfg = config;
        if (cfg.type !== 'mongodb')
            throw new Error('Config type must be "mongodb"');
        if (!cfg.database)
            throw new Error('Mongo config requires a "database"');
        const { MongoClient } = await loadMongo();
        const client = new MongoClient(uriFor(cfg));
        await client.connect();
        const db = client.db(cfg.database);
        let names = cfg.collections;
        if (!names || names.length === 0) {
            names = (await db.listCollections({}, { nameOnly: true }).toArray())
                .map((c) => c.name).filter((n) => !n.startsWith('system.'));
        }
        // Each collection profiles independently (own count + sample + one $facet), so connect()
        // latency need not scale linearly with collection count.
        const tables = await Promise.all(names.map((n) => profileCollection(db, n)));
        const id = `mongo-${cfg.database}`;
        const dataSchema = {
            tables, foreignKeys: [],
            source: { id, type: 'mongodb', name: cfg.database, config },
        };
        return new MongoConnectedSource(id, cfg.database, client, db, dataSchema);
    },
};
