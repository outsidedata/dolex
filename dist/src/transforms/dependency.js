import { parse } from './parser.js';
/** Extract all column references from an AST. */
export function extractColumnRefs(ast) {
    const refs = new Set();
    walk(ast, refs);
    return [...refs];
}
function walk(node, refs) {
    switch (node.type) {
        case 'column':
            refs.add(node.name);
            break;
        case 'binary':
            walk(node.left, refs);
            walk(node.right, refs);
            break;
        case 'unary':
            walk(node.operand, refs);
            break;
        case 'call':
            for (const a of node.args)
                walk(a, refs);
            break;
        case 'array':
            for (const e of node.elements)
                walk(e, refs);
            break;
    }
}
/** Build a dependency map: column → columns it references. */
export function buildDependencyMap(records) {
    const map = new Map();
    for (const record of records) {
        const ast = parse(record.expr);
        const refs = extractColumnRefs(ast);
        map.set(record.column, new Set(refs));
    }
    return map;
}
/** Find columns that depend on the given column (direct and transitive). */
export function findDependents(column, records) {
    const depMap = buildDependencyMap(records);
    const dependents = new Set();
    function findRecursive(col) {
        for (const [colName, deps] of depMap) {
            if (deps.has(col) && !dependents.has(colName)) {
                dependents.add(colName);
                findRecursive(colName);
            }
        }
    }
    findRecursive(column);
    return [...dependents];
}
/** Check for circular dependencies when adding a new transform. */
export function hasCircularDependency(newColumn, newExpr, existingRecords) {
    const allRecords = [
        ...existingRecords,
        { column: newColumn, expr: newExpr, type: 'numeric', layer: 'working', order: 0 },
    ];
    const depMap = buildDependencyMap(allRecords);
    // DFS cycle detection
    const visited = new Set();
    const inStack = new Set();
    const path = [];
    function dfs(col) {
        if (inStack.has(col)) {
            const cycleStart = path.indexOf(col);
            return [...path.slice(cycleStart), col];
        }
        if (visited.has(col))
            return null;
        visited.add(col);
        inStack.add(col);
        path.push(col);
        const deps = depMap.get(col);
        if (deps) {
            for (const dep of deps) {
                if (depMap.has(dep)) {
                    const cycle = dfs(dep);
                    if (cycle)
                        return cycle;
                }
            }
        }
        inStack.delete(col);
        path.pop();
        return null;
    }
    const cycle = dfs(newColumn);
    if (cycle) {
        return { circular: true, cycle };
    }
    return { circular: false };
}
/** Sort records in dependency-safe order (dependencies before dependents). */
export function topologicalSort(records) {
    const depMap = buildDependencyMap(records);
    const recordMap = new Map(records.map(r => [r.column, r]));
    const result = [];
    const visited = new Set();
    const inStack = new Set();
    function visit(col) {
        if (visited.has(col))
            return;
        if (inStack.has(col)) {
            throw new Error(`Circular dependency detected involving column '${col}'`);
        }
        inStack.add(col);
        const deps = depMap.get(col);
        if (deps) {
            for (const dep of deps) {
                if (recordMap.has(dep)) {
                    visit(dep);
                }
            }
        }
        inStack.delete(col);
        visited.add(col);
        if (recordMap.has(col)) {
            result.push(recordMap.get(col));
        }
    }
    for (const record of records) {
        visit(record.column);
    }
    return result;
}
//# sourceMappingURL=dependency.js.map