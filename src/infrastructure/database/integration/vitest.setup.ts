import { config } from "dotenv";

// Runs (and completes) before any test file is loaded — Vitest's
// setupFiles guarantee, unlike a plain import at the top of a test
// file, whose sibling static imports (e.g. the database client) would
// already be evaluated by the time this file's own top-level code runs
// (ESM evaluates a module's dependencies before its own body).
config({ path: ".env.local" });
