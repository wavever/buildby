import assert from 'node:assert/strict';
import { describe, test, beforeEach, afterEach } from 'node:test';
import fs from 'fs';
import path from 'path';

import { getBinaryArchitecture, getMachOLinkedLibraries } from '../src/binary.js';
import { detectStack, DETECTORS, ALL_STACK_METAS } from '../src/detectors/index.js';
import { detect as detectNeutralino } from '../src/detectors/neutralino.js';
import { detect as detectSciter } from '../src/detectors/sciter.js';
import { makeMacApp, makeWindowsApp, makeTempDir, rmDir } from './helpers.js';

// Helpers to create binary headers for testing
function createDylibCommand(cmdType, dylibPath) {
  const pathBuf = Buffer.from(dylibPath + '\0', 'utf8');
  const nameOffset = 24;
  const rawSize = nameOffset + pathBuf.length;
  const cmdsize = (rawSize + 7) & ~7;
  const buf = Buffer.alloc(cmdsize);
  buf.writeUInt32LE(cmdType, 0);
  buf.writeUInt32LE(cmdsize, 4);
  buf.writeUInt32LE(nameOffset, 8);
  buf.writeUInt32LE(0, 12);
  buf.writeUInt32LE(0x00010000, 16);
  buf.writeUInt32LE(0x00010000, 20);
  pathBuf.copy(buf, nameOffset);
  return buf;
}

function createMachO64(cputype, loadCommands = [], isLE = true) {
  const headerSize = 32;
  let sizeofcmds = 0;
  for (const cmd of loadCommands) sizeofcmds += cmd.length;
  const buf = Buffer.alloc(headerSize + sizeofcmds);
  if (isLE) {
    buf.writeUInt32LE(0xfeedfacf, 0);
    buf.writeUInt32LE(cputype, 4);
    buf.writeUInt32LE(0x80000002, 8);
    buf.writeUInt32LE(2, 12);
    buf.writeUInt32LE(loadCommands.length, 16);
    buf.writeUInt32LE(sizeofcmds, 20);
    buf.writeUInt32LE(0, 24);
    buf.writeUInt32LE(0, 28);
  } else {
    buf.writeUInt32BE(0xfeedfacf, 0);
    buf.writeUInt32BE(cputype, 4);
    buf.writeUInt32BE(0x80000002, 8);
    buf.writeUInt32BE(2, 12);
    buf.writeUInt32BE(loadCommands.length, 16);
    buf.writeUInt32BE(sizeofcmds, 20);
    buf.writeUInt32BE(0, 24);
    buf.writeUInt32BE(0, 28);
  }
  let offset = headerSize;
  for (const cmd of loadCommands) {
    cmd.copy(buf, offset);
    offset += cmd.length;
  }
  return buf;
}

function createMachO32(cputype, isLE = true) {
  const buf = Buffer.alloc(28);
  if (isLE) {
    buf.writeUInt32LE(0xfeedface, 0);
    buf.writeUInt32LE(cputype, 4);
    buf.writeUInt32LE(3, 8);
    buf.writeUInt32LE(2, 12);
    buf.writeUInt32LE(0, 16);
    buf.writeUInt32LE(0, 20);
    buf.writeUInt32LE(0, 24);
  } else {
    buf.writeUInt32BE(0xfeedface, 0);
    buf.writeUInt32BE(cputype, 4);
    buf.writeUInt32BE(3, 8);
    buf.writeUInt32BE(2, 12);
    buf.writeUInt32BE(0, 16);
    buf.writeUInt32BE(0, 20);
    buf.writeUInt32BE(0, 24);
  }
  return buf;
}

function createFatBinary(slices) {
  const nfat = slices.length;
  const fatHeaderSize = 8 + nfat * 20;
  let curOffset = Math.ceil(fatHeaderSize / 16) * 16;
  const offsets = [];
  for (const s of slices) {
    offsets.push(curOffset);
    curOffset += Math.ceil(s.data.length / 16) * 16;
  }
  const buf = Buffer.alloc(curOffset);
  buf.writeUInt32BE(0xcafebabe, 0);
  buf.writeUInt32BE(nfat, 4);
  for (let i = 0; i < nfat; i++) {
    const archOffset = 8 + i * 20;
    buf.writeUInt32BE(slices[i].cputype, archOffset);
    buf.writeUInt32BE(3, archOffset + 4);
    buf.writeUInt32BE(offsets[i], archOffset + 8);
    buf.writeUInt32BE(slices[i].data.length, archOffset + 12);
    buf.writeUInt32BE(4, archOffset + 16);
    slices[i].data.copy(buf, offsets[i]);
  }
  return buf;
}

