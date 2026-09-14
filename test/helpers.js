import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Create a scratch directory that the caller is responsible for removing.
 * @param {string} label
 * @returns {string}
 */
export function makeTempDir(label = 'buildby-test') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
}

export function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(filePath, contents = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

/**
 * Build a minimal macOS .app bundle.
 *
 * @param {string} root - directory to create the bundle in
 * @param {string} name - bundle name without the .app suffix
 * @param {object} spec
 * @param {string} [spec.executable] - name of the file in Contents/MacOS
 * @param {string} [spec.executableBody] - bytes to write into that executable
 * @param {string[]} [spec.files] - paths relative to the bundle root to touch
 * @returns {string} full path to the bundle
 */
export function makeMacApp(root, name, spec = {}) {
  const {
    executable = 'main',
    executableBody = '',
    files = [],
  } = spec;

  const bundle = path.join(root, `${name}.app`);

  writeFile(
    path.join(bundle, 'Contents', 'Info.plist'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<plist version="1.0"><dict>',
      `<key>CFBundleExecutable</key><string>${executable}</string>`,
      `<key>CFBundleIdentifier</key><string>test.${name}</string>`,
      '<key>CFBundleShortVersionString</key><string>1.2.3</string>',
      '</dict></plist>',
    ].join('\n'),
  );

  writeFile(path.join(bundle, 'Contents', 'MacOS', executable), executableBody);

  for (const rel of files) {
    if (rel.endsWith('/')) {
      fs.mkdirSync(path.join(bundle, rel), { recursive: true });
    } else {
      writeFile(path.join(bundle, rel));
    }
  }

  return bundle;
}

/**
 * Build a minimal Windows app directory.
 *
 * @param {string} root
 * @param {string} name
 * @param {object} spec
 * @param {string} [spec.executable] - exe file name
 * @param {string} [spec.executableBody]
 * @param {string[]} [spec.files] - paths relative to the app dir
 * @returns {string} full path to the app directory
 */
export function makeWindowsApp(root, name, spec = {}) {
  const {
    executable = `${name}.exe`,
    executableBody = '',
    files = [],
  } = spec;

  const dir = path.join(root, name);
  writeFile(path.join(dir, executable), executableBody);

  for (const rel of files) {
    if (rel.endsWith('/')) {
      fs.mkdirSync(path.join(dir, rel), { recursive: true });
    } else {
      writeFile(path.join(dir, rel));
    }
  }

  return dir;
}
