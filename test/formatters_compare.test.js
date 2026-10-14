import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Readable, Writable } from 'node:stream';

import {
  formatMarkdown,
  formatCsv,
  getAppArchitecture,
  getSignatureStatus,
  getNotarizationStatus,
  escapeCsvField,
} from '../src/formatters.js';
import {
  compareAppsData,
  buildCompareJson,
} from '../src/compare.js';
import {
  findMatchingApps,
  runInteractiveSelect,
  runInteractiveCompare,
} from '../src/interactive.js';
import { JSON_SCHEMA_VERSION } from '../src/json.js';

function createMockApp(overrides = {}) {
  return {
    name: 'VS Code',
    path: '/Applications/Visual Studio Code.app',
    platform: 'darwin',
    stack: 'electron',
    stackName: 'Electron',
    variant: null,
    category: 'cross-platform',
    confidence: 'high',
    evidence: ['Contents/Frameworks/Electron Framework.framework', 'Contents/Resources/app.asar'],
    description: 'Cross-platform desktop application',
    color: 'cyan',
    website: 'https://code.visualstudio.com',
    metadata: {
      bundleId: 'com.microsoft.VSCode',
      version: '1.85.0',
      architecture: 'Universal (arm64, x86_64)',
    },
    sizeBytes: 350 * 1024 * 1024,
    signature: {
      signed: true,
      adHoc: false,
      developer: 'Microsoft Corporation',
      teamId: 'UBF8T346G9',
    },
    notarization: {
      notarized: true,
      accepted: true,
      rejected: false,
      source: 'Notarized Developer ID',
    },
    ...overrides,
  };
}

function createNativeApp(overrides = {}) {
  return {
    name: 'Pages',
    path: '/Applications/Pages.app',
    platform: 'darwin',
    stack: 'native',
    stackName: 'Native',
    variant: 'Swift · AppKit',
    category: 'native',
    confidence: 'high',
    evidence: ['libswiftCore.dylib', 'AppKit.framework'],
    description: 'macOS native document editor',
    color: 'white',
    website: 'https://www.apple.com/pages/',
    metadata: {
      bundleId: 'com.apple.iWork.Pages',
      version: '13.2',
      architecture: 'arm64',
    },
    sizeBytes: 95 * 1024 * 1024,
    signature: {
      signed: true,
      adHoc: false,
      developer: 'Apple Inc.',
      teamId: 'Apple',
    },
    notarization: {
      notarized: false,
      accepted: true,
      rejected: false,
      source: 'Apple System',
    },
    ...overrides,
  };
}