function createPEBinary(machine) {
  const e_lfanew = 0x80;
  const buf = Buffer.alloc(e_lfanew + 24);
  buf.writeUInt16LE(0x5a4d, 0); // 'MZ'
  buf.writeUInt32LE(e_lfanew, 0x3c);
  buf.writeUInt32LE(0x00004550, e_lfanew); // 'PE\0\0'
  buf.writeUInt16LE(machine, e_lfanew + 4);
  return buf;
}

function createELFBinary(machine, isLE = true) {
  const buf = Buffer.alloc(64);
  buf[0] = 0x7f;
  buf[1] = 0x45; // 'E'
  buf[2] = 0x4c; // 'L'
  buf[3] = 0x46; // 'F'
  buf[4] = 2; // ELFCLASS64
  buf[5] = isLE ? 1 : 2; // EI_DATA
  if (isLE) {
    buf.writeUInt16LE(machine, 18);
  } else {
    buf.writeUInt16BE(machine, 18);
  }
  return buf;
}

describe('Binary architecture detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir('binarch');
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  test('Mach-O 64-bit arm64 and x86_64 thin binaries', () => {
    const arm64File = path.join(tmpDir, 'arm64_bin');
    fs.writeFileSync(arm64File, createMachO64(0x0100000c));
    assert.equal(getBinaryArchitecture(arm64File, 'darwin'), 'arm64');

    const x86File = path.join(tmpDir, 'x86_64_bin');
    fs.writeFileSync(x86File, createMachO64(0x01000007));
    assert.equal(getBinaryArchitecture(x86File, 'darwin'), 'x86_64');
  });

  test('Mach-O 32-bit binaries', () => {
    const x86File = path.join(tmpDir, 'x86_32_bin');
    fs.writeFileSync(x86File, createMachO32(0x00000007));
    assert.equal(getBinaryArchitecture(x86File, 'darwin'), 'x86');
  });

  test('Mach-O FAT / Universal binaries', () => {
    const armSlice = createMachO64(0x0100000c);
    const x86Slice = createMachO64(0x01000007);

    // Both arm64 and x86_64 -> universal
    const universalFile = path.join(tmpDir, 'universal_bin');
    fs.writeFileSync(universalFile, createFatBinary([
      { cputype: 0x01000007, data: x86Slice },
      { cputype: 0x0100000c, data: armSlice },
    ]));
    assert.equal(getBinaryArchitecture(universalFile, 'darwin'), 'universal');

    // Single-slice FAT
    const singleFatArm = path.join(tmpDir, 'single_arm_fat');
    fs.writeFileSync(singleFatArm, createFatBinary([
      { cputype: 0x0100000c, data: armSlice },
    ]));
    assert.equal(getBinaryArchitecture(singleFatArm, 'darwin'), 'arm64');

    const singleFatX86 = path.join(tmpDir, 'single_x86_fat');
    fs.writeFileSync(singleFatX86, createFatBinary([
      { cputype: 0x01000007, data: x86Slice },
    ]));
    assert.equal(getBinaryArchitecture(singleFatX86, 'darwin'), 'x86_64');
  });

  test('Windows PE architecture detection', () => {
    const pe64 = path.join(tmpDir, 'test64.exe');
    fs.writeFileSync(pe64, createPEBinary(0x8664));
    assert.equal(getBinaryArchitecture(pe64, 'win32'), 'x86_64');

    const pe32 = path.join(tmpDir, 'test32.exe');
    fs.writeFileSync(pe32, createPEBinary(0x014c));
    assert.equal(getBinaryArchitecture(pe32, 'win32'), 'x86');

    const peArm64 = path.join(tmpDir, 'test_arm64.exe');
    fs.writeFileSync(peArm64, createPEBinary(0xaa64));
    assert.equal(getBinaryArchitecture(peArm64, 'win32'), 'arm64');
  });

  test('Linux ELF architecture detection', () => {
    const elf64 = path.join(tmpDir, 'elf64');
    fs.writeFileSync(elf64, createELFBinary(0x3e));
    assert.equal(getBinaryArchitecture(elf64, 'linux'), 'x86_64');

    const elfArm64 = path.join(tmpDir, 'elf_arm64');
    fs.writeFileSync(elfArm64, createELFBinary(0xb7));
    assert.equal(getBinaryArchitecture(elfArm64, 'linux'), 'arm64');

    const elf32 = path.join(tmpDir, 'elf32');
    fs.writeFileSync(elf32, createELFBinary(0x03));
    assert.equal(getBinaryArchitecture(elf32, 'linux'), 'x86');
  });

  test('Unrecognized or non-existent file returns unknown', () => {
    assert.equal(getBinaryArchitecture('/non/existent/path'), 'unknown');

    const textFile = path.join(tmpDir, 'plain.txt');
    fs.writeFileSync(textFile, 'Just plain text file');
    assert.equal(getBinaryArchitecture(textFile), 'unknown');
  });

  test('Real binary detection on macOS host', { skip: process.platform !== 'darwin' }, () => {
    if (fs.existsSync('/bin/ls')) {
      const arch = getBinaryArchitecture('/bin/ls', 'darwin');
      assert.ok(['universal', 'arm64', 'x86_64'].includes(arch));
    }
  });
});

