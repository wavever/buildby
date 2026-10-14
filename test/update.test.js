import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import path from 'path';
import fs from 'fs';

import {
  compareVersions,
  detectInstallKind,
  getPackageRoot,
  fetchLatestVersionFast,
  renderUpdateBox,
  promptUpdateSelection,
  checkAndUpdateIfNeeded,
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

describe('renderUpdateBox', () => {
  test('renders box with version diff and options in English', () => {
    const box = renderUpdateBox({
      currentVersion: '1.3.1',
      latestVersion: '1.4.0',
      selectedIndex: 0,
      isZh: false,
    });

    assert.ok(box.includes('1.3.1'));
    assert.ok(box.includes('1.4.0'));
    assert.ok(box.includes('Update Available') || box.includes('发现新版本'));
    assert.ok(box.includes('Update now') || box.includes('立即升级'));
    assert.ok(box.includes('Skip') || box.includes('跳过'));
  });

  test('renders box with selection indicator moving based on selectedIndex', () => {
    const box0 = renderUpdateBox({
      currentVersion: '1.3.1',
      latestVersion: '1.4.0',
      selectedIndex: 0,
    });
    const box1 = renderUpdateBox({
      currentVersion: '1.3.1',
      latestVersion: '1.4.0',
      selectedIndex: 1,
    });

    assert.ok(box0.includes('❯ 1.'));
    assert.ok(box1.includes('❯ 2.'));
  });
});

describe('fetchLatestVersionFast', () => {
  test('returns valid semver string or null within timeout', async () => {
    const version = await fetchLatestVersionFast(PACKAGE_NAME, 2000);
    if (version !== null) {
      assert.match(version, /^\d+\.\d+\.\d+/);
    }
  });

  test('returns null for non-existent package', async () => {
    const version = await fetchLatestVersionFast('@wavever/this-pkg-does-not-exist-xyz', 1000);
    assert.equal(version, null);
  });
});

describe('promptUpdateSelection', () => {
  test('supports keyboard navigation: Enter selects current option', async () => {
    const { EventEmitter } = await import('events');
    const input = new EventEmitter();
    input.isTTY = true;
    input.setRawMode = () => {};
    input.resume = () => {};
    input.pause = () => {};

    const output = { isTTY: true, write: () => {} };

    const promptPromise = promptUpdateSelection({
      currentVersion: '1.3.1',
      latestVersion: '1.4.0',
      input,
      output,
    });

    // Enter immediately selects option 0 ("update")
    input.emit('keypress', '\r', { name: 'enter' });

    const choice = await promptPromise;
    assert.equal(choice, 'update');
  });

  test('supports keyboard navigation: Down arrow then Enter selects skip', async () => {
    const { EventEmitter } = await import('events');
    const input = new EventEmitter();
    input.isTTY = true;
    input.setRawMode = () => {};
    input.resume = () => {};
    input.pause = () => {};

    const output = { isTTY: true, write: () => {} };

    const promptPromise = promptUpdateSelection({
      currentVersion: '1.3.1',
      latestVersion: '1.4.0',
      input,
      output,
    });

    // Press down arrow, then enter
    input.emit('keypress', '', { name: 'down' });
    input.emit('keypress', '\r', { name: 'enter' });

    const choice = await promptPromise;
    assert.equal(choice, 'skip');
  });

  test('supports key "q" to skip', async () => {
    const { EventEmitter } = await import('events');
    const input = new EventEmitter();
    input.isTTY = true;
    input.setRawMode = () => {};
    input.resume = () => {};
    input.pause = () => {};

    const output = { isTTY: true, write: () => {} };

    const promptPromise = promptUpdateSelection({
      currentVersion: '1.3.1',
      latestVersion: '1.4.0',
      input,
      output,
    });

    input.emit('keypress', 'q', { name: 'q' });

    const choice = await promptPromise;
    assert.equal(choice, 'skip');
  });
});

describe('checkAndUpdateIfNeeded', () => {
  test('skips when non-TTY', async () => {
    const res = await checkAndUpdateIfNeeded({
      currentVersion: '1.0.0',
      argv: ['node', 'buildby'],
      input: { isTTY: false },
      output: { isTTY: false },
    });

    assert.equal(res.updated, false);
  });

  test('skips when --json flag is passed', async () => {
    const res = await checkAndUpdateIfNeeded({
      currentVersion: '1.0.0',
      argv: ['node', 'buildby', '--json'],
      input: { isTTY: true },
      output: { isTTY: true },
    });

    assert.equal(res.updated, false);
  });

  test('skips when --no-update-check flag is passed', async () => {
    const res = await checkAndUpdateIfNeeded({
      currentVersion: '1.0.0',
      argv: ['node', 'buildby', '--no-update-check'],
      input: { isTTY: true },
      output: { isTTY: true },
    });

    assert.equal(res.updated, false);
  });

  test('skips when BUILDBY_NO_UPDATE_CHECK=1', async () => {
    const prev = process.env.BUILDBY_NO_UPDATE_CHECK;
    process.env.BUILDBY_NO_UPDATE_CHECK = '1';

    try {
      const res = await checkAndUpdateIfNeeded({
        currentVersion: '1.0.0',
        argv: ['node', 'buildby'],
        input: { isTTY: true },
        output: { isTTY: true },
      });

      assert.equal(res.updated, false);
    } finally {
      if (prev !== undefined) process.env.BUILDBY_NO_UPDATE_CHECK = prev;
      else delete process.env.BUILDBY_NO_UPDATE_CHECK;
    }
  });

  test('skips when config has checkForUpdates: false', async () => {
    const res = await checkAndUpdateIfNeeded({
      currentVersion: '1.0.0',
      argv: ['node', 'buildby'],
      config: { checkForUpdates: false },
      input: { isTTY: true },
      output: { isTTY: true },
    });

    assert.equal(res.updated, false);
  });
});