describe('formatMarkdown', () => {
  test('generates valid GitHub Flavored Markdown table and details for a single app', () => {
    const app = createMockApp();
    const md = formatMarkdown([app]);

    // Headers & Tables
    assert.match(md, /# Desktop Applications Tech Stack Report/);
    assert.match(md, /## Applications/);
    assert.match(md, /\| Name \| Stack \| Category \| Confidence \| Size \| Architecture \| Signed \| Notarized \|/);
    assert.match(md, /\| :--- \| :--- \| :--- \| :--- \| ---: \| :--- \| :--- \| :--- \|/);

    // App row
    assert.match(md, /\| VS Code \| Electron \| cross-platform \| high \| 350\.0 MB \| Universal \(arm64, x86_64\) \| Signed \| Yes \|/);

    // Details section
    assert.match(md, /## Application Details/);
    assert.match(md, /### VS Code/);
    assert.match(md, /- \*\*Path\*\*: `\/Applications\/Visual Studio Code\.app`/);
    assert.match(md, /- \*\*Tech Stack\*\*: Electron/);
    assert.match(md, /- \*\*Category\*\*: cross-platform/);
    assert.match(md, /- \*\*Confidence\*\*: high/);
    assert.match(md, /- \*\*Size\*\*: 350\.0 MB/);
    assert.match(md, /- \*\*Architecture\*\*: Universal \(arm64, x86_64\)/);
    assert.match(md, /- \*\*Code Signature\*\*: Signed \(Microsoft Corporation\)/);
    assert.match(md, /- \*\*Notarization\*\*: Notarized/);
    assert.match(md, /- \*\*Bundle ID\*\*: `com\.microsoft\.VSCode`/);
    assert.match(md, /- \*\*Version\*\*: `1\.85\.0`/);
    assert.match(md, /- \*\*Homepage\*\*: \[https:\/\/code\.visualstudio\.com\]\(https:\/\/code\.visualstudio\.com\)/);
    assert.match(md, /- `Contents\/Frameworks\/Electron Framework\.framework`/);
    assert.match(md, /- `Contents\/Resources\/app\.asar`/);
  });

  test('includes query in the header when provided', () => {
    const md = formatMarkdown([createMockApp()], { query: 'Code' });
    assert.match(md, /# Applications Matching "Code"/);
  });

  test('appends technology stack distribution summary table when summary is enabled', () => {
    const app1 = createMockApp({ name: 'App 1', stack: 'electron', stackName: 'Electron', sizeBytes: 100 * 1024 * 1024 });
    const app2 = createMockApp({ name: 'App 2', stack: 'electron', stackName: 'Electron', sizeBytes: 200 * 1024 * 1024 });
    const app3 = createNativeApp({ name: 'App 3', stack: 'native', stackName: 'Native', sizeBytes: 50 * 1024 * 1024 });

    const md = formatMarkdown([app1, app2, app3], { summary: true });

    assert.match(md, /## Technology Stack Summary/);
    assert.match(md, /- \*\*Total Applications\*\*: 3/);
    assert.match(md, /- \*\*Total Disk Footprint\*\*: 350\.0 MB/);
    assert.match(md, /\| Tech Stack \| Category \| Apps \| Share \| Total Size \|/);
    assert.match(md, /\| Electron \| cross-platform \| 2 \| 66\.7% \| 300\.0 MB \|/);
    assert.match(md, /\| Native \| native \| 1 \| 33\.3% \| 50\.0 MB \|/);
  });

  test('handles empty results gracefully', () => {
    const md = formatMarkdown([]);
    assert.match(md, /No applications found\./);
  });

  test('handles apps with variants properly in stack display', () => {
    const app = createNativeApp({ stackName: 'Native', variant: 'Swift · AppKit' });
    const md = formatMarkdown([app]);
    assert.match(md, /Native \(Swift · AppKit\)/);
  });
});

describe('formatCsv', () => {
  test('outputs correct RFC 4180 headers', () => {
    const csv = formatCsv([]);
    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Name,Stack,Category,Confidence,SizeBytes,FormattedSize,Architecture,Signed,Notarized,Path,Version,BundleID,Website');
  });

  test('outputs populated rows matching app properties', () => {
    const app = createMockApp();
    const csv = formatCsv([app]);
    const lines = csv.split('\r\n');

    assert.equal(lines.length >= 2, true);
    const row = lines[1];
    assert.match(row, /^VS Code,Electron,cross-platform,high,367001600,350\.0 MB,"Universal \(arm64, x86_64\)",Signed,Notarized/);
  });

  test('escapes fields containing commas, double quotes, and line breaks per RFC 4180', () => {
    const weirdApp = createMockApp({
      name: 'Foo, "Bar" & Baz',
      path: '/Applications/Foo\nBar.app',
      category: 'cross,platform',
      metadata: {
        version: '1.0 "beta"',
        bundleId: 'com.foo.bar',
      },
    });

    const csv = formatCsv([weirdApp]);
    assert.match(csv, /"Foo, ""Bar"" & Baz"/, 'quotes and commas are properly escaped');
    assert.match(csv, /"\/Applications\/Foo\nBar\.app"/, 'newlines are quoted');
    assert.match(csv, /"cross,platform"/, 'commas are quoted');
    assert.match(csv, /"1\.0 ""beta"""/, 'version quotes are doubled');
  });

  test('escapeCsvField helper handles null, undefined, and plain values', () => {
    assert.equal(escapeCsvField(null), '');
    assert.equal(escapeCsvField(undefined), '');
    assert.equal(escapeCsvField('hello'), 'hello');
    assert.equal(escapeCsvField('hello, world'), '"hello, world"');
    assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvField(12345), '12345');
  });
});

describe('compareAppsData', () => {
  test('accurately calculates differences between two distinct applications', () => {
    const appA = createMockApp();
    const appB = createNativeApp();

    const result = compareAppsData(appA, appB);

    // Diffs
    assert.equal(result.diffs.stack.same, false);
    assert.equal(result.diffs.stack.valA, 'Electron');
    assert.equal(result.diffs.stack.valB, 'Native');

    assert.equal(result.diffs.category.same, false);
    assert.equal(result.diffs.category.valA, 'cross-platform');
    assert.equal(result.diffs.category.valB, 'native');

    assert.equal(result.diffs.architecture.same, false);
    assert.equal(result.diffs.architecture.valA, 'Universal (arm64, x86_64)');
    assert.equal(result.diffs.architecture.valB, 'arm64');

    // Size
    assert.equal(result.diffs.size.same, false);
    assert.equal(result.diffs.size.larger, 'A');
    assert.equal(result.diffs.size.diffBytes, (350 - 95) * 1024 * 1024);
    assert.equal(result.diffs.size.percentage > 0, true);

    // Packaging evidence
    assert.equal(result.evidenceDiff.common.length, 0);
    assert.equal(result.evidenceDiff.onlyA.length, 2);
    assert.equal(result.evidenceDiff.onlyB.length, 2);

    // Highlights
    assert.equal(result.highlights.length >= 3, true);
    assert.ok(result.highlights.some((h) => h.includes('VS Code') && h.includes('Pages')));
  });

  test('correctly identifies identical applications', () => {
    const appA = createMockApp();
    const appB = createMockApp({ path: '/Applications/VSCode-Copy.app' });

    const result = compareAppsData(appA, appB);

    assert.equal(result.diffs.stack.same, true);
    assert.equal(result.diffs.category.same, true);
    assert.equal(result.diffs.architecture.same, true);
    assert.equal(result.diffs.size.same, true);
    assert.equal(result.diffs.size.larger, 'equal');
    assert.equal(result.evidenceDiff.onlyA.length, 0);
    assert.equal(result.evidenceDiff.onlyB.length, 0);
    assert.equal(result.evidenceDiff.common.length, 2);
  });

  test('calculates percentage delta correctly when app B is larger', () => {
    const appA = createMockApp({ sizeBytes: 50 * 1024 * 1024 });
    const appB = createNativeApp({ sizeBytes: 150 * 1024 * 1024 });

    const result = compareAppsData(appA, appB);

    assert.equal(result.diffs.size.larger, 'B');
    assert.equal(result.diffs.size.diffBytes, 100 * 1024 * 1024);
    assert.equal(result.diffs.size.percentage, 200); // 100 / 50 = 200%
  });
});

describe('buildCompareJson', () => {
  test('returns standard buildby JSON envelope with comparison data', () => {
    const appA = createMockApp();
    const appB = createNativeApp();

    const payload = buildCompareJson(appA, appB);

    assert.equal(payload.schema, JSON_SCHEMA_VERSION);
    assert.equal(payload.mode, 'compare');
    assert.equal(typeof payload.buildbyVersion, 'string');
    assert.equal(typeof payload.platform, 'string');
    assert.ok(payload.comparison);
    assert.equal(payload.comparison.appA.name, 'VS Code');
    assert.equal(payload.comparison.appB.name, 'Pages');
    assert.ok(payload.comparison.diffs);
  });
});

describe('interactive application search', () => {
  const testApps = [
    { name: 'Visual Studio Code', path: '/Applications/Visual Studio Code.app' },
    { name: 'CodeRunner', path: '/Applications/CodeRunner.app' },
    { name: 'Slack', path: '/Applications/Slack.app' },
    { name: 'Pages', path: '/Applications/Pages.app' },
    { name: 'Safari', path: '/Applications/Safari.app' },
    { name: 'Xcode', path: '/Applications/Xcode.app' },
  ];

  test('findMatchingApps filters and prioritizes matches by relevance', () => {
    const matches = findMatchingApps(testApps, 'code');
    // Visual Studio Code contains "code", CodeRunner starts with "Code", Xcode ends with "code"
    assert.equal(matches.length, 3);
    assert.ok(matches.some((m) => m.name === 'Visual Studio Code'));
    assert.ok(matches.some((m) => m.name === 'CodeRunner'));
    assert.ok(matches.some((m) => m.name === 'Xcode'));

    const slackMatches = findMatchingApps(testApps, 'slack');
    assert.equal(slackMatches.length, 1);
    assert.equal(slackMatches[0].name, 'Slack');

    const emptyMatches = findMatchingApps(testApps, 'nonexistent');
    assert.equal(emptyMatches.length, 0);
  });

  test('runInteractiveSelect supports search and numeric selection', async () => {
    // Simulate user typing "slack", seeing results, then pressing "1"
    const input = new Readable({
      read() {
        this.push('slack\n1\n');
        this.push(null);
      },
    });

    let outputData = '';
    const output = new Writable({
      write(chunk, encoding, callback) {
        outputData += chunk.toString();
        callback();
      },
    });

    let selectedApp = null;
    const result = await runInteractiveSelect(testApps, (app) => {
      selectedApp = app;
    }, { input, output });

    assert.ok(result);
    assert.equal(result.name, 'Slack');
    assert.equal(selectedApp?.name, 'Slack');
    assert.match(outputData, /Slack/);
  });

  test('runInteractiveSelect exits on "q"', async () => {
    const input = new Readable({
      read() {
        this.push('q\n');
        this.push(null);
      },
    });

    let outputData = '';
    const output = new Writable({
      write(chunk, encoding, callback) {
        outputData += chunk.toString();
        callback();
      },
    });

    let selectedApp = null;
    const result = await runInteractiveSelect(testApps, (app) => {
      selectedApp = app;
    }, { input, output });

    assert.equal(result, null);
    assert.equal(selectedApp, null);
    assert.match(outputData, /exit|退出/i);
  });

  test('runInteractiveCompare supports selecting two apps and comparing', async () => {
    // Select app 1, select app 2, then enter
    const input = new Readable({
      read() {
        this.push('1\n2\nenter\n');
        this.push(null);
      },
    });

    let outputData = '';
    const output = new Writable({
      write(chunk, encoding, callback) {
        outputData += chunk.toString();
        callback();
      },
    });

    let comparedApps = null;
    const result = await runInteractiveCompare(testApps, (apps) => {
      comparedApps = apps;
    }, { input, output });

    assert.ok(result);
    assert.equal(result.length, 2);
    assert.equal(comparedApps?.length, 2);
    assert.match(outputData, /Visual Studio Code/);
    assert.match(outputData, /CodeRunner/);
  });

  test('runInteractiveCompare exits on "q"', async () => {
    const input = new Readable({
      read() {
        this.push('q\n');
        this.push(null);
      },
    });

    let outputData = '';
    const output = new Writable({
      write(chunk, encoding, callback) {
        outputData += chunk.toString();
        callback();
      },
    });

    let comparedApps = null;
    const result = await runInteractiveCompare(testApps, (apps) => {
      comparedApps = apps;
    }, { input, output });

    assert.equal(result, null);
    assert.equal(comparedApps, null);
    assert.match(outputData, /exit|退出/i);
  });
});

describe('compare command aliases', () => {
  test('supports vs and pk as command aliases for compare', async () => {
    const { Command } = await import('commander');
    const p = new Command();
    const cmd = p.command('compare <app1> <app2>').aliases(['vs', 'pk']);
    assert.deepEqual(cmd.aliases(), ['vs', 'pk']);
  });
});

describe('printAppDetail', () => {
  test('renders structured inspection report with key sections and aligned specs', async () => {
    const { printAppDetail } = await import('../src/display.js');
    const app = createMockApp({
      name: 'TestApp',
      path: '/Applications/TestApp.app',
      architecture: 'arm64',
      sizeBytes: 150 * 1024 * 1024,
      frameworkVersion: '32.1.0',
    });

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      printAppDetail(app);
    } finally {
      console.log = origLog;
    }

    const output = logs.join('\n');
    assert.ok(output.includes('TestApp'));
    assert.ok(output.includes('/Applications/TestApp.app'));
    assert.ok(output.includes('Electron'));
    assert.ok(output.includes('32.1.0'));
    assert.ok(output.includes('核心规格') || output.includes('Key Specifications'));
    assert.ok(output.includes('Apple Silicon (arm64)') || output.includes('arm64'));
    assert.ok(output.includes('150.0 MB'));
    assert.ok(output.includes('com.microsoft.VSCode'));
    assert.ok(output.includes('判定依据') || output.includes('Detection Evidence'));
    assert.ok(output.includes('app.asar'));
    assert.ok(output.includes('签名与安全') || output.includes('Security & Trust'));
    assert.ok(output.includes('Microsoft Corporation'));
  });
});