describe('Mach-O load commands linked library parser', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir('macholibs');
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  test('extracts LC_LOAD_DYLIB, LC_LOAD_WEAK_DYLIB, and LC_REEXPORT_DYLIB', () => {
    const cmd1 = createDylibCommand(0x0c, '/System/Library/Frameworks/WebKit.framework/WebKit');
    const cmd2 = createDylibCommand(0x80000018, '/usr/lib/libSystem.B.dylib');
    const cmd3 = createDylibCommand(0x8000001f, '/System/Library/Frameworks/AppKit.framework/AppKit');

    const bin = path.join(tmpDir, 'mock_app');
    fs.writeFileSync(bin, createMachO64(0x0100000c, [cmd1, cmd2, cmd3]));

    const libs = getMachOLinkedLibraries(bin);
    assert.deepEqual(libs, [
      '/System/Library/Frameworks/WebKit.framework/WebKit',
      '/usr/lib/libSystem.B.dylib',
      '/System/Library/Frameworks/AppKit.framework/AppKit',
    ]);
  });

  test('extracts linked libraries from FAT binary slice', () => {
    const cmd1 = createDylibCommand(0x0c, '/System/Library/Frameworks/WebKit.framework/WebKit');
    const slice64 = createMachO64(0x0100000c, [cmd1]);
    const slice32 = createMachO32(0x00000007);

    const bin = path.join(tmpDir, 'mock_fat');
    fs.writeFileSync(bin, createFatBinary([
      { cputype: 0x00000007, data: slice32 },
      { cputype: 0x0100000c, data: slice64 },
    ]));

    const libs = getMachOLinkedLibraries(bin);
    assert.deepEqual(libs, ['/System/Library/Frameworks/WebKit.framework/WebKit']);
  });

  test('returns empty array on non-Mach-O or missing file', () => {
    assert.deepEqual(getMachOLinkedLibraries('/non/existent'), []);

    const empty = path.join(tmpDir, 'empty');
    fs.writeFileSync(empty, Buffer.alloc(10));
    assert.deepEqual(getMachOLinkedLibraries(empty), []);
  });

  test('reads libraries on host system binary', { skip: process.platform !== 'darwin' }, () => {
    if (fs.existsSync('/bin/ls')) {
      const libs = getMachOLinkedLibraries('/bin/ls');
      assert.ok(Array.isArray(libs));
      assert.ok(libs.length > 0);
      assert.ok(libs.some((l) => l.includes('libSystem')));
    }
  });
});

