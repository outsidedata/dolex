import { parse } from './parser.js';
import { evaluateExpression } from './evaluator.js';
import { ColumnManager } from './column-manager.js';
import { extractColumnRefs, hasCircularDependency } from './dependency.js';
// ─── Pipeline ────────────────────────────────────────────────────────────────
export function executeSingleTransform(db, metadata, input, sourceColumns) {
    return executeBatchTransform(db, metadata, {
        sourceId: input.sourceId,
        table: input.table,
        transforms: [{ create: input.create, expr: input.expr }],
        type: input.type,
        filter: input.filter,
        partitionBy: input.partitionBy,
    }, sourceColumns);
}
export function executeBatchTransform(db, metadata, input, sourceColumns) {
    const mgr = new ColumnManager(db);
    const tableName = input.table;
    const allWarnings = [];
    const results = [];
    // Pre-validate ALL expressions before executing any
    const batchNames = new Set();
    for (const t of input.transforms) {
        validateColumnName(t.create);
        // Check for duplicate names within the batch
        if (batchNames.has(t.create)) {
            throw new Error(`Duplicate column name '${t.create}' in batch. Each transform must create a uniquely named column.`);
        }
        batchNames.add(t.create);
        // Check source column collision
        if (sourceColumns.includes(t.create)) {
            throw new Error(`Column '${t.create}' already exists in source data. Use a different name (e.g., '${t.create}_derived')`);
        }
        // Check parse validity
        parse(t.expr);
    }
    // Track rollback info
    const rollbackActions = [];
    try {
        for (const t of input.transforms) {
            const result = executeOne(db, mgr, metadata, tableName, t.create, t.expr, input, sourceColumns);
            rollbackActions.push(result.rollback);
            results.push(result.result);
            allWarnings.push(...result.warnings);
        }
    }
    catch (err) {
        // Rollback all changes
        for (const action of rollbackActions.reverse()) {
            try {
                rollback(db, mgr, metadata, tableName, action);
            }
            catch { /* best effort */ }
        }
        throw err;
    }
    // Count columns
    const working = metadata.list(tableName, 'working').length;
    const derived = metadata.list(tableName, 'derived').length;
    const totalCols = mgr.getColumnNames(tableName).length;
    return {
        created: results,
        warnings: allWarnings,
        working_column_count: working,
        derived_column_count: derived,
        total_columns: totalCols,
    };
}
function executeOne(db, mgr, metadata, tableName, create, expr, input, sourceColumns) {
    // Parse and validate
    const ast = parse(expr);
    // Validate column references
    const refs = extractColumnRefs(ast);
    const existingCols = mgr.getColumnNames(tableName);
    for (const ref of refs) {
        if (!existingCols.includes(ref)) {
            throw new Error(`Column '${ref}' not found in table '${tableName}'. Available: [${existingCols.join(', ')}]`);
        }
    }
    // Validate partitionBy column exists
    if (input.partitionBy && !existingCols.includes(input.partitionBy)) {
        throw new Error(`Partition column '${input.partitionBy}' not found in table '${tableName}'. Available: [${existingCols.join(', ')}]`);
    }
    // Validate filter field names exist
    if (input.filter) {
        for (const f of input.filter) {
            if (!existingCols.includes(f.field)) {
                throw new Error(`Filter field '${f.field}' not found in table '${tableName}'. Available: [${existingCols.join(', ')}]`);
            }
        }
    }
    // Check for circular dependencies
    const existingRecords = metadata.list(tableName);
    const circCheck = hasCircularDependency(create, expr, existingRecords);
    if (circCheck.circular) {
        throw new Error(`Circular dependency detected: ${circCheck.cycle.join(' → ')}`);
    }
    // Get all rows
    const rows = mgr.getAllRows(tableName);
    // Evaluate expression
    const evalResult = evaluateExpression(expr, rows, {
        partitionBy: input.partitionBy,
        filter: input.filter,
    });
    const type = input.type ?? evalResult.type;
    // Determine collision behavior
    const existingRecord = metadata.get(tableName, create);
    let overwritten = false;
    let rollbackAction;
    if (existingRecord) {
        if (existingRecord.layer === 'working') {
            // Overwrite working column
            const oldValues = rows.map(r => r[create]);
            mgr.overwriteColumn(tableName, create, evalResult.values);
            metadata.remove(tableName, create, 'working');
            metadata.add(tableName, {
                column: create,
                expr,
                type,
                layer: 'working',
                partitionBy: input.partitionBy,
            });
            overwritten = true;
            rollbackAction = {
                type: 'overwritten',
                column: create,
                oldValues,
                oldLayer: 'working',
                oldExpr: existingRecord.expr,
                oldType: existingRecord.type,
            };
        }
        else {
            // Shadow derived column
            const oldValues = rows.map(r => r[create]);
            mgr.overwriteColumn(tableName, create, evalResult.values);
            metadata.add(tableName, {
                column: create,
                expr,
                type,
                layer: 'working',
                partitionBy: input.partitionBy,
            });
            overwritten = true;
            rollbackAction = {
                type: 'overwritten',
                column: create,
                oldValues,
                oldLayer: 'derived',
                oldExpr: existingRecord.expr,
                oldType: existingRecord.type,
            };
        }
    }
    else {
        // New column
        mgr.addColumn(tableName, create, evalResult.values, type);
        metadata.add(tableName, {
            column: create,
            expr,
            type,
            layer: 'working',
            partitionBy: input.partitionBy,
        });
        rollbackAction = { type: 'added', column: create };
    }
    const result = {
        column: create,
        expr,
        type,
        layer: 'working',
        overwritten,
        stats: evalResult.stats,
    };
    return { result, warnings: evalResult.warnings, rollback: rollbackAction };
}
function rollback(db, mgr, metadata, tableName, action) {
    if (action.type === 'added') {
        try {
            mgr.dropColumn(tableName, action.column);
        }
        catch { /* ignore */ }
        metadata.remove(tableName, action.column);
    }
    else if (action.type === 'overwritten' && action.oldValues) {
        mgr.overwriteColumn(tableName, action.column, action.oldValues);
        metadata.remove(tableName, action.column, 'working');
    }
}
// ─── Validation ──────────────────────────────────────────────────────────────
function validateColumnName(name) {
    if (!name || name.trim().length === 0) {
        throw new Error('Column name cannot be empty');
    }
    if (/\s/.test(name)) {
        throw new Error(`Column name '${name}' cannot contain spaces`);
    }
    if (/\./.test(name)) {
        throw new Error(`Column name '${name}' cannot contain dots`);
    }
    if (/^\d/.test(name)) {
        throw new Error(`Column name '${name}' cannot start with a digit`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(`Column name '${name}' must contain only letters, digits, and underscores`);
    }
}
//# sourceMappingURL=pipeline.js.map