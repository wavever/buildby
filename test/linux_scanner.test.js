import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_LINUX_APP_DIRS,
  STANDARD_BIN_DIRS,
  getLinuxAppDirectories,
  parseDesktopFile,
  parseDesktopContent,
  isValidDesktopApp,
  stripFieldCodes,
  tokenizeExec,
  extractCommandFromTokens,
  resolveExecutablePath,
  isExcludedLinuxApp,
  scanLinuxApps,
  findLinuxAppsByName,
  isLinuxAppDirectory,
  findDesktopFileForExecutable,
  probeLinuxAppDirectory,
  probeLinuxBinary,
  probeLinuxApp,
} from '../src/linuxScanner.js';
import { makeTempDir, rmDir, makeLinuxApp } from './helpers.js';

let testRoot;

before(() => {
  testRoot = makeTempDir('linux-scanner-test');
});

after(() => {
  rmDir(testRoot);
});

describe('Desktop entry parsing', () => {
  test('parses standard [Desktop Entry] section with full metadata', () => {
    const content = `
[Desktop Entry]
Version=1.0
Type=Application
Name=Firefox Web Browser
Name[zh_CN]=火狐浏览器
GenericName=Web Browser
Comment=Browse the World Wide Web
Comment[zh_CN]=访问互联网
Exec=/usr/bin/firefox %u
Icon=firefox
Terminal=false
Categories=Network;WebBrowser;
StartupWMClass=firefox
    `.trim();

    const parsed = parseDesktopContent(content, { locale: 'zh_CN' });
    assert.equal(parsed.type, 'Application');
    assert.equal(parsed.name, 'Firefox Web Browser');
    assert.equal(parsed.localizedName, '火狐浏览器');
    assert.equal(parsed.exec, '/usr/bin/firefox %u');
    assert.equal(parsed.icon, 'firefox');
    assert.equal(parsed.terminal, false);
    assert.deepEqual(parsed.categories, ['Network', 'WebBrowser']);
    assert.equal(parsed.comment, 'Browse the World Wide Web');
    assert.equal(parsed.startupWMClass, 'firefox');
    assert.equal(parsed.noDisplay, false);
    assert.equal(parsed.hidden, false);
    assert.equal(isValidDesktopApp(parsed), true);
  });

  test('rejects entries where Type is not Application', () => {
    const linkContent = `
[Desktop Entry]
Type=Link
Name=Example Link
URL=https://example.com
    `.trim();

    const dirContent = `
[Desktop Entry]
Type=Directory
Name=Utilities
    `.trim();

    const parsedLink = parseDesktopContent(linkContent);
    const parsedDir = parseDesktopContent(dirContent);

    assert.equal(isValidDesktopApp(parsedLink), false);
    assert.equal(isValidDesktopApp(parsedDir), false);
  });

  test('rejects entries with NoDisplay=true or Hidden=true', () => {
    const noDisplayContent = `
[Desktop Entry]
Type=Application
Name=Hidden Internal Tool
Exec=/usr/bin/tool
NoDisplay=true
    `.trim();

    const hiddenContent = `
[Desktop Entry]
Type=Application
Name=Deprecated App
Exec=/usr/bin/oldapp
Hidden=true
    `.trim();

    const parsedNoDisplay = parseDesktopContent(noDisplayContent);
    const parsedHidden = parseDesktopContent(hiddenContent);

    assert.equal(parsedNoDisplay.noDisplay, true);
    assert.equal(isValidDesktopApp(parsedNoDisplay), false);

    assert.equal(parsedHidden.hidden, true);
    assert.equal(isValidDesktopApp(parsedHidden), false);
  });

  test('does not overwrite [Desktop Entry] with entries from other sections', () => {
    const content = `
[Desktop Entry]
Type=Application
Name=Media Player
Exec=/usr/bin/player %U
Actions=NewWindow;

[Desktop Action NewWindow]
Name=Open New Window
Exec=/usr/bin/player --new-window
    `.trim();

    const parsed = parseDesktopContent(content);
    assert.equal(parsed.name, 'Media Player');
    assert.equal(parsed.exec, '/usr/bin/player %U');
  });

  test('extracts localized names matching different locales', () => {
    const content = `
[Desktop Entry]
Type=Application
Name=GIMP
Name[zh_CN]=GNU 图像处理程序
Name[fr]=Éditeur d'image GIMP
Name[es]=Editor de imágenes GIMP
Exec=gimp-2.10 %F
    `.trim();

    const parsedZh = parseDesktopContent(content, { locale: 'zh_CN.UTF-8' });
    assert.equal(parsedZh.localizedName, 'GNU 图像处理程序');

    const parsedFr = parseDesktopContent(content, { locale: 'fr_FR' });
    assert.equal(parsedFr.localizedName, "Éditeur d'image GIMP");

    const parsedEs = parseDesktopContent(content, { locale: 'es' });
    assert.equal(parsedEs.localizedName, 'Editor de imágenes GIMP');

    const parsedDe = parseDesktopContent(content, { locale: 'de_DE' });
    assert.equal(parsedDe.localizedName, null);
  });

  test('ignores comments and blank lines', () => {
    const content = `
# This is a comment
# Another comment

[Desktop Entry]
# Comment inside section
Type=Application

Name=Calculator
# Name comment
Exec=/usr/bin/calc
    `.trim();

    const parsed = parseDesktopContent(content);
    assert.equal(parsed.type, 'Application');
    assert.equal(parsed.name, 'Calculator');
    assert.equal(parsed.exec, '/usr/bin/calc');
  });

  test('reads from a desktop file on disk using parseDesktopFile', () => {
    const filePath = path.join(testRoot, 'sample.desktop');
    fs.writeFileSync(
      filePath,
      '[Desktop Entry]\nType=Application\nName=Sample\nExec=/bin/sample\n'
    );

    const parsed = parseDesktopFile(filePath);
    assert.equal(parsed.name, 'Sample');
    assert.equal(parsed.exec, '/bin/sample');
  });
});

