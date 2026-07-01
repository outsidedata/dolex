// PUBLIC cleaning PRIMITIVES — what the shipped surfaces use to let a USER's own model/agent
// drive cleaning (BYO orchestrator): the Python sandbox executor, the per-column author
// helper, and model-free manifest replay. The deterministic CHECKS REGISTRY + conservation
// guard + the autoclean LOOP are NOT here — they are the private LO orchestrator
// (local-orchestration/src/checks.ts + autoclean.ts) and are not shipped. dolex stays a
// toolbox (`dolex check` lints, `dolex clean` fixes one column); the orchestration is the
// caller's (Claude, or any BYO model/loop).
export { pythonAvailable, runPythonClean, cleanStats, safetyVerdict, previewSample, applyCleanColumn, CleanRejected } from './exec.js';
export { applyManifest, applyFixesToRows, readCleanfixManifest, resolveCleanfixPath } from './replay.js';
