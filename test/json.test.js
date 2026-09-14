import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildErrorPayload, buildPayload, JSON_SCHEMA_VERSION } from '../src/json.js';
import { binaryContainsAny } from '../src/detectors/shared.js';
import { makeMacApp, makeTempDir, rmDir } from './helpers.js';
import fs from 'fs';
import path from 'path';

function fakeResult(overrides = {}) {
  return {
    name: 'Demo',
    path: '/Applications/Demo.app',
    stack: 'electron',
    stackName: 'Electron',
    variant: null,
    category: 'cross-platform',
    confidence: 'high',
    evidence: ['app.asar'],
    description: 'localized text that must not leak into JSON',
    color: 'cyan',
    website: 'https://www.electronjs.org',
    metadata: { bundleId: 'com.demo', version: '1.0.0' },
    sizeBytes: 1024,
    signature: null,
    notarization: null,
    ...overrides,
  };
}

describe('JSON payload', () => {
  test('envelope carries schema, version and query', () => {
    const payload = buildPayload({ mode: 'app', value: 'demo', results: [fakeResult()] });

    assert.equal(payload.schema, JSON_SCHEMA_VERSION);
    assert.equal(payload.query.mode, 'app');
    assert.equal(payload.query.value, 'demo');
    assert.equal(typeof payload.buildbyVersion, 'string');
    assert.equal(payload.apps.length, 1);
  });

  test('omits localized and presentation-only fields', () => {
    const [app] = buildPayload({ mode: 'app', results: [fakeResult()] }).apps;

    assert.ok(!('description' in app), 'description is locale-dependent');
    assert.ok(!('color' in app), 'color is presentation only');
  });

  test('flattens metadata and keeps sizes raw', () => {
    const [app] = buildPayload({ mode: 'app', results: [fakeResult()] }).apps;

    assert.equal(app.bundleId, 'com.demo');
    assert.equal(app.version, '1.0.0');
    assert.equal(app.sizeBytes, 1024);
  });

  test('summary only appears for scan mode and uses stable stack names', () => {
    const noSummary = buildPayload({ mode: 'app', results: [fakeResult()] });
    assert.equal(noSummary.summary, null);

    const payload = buildPayload({
      mode: 'scan',
      includeSummary: true,
      results: [
        fakeResult(),
        fakeResult({ name: 'B' }),
        // A per-app override must not become the group label.
        fakeResult({ name: 'C', stack: 'native', stackName: 'Native (Rust · AppKit)', variant: 'Rust · AppKit', sizeBytes: 2048 }),
      ],
    });

    assert.equal(payload.summary.totalApps, 3);
    assert.equal(payload.summary.totalSizeBytes, 4096);

    const [first, second] = payload.summary.stacks;
    assert.equal(first.stack, 'electron');
    assert.equal(first.count, 2);
    assert.equal(second.stack, 'native');
    assert.equal(second.stackName, 'Native', 'group label must be the stack meta name');
  });

  test('error payload is parseable and typed', () => {
    const payload = buildErrorPayload('app_not_found', 'No app matched "zzz"');

    assert.equal(payload.schema, JSON_SCHEMA_VERSION);
    assert.equal(payload.error.code, 'app_not_found');
    assert.ok(!('apps' in payload));
  });

  test('variant survives into the payload', () => {
    const [app] = buildPayload({
      mode: 'app',
      results: [fakeResult({ stack: 'python', stackName: 'Python (PyQt)', variant: 'PyQt' })],
    }).apps;

    assert.equal(app.stack, 'python');
    assert.equal(app.variant, 'PyQt');
  });
});

describe('binaryContainsAny', () => {
  test('finds a marker straddling the 1 MiB chunk boundary', () => {
    const dir = makeTempDir('chunkedge');
    try {
      const file = path.join(dir, 'bin');
      const offset = (1 << 20) - 3; // marker spans the read window
      fs.writeFileSync(file, Buffer.concat([
        Buffer.alloc(offset),
        Buffer.from('JUCE v'),
        Buffer.alloc(4096),
      ]));

      assert.equal(binaryContainsAny(file, ['JUCE v']), 'JUCE v');
    } finally {
      rmDir(dir);
    }
  });

  test('respects maxBytes', () => {
    const dir = makeTempDir('maxbytes');
    try {
      const file = path.join(dir, 'bin');
      fs.writeFileSync(file, Buffer.concat([
        Buffer.alloc(4 << 20),
        Buffer.from('needle-here'),
      ]));

      assert.equal(binaryContainsAny(file, ['needle-here']), 'needle-here');
      assert.equal(binaryContainsAny(file, ['needle-here'], { maxBytes: 1 << 20 }), null);
    } finally {
      rmDir(dir);
    }
  });

  test('returns null for a missing file instead of throwing', () => {
    assert.equal(binaryContainsAny('/nope/does/not/exist', ['x']), null);
  });

  // Creating file symlinks on Windows needs elevation or Developer Mode.
  test('reads through a symlinked executable', { skip: process.platform === 'win32' }, () => {
    const dir = makeTempDir('symlink');
    try {
      const target = path.join(dir, 'real-binary');
      fs.writeFileSync(target, 'noise cargo/registry/src/ noise');

      const app = makeMacApp(dir, 'LinkedApp', { executable: 'linked' });
      const linkPath = path.join(app, 'Contents', 'MacOS', 'linked');
      fs.rmSync(linkPath);
      fs.symlinkSync(target, linkPath);

      assert.equal(binaryContainsAny(linkPath, ['cargo/registry/src/']), 'cargo/registry/src/');
    } finally {
      rmDir(dir);
    }
  });
});