describe('Exec parsing and argument handling', () => {
  test('strips field codes %u, %U, %f, %F, %i, %c, %k and preserves literal %%', () => {
    assert.equal(stripFieldCodes('/usr/bin/firefox %u'), '/usr/bin/firefox');
    assert.equal(
      stripFieldCodes('/usr/bin/chrome --flag %U --other'),
      '/usr/bin/chrome --flag --other'
    );
    assert.equal(stripFieldCodes('/usr/bin/editor %f'), '/usr/bin/editor');
    assert.equal(stripFieldCodes('gimp %F'), 'gimp');
    assert.equal(stripFieldCodes('app --icon %i %c'), 'app --icon');
    assert.equal(stripFieldCodes('echo "Progress: 100%%"'), 'echo "Progress: 100%"');
  });

  test('strips Flatpak url forwarding markers', () => {
    const flatpakExec = '/usr/bin/flatpak run org.mozilla.firefox @@u %u @@';
    assert.equal(stripFieldCodes(flatpakExec), '/usr/bin/flatpak run org.mozilla.firefox');
  });

  test('tokenizes Exec command line handling quotes and spaces', () => {
    const tokens = tokenizeExec('"/opt/My App/bin/myapp" --flag "hello world"');
    assert.deepEqual(tokens, ['/opt/My App/bin/myapp', '--flag', 'hello world']);
  });

  test('handles escape sequences in Exec string', () => {
    const tokens = tokenizeExec('/usr/bin/app\\ with\\ spaces "arg\\"quote"');
    assert.deepEqual(tokens, ['/usr/bin/app with spaces', 'arg"quote']);
  });

  test('extracts command unwrapping env wrapper', () => {
    const tokens = tokenizeExec('env GDK_BACKEND=x11 FOO=bar /usr/bin/myapp %u');
    const command = extractCommandFromTokens(tokens);
    assert.equal(command, '/usr/bin/myapp');
  });

  test('extracts command unwrapping env with flags', () => {
    const tokens = tokenizeExec('env -u DISPLAY -i /usr/bin/myapp');
    const command = extractCommandFromTokens(tokens);
    assert.equal(command, '/usr/bin/myapp');
  });

  test('extracts command unwrapping sh -c wrapper', () => {
    const tokens = tokenizeExec('sh -c "exec /opt/custom/bin/app --flag"');
    const command = extractCommandFromTokens(tokens);
    assert.equal(command, '/opt/custom/bin/app');
  });

  test('resolves absolute path if file exists', () => {
    const binPath = path.join(testRoot, 'my-binary');
    fs.writeFileSync(binPath, '#!/bin/sh\n');

    const resolved = resolveExecutablePath(binPath);
    assert.equal(resolved, binPath);
  });

  test('returns null for non-existent absolute path when checkExists is true', () => {
    const resolved = resolveExecutablePath('/non/existent/path/binary');
    assert.equal(resolved, null);
  });

  test('resolves bare command name via custom searchDirs', () => {
    const customBinDir = path.join(testRoot, 'custom-bin');
    fs.mkdirSync(customBinDir, { recursive: true });
    const binFile = path.join(customBinDir, 'my-cmd');
    fs.writeFileSync(binFile, '#!/bin/sh\n');

    const resolved = resolveExecutablePath('my-cmd', { searchDirs: [customBinDir] });
    assert.equal(resolved, binFile);
  });

  test('resolves bare command name via custom pathEnv', () => {
    const envBinDir = path.join(testRoot, 'env-bin');
    fs.mkdirSync(envBinDir, { recursive: true });
    const binFile = path.join(envBinDir, 'env-cmd');
    fs.writeFileSync(binFile, '#!/bin/sh\n');

    const resolved = resolveExecutablePath('env-cmd', { pathEnv: envBinDir });
    assert.equal(resolved, binFile);
  });
});

