import { createRequire } from 'module';
import { ALL_STACK_METAS } from './detectors/index.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Group labels must be the stable per-stack name, never a per-app override
// like "Native (Rust · AppKit)".
const STACK_NAMES = new Map(ALL_STACK_METAS.map((m) => [m.id, m.name]));

/**
 * Version of the --json payload shape. Bump on any breaking field change so
 * consumers can guard against format drift.
 */
export const JSON_SCHEMA_VERSION = 1;

/**
 * Exit codes, applied only on the --json path so existing interactive usage
 * keeps its current behaviour.
 */
export const EXIT_OK = 0;
export const EXIT_NO_RESULTS = 1;
export const EXIT_ERROR = 2;

/**
 * Project one analysis result into the public JSON shape.
 *
 * Deliberately omits `description` and `color`: the former is localized via
 * i18n and would make output vary by locale, the latter is presentation only.
 * `stack` is the stable identifier consumers should key on.
 */
function toApp(result) {
  return {
    name: result.name,
    path: result.path,
    stack: result.stack,
    stackName: result.stackName,
    variant: result.variant ?? null,
    category: result.category,
    confidence: result.confidence,
    // Human-oriented strings. Not a stable API — do not parse these.
    evidence: result.evidence ?? [],
    bundleId: result.metadata?.bundleId ?? null,
    version: result.metadata?.version ?? null,
    sizeBytes: result.sizeBytes ?? 0,
    website: result.website ?? null,
    signature: result.signature ?? null,
    notarization: result.notarization ?? null,
  };
}

/**
 * Per-stack totals for scan mode, sorted by app count.
 * @param {object[]} apps - already projected app objects
 */
function buildSummary(apps) {
  const byStack = new Map();

  for (const app of apps) {
    const entry = byStack.get(app.stack) || {
      stack: app.stack,
      stackName: STACK_NAMES.get(app.stack) || app.stackName,
      count: 0,
      sizeBytes: 0,
    };
    entry.count += 1;
    entry.sizeBytes += app.sizeBytes;
    byStack.set(app.stack, entry);
  }

  const stacks = [...byStack.values()].sort((a, b) => b.count - a.count || a.stack.localeCompare(b.stack));

  return {
    totalApps: apps.length,
    totalSizeBytes: apps.reduce((sum, a) => sum + a.sizeBytes, 0),
    stacks,
  };
}

/**
 * Build the top-level payload. Every mode returns this same envelope so
 * consumers never have to branch on the shape.
 *
 * @param {{ mode: string, value?: string|null, results: object[], includeSummary?: boolean }} input
 */
export function buildPayload({ mode, value = null, results, includeSummary = false }) {
  const apps = results.map(toApp);

  return {
    schema: JSON_SCHEMA_VERSION,
    buildbyVersion: pkg.version,
    platform: process.platform,
    query: { mode, value },
    apps,
    summary: includeSummary ? buildSummary(apps) : null,
  };
}

/**
 * Build an error payload so stdout stays parseable even on failure.
 * @param {string} code - stable machine-readable code
 * @param {string} message
 */
export function buildErrorPayload(code, message) {
  return {
    schema: JSON_SCHEMA_VERSION,
    buildbyVersion: pkg.version,
    platform: process.platform,
    error: { code, message },
  };
}

/**
 * Write a payload to stdout as pretty JSON.
 * @param {object} payload
 */
export function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
