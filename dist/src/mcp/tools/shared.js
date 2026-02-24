/**
 * Shared utilities for MCP tool handlers.
 *
 * Consolidates duplicated logic:
 * - MCP response builders (error/success/html patterns)
 * - Column inference from data rows
 * - Color preference application to visualization specs
 */
export function errorResponse(message) {
    return {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
    };
}
export function jsonResponse(body) {
    return {
        content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    };
}
export function htmlResponse(body, html) {
    const specId = body?.specId;
    return {
        content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
        structuredContent: { ...(specId ? { specId } : {}), html },
    };
}
// ─── COLUMN INFERENCE ───────────────────────────────────────────────────────
export function inferColumns(data) {
    if (data.length === 0)
        return [];
    const keys = Object.keys(data[0]);
    return keys.map(key => {
        const values = data.map(r => r[key]).filter(v => v != null);
        const stringValues = values.map(String);
        const uniqueValues = [...new Set(stringValues)];
        const numericCount = values.filter(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v !== '')).length;
        const isNumeric = numericCount > values.length * 0.7;
        const isDate = /date|time|year|month|day/i.test(key) ||
            values.every(v => /^\d{4}[-/]/.test(String(v))) ||
            (values.length > 0 && values.every(v => /^\d{4}-(?:Q\d|W\d{2}|\d{2}(?:-\d{2})?)$/.test(String(v))));
        const isId = /^id$|_id$|Id$/i.test(key) && uniqueValues.length > data.length * 0.5;
        const YEAR_NAME_PATTERN = /\byear\b|\bcohort\b|\bfiscal\b|\bfy\b|\bsemester\b|\bvintage\b|\bclass_of\b|\bgraduating\b|\bperiod\b|\bseason\b/i;
        const looksLikeYear = isNumeric &&
            !isDate &&
            YEAR_NAME_PATTERN.test(key) &&
            values.length > 0 &&
            values.every(v => {
                const n = Number(v);
                return Number.isInteger(n) && n >= 1900 && n <= 2100;
            }) &&
            uniqueValues.length <= 50 &&
            uniqueValues.length > 1 &&
            (Math.max(...values.map(Number)) - Math.min(...values.map(Number))) < 200;
        let type = 'categorical';
        if (isId)
            type = 'id';
        else if (isDate || looksLikeYear)
            type = 'date';
        else if (isNumeric)
            type = 'numeric';
        return {
            name: key,
            type,
            sampleValues: uniqueValues.slice(0, 20),
            uniqueCount: uniqueValues.length,
            nullCount: data.length - values.length,
            totalCount: data.length,
        };
    });
}
// ─── COLOR PREFERENCES ─────────────────────────────────────────────────────
export function applyColorPreferences(spec, prefs, data) {
    const notes = [];
    if (!prefs)
        return { notes };
    if (!spec.encoding.color)
        spec.encoding.color = {};
    if (prefs.palette) {
        spec.encoding.color.palette = prefs.palette;
    }
    if (prefs.highlight) {
        spec.encoding.color.highlight = {
            values: prefs.highlight.values,
            ...(prefs.highlight.color != null ? { color: prefs.highlight.color } : {}),
            ...(prefs.highlight.mutedColor != null ? { mutedColor: prefs.highlight.mutedColor } : {}),
            ...(prefs.highlight.mutedOpacity != null ? { mutedOpacity: prefs.highlight.mutedOpacity } : {}),
        };
    }
    if (prefs.colorField) {
        spec.encoding.color.field = prefs.colorField;
        if (!spec.encoding.color.type)
            spec.encoding.color.type = 'nominal';
    }
    // Auto-infer color field if palette or highlight was set but no field exists
    if ((prefs.palette || prefs.highlight) && !spec.encoding.color?.field) {
        let inferred = null;
        // Strategy 1: use nominal axis
        if (spec.encoding.x?.type === 'nominal')
            inferred = spec.encoding.x.field;
        else if (spec.encoding.y?.type === 'nominal')
            inferred = spec.encoding.y.field;
        // Strategy 2: find a suitable categorical column from data
        if (!inferred && data && data.length > 0) {
            const keys = Object.keys(data[0]);
            for (const key of keys) {
                if (/^id$|_id$|Id$/i.test(key))
                    continue;
                const vals = data.map(d => d[key]).filter(v => v != null);
                const isNum = vals.every(v => typeof v === 'number' || !isNaN(Number(v)));
                if (isNum)
                    continue;
                const unique = new Set(vals.map(String));
                if (unique.size <= 20) {
                    inferred = key;
                    break;
                }
            }
        }
        if (inferred) {
            spec.encoding.color.field = inferred;
            if (!spec.encoding.color.type)
                spec.encoding.color.type = 'nominal';
            notes.push(`Color field auto-detected as '${inferred}'. Use colorField to override.`);
        }
        else if (prefs.palette) {
            notes.push(`Palette '${prefs.palette}' ignored — no categorical column found with ≤20 unique values. Use colorField to specify.`);
        }
    }
    // Validate highlight values against data
    if (prefs.highlight && spec.encoding.color?.field && data) {
        const field = spec.encoding.color.field;
        const dataValues = new Set(data.map(d => String(d[field]).toLowerCase()));
        const unmatched = prefs.highlight.values.filter((v) => !dataValues.has(String(v).toLowerCase()));
        if (unmatched.length > 0) {
            notes.push(`Highlight: ${unmatched.map((v) => `'${v}'`).join(', ')} not found in data for field '${field}'.`);
        }
    }
    return { notes };
}
// ─── FORMATTING ─────────────────────────────────────────────────────────────
export function formatUptime(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 60)
        return `${min} minutes`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
}
//# sourceMappingURL=shared.js.map