describe('scanLinuxApps', () => {
  let scanDir;
  let userAppsDir;
  let sysAppsDir;
  let binDir;

  before(() => {
    scanDir = path.join(testRoot, 'scan-fixture');
    userAppsDir = path.join(scanDir, 'user-applications');
    sysAppsDir = path.join(scanDir, 'system-applications');
    binDir = path.join(scanDir, 'bin');

    fs.mkdirSync(userAppsDir, { recursive: true });
    fs.mkdirSync(sysAppsDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
  });

  test('scans apps and parses full application objects', () => {
    const appBin = path.join(binDir, 'test-editor');
    fs.writeFileSync(appBin, '#!/bin/sh\n');

    const desktopFile = path.join(sysAppsDir, 'test-editor.desktop');
    fs.writeFileSync(
      desktopFile,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Test Editor',
        'Name[zh_CN]=测试编辑器',
        `Exec=${appBin} %F`,
        'Icon=editor-icon',
        'Categories=Utility;TextEditor;',
        'Comment=A simple text editor',
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
      locale: 'zh_CN',
    });

    assert.equal(apps.length, 1);
    const app = apps[0];
    assert.equal(app.name, 'Test Editor');
    assert.equal(app.localizedName, '测试编辑器');
    assert.equal(app.path, appBin);
    assert.equal(app.desktopFile, desktopFile);
    assert.equal(app.platform, 'linux');
    assert.equal(app.icon, 'editor-icon');
    assert.deepEqual(app.categories, ['Utility', 'TextEditor']);
    assert.equal(app.comment, 'A simple text editor');
  });

  test('user applications directory overrides system applications directory', () => {
    const userBin = path.join(binDir, 'override-user-bin');
    const sysBin = path.join(binDir, 'override-sys-bin');
    fs.writeFileSync(userBin, '#!/bin/sh\n');
    fs.writeFileSync(sysBin, '#!/bin/sh\n');

    const fileName = 'override-app.desktop';
    // User version
    fs.writeFileSync(
      path.join(userAppsDir, fileName),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Overridden App (User)',
        `Exec=${userBin}`,
      ].join('\n')
    );
    // System version
    fs.writeFileSync(
      path.join(sysAppsDir, fileName),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Overridden App (System)',
        `Exec=${sysBin}`,
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [userAppsDir, sysAppsDir],
      applyExclusions: false,
    });

    const matches = apps.filter((a) => a.desktopFile.endsWith(fileName));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, 'Overridden App (User)');
    assert.equal(matches[0].path, userBin);
  });

  test('skips applications whose executable does not exist', () => {
    const desktopFile = path.join(sysAppsDir, 'ghost-app.desktop');
    fs.writeFileSync(
      desktopFile,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Ghost App',
        'Exec=/non/existent/ghost/bin',
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
    });

    assert.equal(apps.some((a) => a.name === 'Ghost App'), false);
  });

  test('skips applications with NoDisplay=true or Hidden=true', () => {
    const validBin = path.join(binDir, 'hidden-check-bin');
    fs.writeFileSync(validBin, '#!/bin/sh\n');

    fs.writeFileSync(
      path.join(sysAppsDir, 'no-display.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=NoDisplay App',
        `Exec=${validBin}`,
        'NoDisplay=true',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(sysAppsDir, 'hidden.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Hidden App',
        `Exec=${validBin}`,
        'Hidden=true',
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
    });

    assert.equal(apps.some((a) => a.name === 'NoDisplay App'), false);
    assert.equal(apps.some((a) => a.name === 'Hidden App'), false);
  });

  test('respects TryExec and skips if TryExec does not exist', () => {
    const validBin = path.join(binDir, 'try-exec-bin');
    fs.writeFileSync(validBin, '#!/bin/sh\n');

    fs.writeFileSync(
      path.join(sysAppsDir, 'try-exec-fail.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=TryExec Fail App',
        `Exec=${validBin}`,
        'TryExec=/non/existent/tool',
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
    });

    assert.equal(apps.some((a) => a.name === 'TryExec Fail App'), false);
  });

  test('resolves relative command name via searchDirs / pathEnv', () => {
    const customBin = path.join(binDir, 'cli-tool');
    fs.writeFileSync(customBin, '#!/bin/sh\n');

    fs.writeFileSync(
      path.join(sysAppsDir, 'cli-tool.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=CLI Tool App',
        'Exec=cli-tool %u',
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
      searchDirs: [binDir],
    });

    const match = apps.find((a) => a.name === 'CLI Tool App');
    assert.ok(match);
    assert.equal(match.path, customBin);
  });

  test('filters out applications matching excludeApps', () => {
    const app = {
      name: 'Google Chrome',
      path: '/usr/bin/google-chrome-stable',
      desktopFile: '/usr/share/applications/google-chrome.desktop',
      localizedName: '谷歌浏览器',
    };

    assert.equal(isExcludedLinuxApp(app, ['Google Chrome']), true);
    assert.equal(isExcludedLinuxApp(app, ['google-chrome']), true);
    assert.equal(isExcludedLinuxApp(app, ['google-chrome.desktop']), true);
    assert.equal(isExcludedLinuxApp(app, ['谷歌浏览器']), true);
    assert.equal(isExcludedLinuxApp(app, ['google-chrome-stable']), true);
    assert.equal(isExcludedLinuxApp(app, ['firefox']), false);
  });

  test('deduplicates multiple desktop files pointing to the same executable', () => {
    const sharedBin = path.join(binDir, 'shared-bin');
    fs.writeFileSync(sharedBin, '#!/bin/sh\n');

    fs.writeFileSync(
      path.join(sysAppsDir, 'shared-1.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Shared App Primary',
        `Exec=${sharedBin}`,
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(sysAppsDir, 'shared-2.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Shared App Secondary',
        `Exec=${sharedBin}`,
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
    });

    const sharedMatches = apps.filter((a) => a.path === sharedBin);
    assert.equal(sharedMatches.length, 1);
  });

  test('falls back to localizedName when base Name is missing', () => {
    const localizedOnlyBin = path.join(binDir, 'localized-only-bin');
    fs.writeFileSync(localizedOnlyBin, '#!/bin/sh\n');

    fs.writeFileSync(
      path.join(sysAppsDir, 'localized-only.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name[zh_CN]=纯中文名称应用',
        `Exec=${localizedOnlyBin}`,
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
      locale: 'zh_CN',
    });

    const match = apps.find((a) => a.path === localizedOnlyBin);
    assert.ok(match);
    assert.equal(match.name, '纯中文名称应用');
  });

  test('resolves unquoted executable paths with spaces in Exec', () => {
    const spaceBinDir = path.join(testRoot, 'Space Dir Name');
    fs.mkdirSync(spaceBinDir, { recursive: true });
    const spaceBin = path.join(spaceBinDir, 'my-runner');
    fs.writeFileSync(spaceBin, '#!/bin/sh\n');

    fs.writeFileSync(
      path.join(sysAppsDir, 'space-exec.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Space Exec App',
        `Exec=${spaceBin} %u`,
      ].join('\n')
    );

    const apps = scanLinuxApps({
      dirs: [sysAppsDir],
      applyExclusions: false,
    });

    const match = apps.find((a) => a.name === 'Space Exec App');
    assert.ok(match);
    assert.equal(match.path, spaceBin);
  });
});

