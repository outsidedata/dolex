export const PY_SCHEMA = { type: 'object', properties: { code: { type: 'string' }, note: { type: 'string' } }, required: ['code', 'note'] };
export function buildAuthorPrompt(req) {
    const system = 'Write a Python 3 function `def clean(value):` taking ONE raw cell value (string) and returning the CLEANED value (None for missing/sentinel). May import stdlib (datetime, re). Output JSON {code, note}: code = the COMPLETE function plus any imports. No I/O.';
    const user = `Column "${req.column}". Detected issue: ${req.issue}. Sample values: ${req.samples.map((s) => JSON.stringify(s)).join(', ')}.\nTASK: ${req.task}` +
        (req.feedback ? `\n\nYour PREVIOUS attempt FAILED validation: ${req.feedback}. Write a corrected function.` : '');
    return { system, user };
}