describe('Detector optimizations and version extraction', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir('detectopt');
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  test('Tauri detector differentiates v1 and v2 variants', () => {
    // Tauri v2 (contains v2 marker, no external index.html)
    const appV2 = makeWindowsApp(tmpDir, 'TauriV2App', {
      files: ['WebView2Loader.dll'],
      executableBody: 'noise tauri-runtime-wry/2.0.0 noise',
    });
    const resV2 = detectStack(appV2, 'win32');
    assert.equal(resV2.id, 'tauri');
    assert.equal(resV2.variant, 'v2');

    // Tauri v1 (contains external index.html)
    const appV1 = makeMacApp(tmpDir, 'TauriV1App', {
      files: ['Contents/Resources/index.html'],
      executableBody: 'noise tauri-runtime-wry noise',
    });
    const resV1 = detectStack(appV1, 'darwin');
    assert.equal(resV1.id, 'tauri');
    assert.equal(resV1.variant, 'v1');
  });

  test('Electron extracts frameworkVersion from Info.plist or version file', () => {
    // macOS Electron app with Info.plist
    const macApp = makeMacApp(tmpDir, 'ElectronMac', {
      files: [
        'Contents/Frameworks/Electron Framework.framework/Resources/Info.plist',
        'Contents/Resources/app.asar',
      ],
    });
    fs.writeFileSync(
      path.join(macApp, 'Contents/Frameworks/Electron Framework.framework/Resources/Info.plist'),
      '<?xml version="1.0"?><plist><dict><key>CFBundleShortVersionString</key><string>32.1.0</string></dict></plist>'
    );
    const macRes = detectStack(macApp, 'darwin');
    assert.equal(macRes.id, 'electron');
    assert.equal(macRes.frameworkVersion, '32.1.0');

    // Windows Electron app with version file
    const winApp = makeWindowsApp(tmpDir, 'ElectronWin', {
      files: ['resources/app.asar', 'version'],
    });
    fs.writeFileSync(path.join(winApp, 'version'), 'v31.2.0\n');
    const winRes = detectStack(winApp, 'win32');
    assert.equal(winRes.id, 'electron');
    assert.equal(winRes.frameworkVersion, '31.2.0');
  });

  test('Flutter extracts frameworkVersion from version.json', () => {
    const app = makeMacApp(tmpDir, 'FlutterApp', {
      files: [
        'Contents/Frameworks/FlutterMacOS.framework',
        'Contents/Frameworks/App.framework/flutter_assets/version.json',
      ],
    });
    fs.writeFileSync(
      path.join(app, 'Contents/Frameworks/App.framework/flutter_assets/version.json'),
      JSON.stringify({ app_name: 'demo', version: '3.24.1', build_number: '42' })
    );
    const res = detectStack(app, 'darwin');
    assert.equal(res.id, 'flutter');
    assert.equal(res.frameworkVersion, '3.24.1');
  });

  test('Qt extracts frameworkVersion from QtCore Info.plist', () => {
    const app = makeMacApp(tmpDir, 'QtApp', {
      files: [
        'Contents/Frameworks/QtCore.framework/Resources/Info.plist',
      ],
    });
    fs.writeFileSync(
      path.join(app, 'Contents/Frameworks/QtCore.framework/Resources/Info.plist'),
      '<?xml version="1.0"?><plist><dict><key>CFBundleShortVersionString</key><string>6.7.2</string></dict></plist>'
    );
    const res = detectStack(app, 'darwin');
    assert.equal(res.id, 'qt');
    assert.equal(res.frameworkVersion, '6.7.2');
  });
});

describe('New framework detectors: Neutralinojs and Sciter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir('newdetect');
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  test('Neutralinojs detection on macOS and Windows', () => {
    // macOS via neutralino.config.json in Resources
    const macApp = makeMacApp(tmpDir, 'NeuMac', {
      files: ['Contents/Resources/neutralino.config.json', 'Contents/Resources/res.neu'],
    });
    const macRes = detectStack(macApp, 'darwin');
    assert.equal(macRes.id, 'neutralino');
    assert.equal(macRes.category, 'cross-platform');

    // Windows via neutralino.config.json
    const winApp = makeWindowsApp(tmpDir, 'NeuWin', {
      files: ['neutralino.config.json', 'res.neu'],
    });
    const winRes = detectStack(winApp, 'win32');
    assert.equal(winRes.id, 'neutralino');

    // Windows via binary marker
    const winBinApp = makeWindowsApp(tmpDir, 'NeuBin', {
      executableBody: 'noise NL_NAME neutralino app noise',
    });
    const winBinRes = detectStack(winBinApp, 'win32');
    assert.equal(winBinRes.id, 'neutralino');
  });

  test('Sciter detection on macOS and Windows', () => {
    // Windows via sciter.dll
    const winApp = makeWindowsApp(tmpDir, 'SciterWin', {
      files: ['sciter.dll'],
    });
    const winRes = detectStack(winApp, 'win32');
    assert.equal(winRes.id, 'sciter');
    assert.equal(winRes.category, 'cross-platform');

    // macOS via libsciter.dylib in Frameworks
    const macApp = makeMacApp(tmpDir, 'SciterMac', {
      files: ['Contents/Frameworks/libsciter.dylib'],
    });
    const macRes = detectStack(macApp, 'darwin');
    assert.equal(macRes.id, 'sciter');

    // Executable with SciterCreate marker
    const binApp = makeWindowsApp(tmpDir, 'SciterBin', {
      executableBody: 'some text SciterCreate and sciter::dom more text',
    });
    const binRes = detectStack(binApp, 'win32');
    assert.equal(binRes.id, 'sciter');
  });

  test('Detectors registered in index.js and metadata list', () => {
    const detectorIds = DETECTORS.map((d) => d.meta.id);
    assert.ok(detectorIds.includes('neutralino'));
    assert.ok(detectorIds.includes('sciter'));

    const metaIds = ALL_STACK_METAS.map((m) => m.id);
    assert.ok(metaIds.includes('neutralino'));
    assert.ok(metaIds.includes('sciter'));
  });
});