describe('findLinuxAppsByName', () => {
  let searchFixtureDir;
  let appsDir;
  let binDir;

  before(() => {
    searchFixtureDir = path.join(testRoot, 'find-fixture');
    appsDir = path.join(searchFixtureDir, 'applications');
    binDir = path.join(searchFixtureDir, 'bin');

    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });

    const chromeBin = path.join(binDir, 'google-chrome-stable');
    fs.writeFileSync(chromeBin, '#!/bin/sh\n');
    fs.writeFileSync(
      path.join(appsDir, 'google-chrome.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Google Chrome',
        'Name[zh_CN]=谷歌浏览器',
        `Exec=${chromeBin} %U`,
      ].join('\n')
    );

    const codeBin = path.join(binDir, 'code');
    fs.writeFileSync(codeBin, '#!/bin/sh\n');
    fs.writeFileSync(
      path.join(appsDir, 'code.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Visual Studio Code',
        `Exec=${codeBin} %F`,
      ].join('\n')
    );
  });

  test('exact match by English name', () => {
    const results = findLinuxAppsByName('Google Chrome', { dirs: [appsDir] });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Google Chrome');
  });

  test('exact match by localized name', () => {
    const results = findLinuxAppsByName('谷歌浏览器', { dirs: [appsDir], locale: 'zh_CN' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Google Chrome');
  });

  test('match by desktop file name without extension', () => {
    const results = findLinuxAppsByName('google-chrome', { dirs: [appsDir] });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Google Chrome');
  });

  test('match by executable binary name', () => {
    const results = findLinuxAppsByName('code', { dirs: [appsDir] });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Visual Studio Code');
  });

  test('fuzzy match on typos or substrings', () => {
    // "VS Code" contains "Code"
    const results = findLinuxAppsByName('Studio Code', { dirs: [appsDir] });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Visual Studio Code');
  });

  test('returns empty array when no matches found', () => {
    const results = findLinuxAppsByName('NonExistentApp12345', { dirs: [appsDir] });
    assert.deepEqual(results, []);
  });
});

