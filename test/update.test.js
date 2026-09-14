import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import path from 'path';
import fs from 'fs';

import {
  compareVersions,
  detectInstallKind,
  getPackageRoot,
  PACKAGE_NAME,
} from '../src/update.js';

describe('compareVersions', () => {
  test('orders by numeric precedence, not string order', () => {
    assert.equal(compareVersions('1.3.0', '1.2.0'), 1);
    assert.equal(compareVersions('1.2.0', '1.3.0'), -1);
    // The case a string compare gets wrong.
    assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
    assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  });

  test('treats equal versions as equal', () => {
    assert.equal(compareVersions('1.3.0', '1.3.0'), 0);
    assert.equal(compareVersions('v1.3.0', '1.3.0'), 0, 'a leading v is ignored');
    assert.equal(compareVersions(' 1.3.0 ', '1.3.0'), 0, 'surrounding space is ignored');
  });

  test('a prerelease sorts below its own release', () => {
    assert.equal(compareVersions('1.3.0-beta.1', '1.3.0'), -1);
    assert.equal(compareVersions('1.3.0', '1.3.0-beta.1'), 1);
    assert.equal(compareVersions('1.3.0-beta.1', '1.3.0-beta.2'), -1);
    // A prerelease of a higher version still wins on the numeric parts.
    assert.equal(compareVersions('1.4.0-beta.1', '1.3.0'), 1);
  });

  test('tolerates missing parts', () => {
    assert.equal(compareVersions('2', '1.9.9'), 1);
    assert.equal(compareVersions('1.3', '1.3.0'), 0);
  });

  test('no update is offered when the local build is ahead of the registry', () => {
    // Exactly the state of a freshly tagged release that is not on npm yet.
    assert.ok(compareVersions('1.2.0', '1.3.0') <= 0);
  });
});

describe('detectInstallKind', () => {
  test('recognises an npm-owned install', () => {
    assert.equal(
      detectInstallKind(path.join('/usr', 'local', 'lib', 'node_modules', '@wavever', 'buildby')),
      'npm',
    );
    assert.equal(
      detectInstallKind(path.join('/Users', 'me', 'project', 'node_modules', '@wavever', 'buildby')),
      'npm',
    );
  });

  test('recognises a checkout or linked copy', () => {
    assert.equal(detectInstallKind(path.join('/Users', 'me', 'Code', 'buildby')), 'local');
    // A directory merely *named* like the marker is not an npm install.
    assert.equal(detectInstallKind(path.join('/Users', 'me', 'node_modules_backup')), 'local');
  });

  test('this test run is a local checkout, so update must not shell out to npm', () => {
    assert.equal(detectInstallKind(), 'local');
  });
});

describe('getPackageRoot', () => {
  test('points at the directory holding package.json', () => {
    const root = getPackageRoot();
    const manifestPath = path.join(root, 'package.json');

    assert.ok(fs.existsSync(manifestPath), `expected package.json at ${manifestPath}`);
    assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).name, PACKAGE_NAME);
  });
});