describe('Helper probing utilities', () => {
  let probeDir;

  before(() => {
    probeDir = path.join(testRoot, 'probe-fixture');
    fs.mkdirSync(probeDir, { recursive: true });
  });

  test('isLinuxAppDirectory identifies AppDir with AppRun', () => {
    const appDir = path.join(probeDir, 'MyApp.AppDir');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'AppRun'), '#!/bin/sh\n');

    assert.equal(isLinuxAppDirectory(appDir), true);
  });

  test('isLinuxAppDirectory identifies directory with .desktop file', () => {
    const dir = path.join(probeDir, 'app-with-desktop');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.desktop'), '[Desktop Entry]\nType=Application\n');

    assert.equal(isLinuxAppDirectory(dir), true);
  });

  test('isLinuxAppDirectory identifies directory with binary matching dir name', () => {
    const dir = path.join(probeDir, 'mycustomapp');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'mycustomapp'), '#!/bin/sh\n');

    assert.equal(isLinuxAppDirectory(dir), true);
  });

  test('isLinuxAppDirectory returns false for empty or non-app directory', () => {
    const dir = path.join(probeDir, 'empty-dir');
    fs.mkdirSync(dir, { recursive: true });

    assert.equal(isLinuxAppDirectory(dir), false);
  });

  test('probeLinuxAppDirectory extracts AppDir details', () => {
    const appDir = path.join(probeDir, 'Krita.AppDir');
    fs.mkdirSync(appDir, { recursive: true });
    const appRun = path.join(appDir, 'AppRun');
    fs.writeFileSync(appRun, '#!/bin/sh\n');
    fs.writeFileSync(
      path.join(appDir, 'krita.desktop'),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Krita Painting',
        'Icon=krita',
        'Exec=krita %F',
      ].join('\n')
    );

    const probed = probeLinuxAppDirectory(appDir);
    assert.ok(probed);
    assert.equal(probed.name, 'Krita Painting');
    assert.equal(probed.path, appRun);
    assert.equal(probed.appDir, appDir);
    assert.equal(probed.platform, 'linux');
    assert.equal(probed.icon, 'krita');
  });

  test('probeLinuxBinary finds associated .desktop file if present', () => {
    const appsDir = path.join(probeDir, 'applications');
    const binDir = path.join(probeDir, 'bin');
    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });

    const binaryPath = path.join(binDir, 'sublime_text');
    fs.writeFileSync(binaryPath, '#!/bin/sh\n');

    const desktopPath = path.join(appsDir, 'sublime_text.desktop');
    fs.writeFileSync(
      desktopPath,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Sublime Text',
        `Exec=${binaryPath} %F`,
        'Icon=sublime-text',
      ].join('\n')
    );

    const probed = probeLinuxBinary(binaryPath, { dirs: [appsDir] });
    assert.ok(probed);
    assert.equal(probed.name, 'Sublime Text');
    assert.equal(probed.path, binaryPath);
    assert.equal(probed.desktopFile, desktopPath);
    assert.equal(probed.platform, 'linux');
  });

  test('probeLinuxBinary falls back gracefully without .desktop file', () => {
    const rawBin = path.join(probeDir, 'standalone-tool');
    fs.writeFileSync(rawBin, '#!/bin/sh\n');

    const probed = probeLinuxBinary(rawBin, { dirs: [] });
    assert.ok(probed);
    assert.equal(probed.name, 'standalone-tool');
    assert.equal(probed.path, rawBin);
    assert.equal(probed.desktopFile, null);
    assert.equal(probed.platform, 'linux');
  });

  test('probeLinuxApp delegates to desktop file, directory, or binary', () => {
    const binFile = path.join(probeDir, 'probed-binary');
    fs.writeFileSync(binFile, '#!/bin/sh\n');

    const desktopFile = path.join(probeDir, 'probed.desktop');
    fs.writeFileSync(
      desktopFile,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Probed App',
        `Exec=${binFile}`,
      ].join('\n')
    );

    // 1. Desktop file target
    const probedDesktop = probeLinuxApp(desktopFile);
    assert.equal(probedDesktop.name, 'Probed App');
    assert.equal(probedDesktop.path, binFile);

    // 2. Binary target
    const probedBin = probeLinuxApp(binFile);
    assert.equal(probedBin.name, 'probed-binary');
    assert.equal(probedBin.path, binFile);

    // 3. AppDir directory target
    const appDir = path.join(probeDir, 'SampleApp.AppDir');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'AppRun'), '#!/bin/sh\n');
    const probedDir = probeLinuxApp(appDir);
    assert.equal(probedDir.name, 'SampleApp.AppDir');
    assert.equal(probedDir.path, path.join(appDir, 'AppRun'));
  });

  test('findDesktopFileForExecutable locates .desktop file matching executable path', () => {
    const appsDir = path.join(probeDir, 'find-desktop-apps');
    fs.mkdirSync(appsDir, { recursive: true });

    const targetBin = path.join(probeDir, 'target-bin');
    fs.writeFileSync(targetBin, '#!/bin/sh\n');

    const desktopPath = path.join(appsDir, 'target.desktop');
    fs.writeFileSync(
      desktopPath,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Target App',
        `Exec=${targetBin} %u`,
      ].join('\n')
    );

    const found = findDesktopFileForExecutable(targetBin, { dirs: [appsDir] });
    assert.equal(found, desktopPath);

    const notFound = findDesktopFileForExecutable('/no/such/bin', { dirs: [appsDir] });
    assert.equal(notFound, null);
  });

  test('getLinuxAppDirectories includes all required Linux system, user, flatpak, and snap paths', () => {
    const allDirs = getLinuxAppDirectories({ checkExists: false });
    assert.ok(allDirs.includes('/usr/share/applications'));
    assert.ok(allDirs.includes('/usr/local/share/applications'));
    assert.ok(allDirs.includes('/var/lib/flatpak/exports/share/applications'));
    assert.ok(allDirs.includes('/var/lib/snapd/desktop/applications'));
    assert.ok(
      allDirs.some((d) => d.includes('.local/share/applications'))
    );
    assert.ok(
      allDirs.some((d) => d.includes('.local/share/flatpak/exports/share/applications'))
    );
  });
});
