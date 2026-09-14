import fs from 'fs';
import path from 'path';

/**
 * readdirSync that returns [] instead of throwing on missing/unreadable dirs.
 * @param {string} dir
 * @returns {string[]}
 */
export function listDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * List a macOS Contents/Frameworks directory plus one level of nesting.
 *
 * Some vendors group their bundled frameworks in a subdirectory
 * (WPS Office ships Qt under `Contents/Frameworks/office6/`), which a
 * top-level-only scan misses entirely.
 *
 * @param {string} frameworksDir
 * @returns {{ name: string, dir: string }[]} entry name + the directory holding it
 */
export function listFrameworksDeep(frameworksDir) {
  const entries = [];

  for (const name of listDir(frameworksDir)) {
    entries.push({ name, dir: frameworksDir });

    // Only descend into plain directories, never into bundles themselves.
    if (name.endsWith('.framework') || name.includes('.')) continue;

    const nested = path.join(frameworksDir, name);
    try {
      if (!fs.statSync(nested).isDirectory()) continue;
    } catch {
      continue;
    }

    for (const child of listDir(nested)) {
      entries.push({ name: child, dir: nested });
    }
  }

  return entries;
}

/**
 * Resolve a macOS app's main executable from Info.plist, falling back to the
 * first entry in Contents/MacOS.
 * @param {string} appPath
 * @returns {string|null}
 */
export function resolveMainExecutable(appPath) {
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');

  try {
    const content = fs.readFileSync(plistPath, 'utf8');
    const m = content.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/);
    if (m) {
      const p = path.join(macosDir, m[1]);
      if (fs.existsSync(p)) return p;
    }
  } catch { /* fall through to directory listing */ }

  for (const entry of listDir(macosDir)) {
    const p = path.join(macosDir, entry);
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * Find the primary .exe in a Windows app directory, preferring one that
 * matches the directory name.
 * @param {string} appPath
 * @returns {string|null}
 */
export function resolveWindowsExecutable(appPath) {
  const exes = listDir(appPath).filter((f) => f.toLowerCase().endsWith('.exe'));
  if (exes.length === 0) return null;

  const dirName = path.basename(appPath).toLowerCase();
  const match = exes.find((e) => e.toLowerCase().replace(/\.exe$/, '') === dirName);
  return path.join(appPath, match || exes[0]);
}

const CHUNK_SIZE = 1 << 20; // 1 MiB

/**
 * Stream-search a binary for any of `needles` without buffering the file.
 *
 * Reads in 1 MiB chunks with an overlap window so matches straddling a chunk
 * boundary are still found, and returns as soon as one hits. This keeps the
 * probe affordable on very large executables, and far cheaper than it looks
 * when the marker appears early.
 *
 * @param {string} binPath
 * @param {string[]} needles
 * @param {{ maxBytes?: number }} [options]
 * @returns {string|null} the first needle found, or null
 */
export function binaryContainsAny(binPath, needles, { maxBytes = Infinity } = {}) {
  if (needles.length === 0) return null;

  const patterns = needles.map((n) => Buffer.from(n, 'binary'));
  const overlap = Math.max(...patterns.map((p) => p.length)) - 1;

  let fd;
  try {
    fd = fs.openSync(binPath, 'r');
    const buf = Buffer.alloc(overlap + CHUNK_SIZE);
    let carry = 0;
    let consumed = 0;

    while (consumed < maxBytes) {
      const bytes = fs.readSync(fd, buf, carry, CHUNK_SIZE, null);
      if (bytes <= 0) break;

      const view = buf.subarray(0, carry + bytes);
      for (let i = 0; i < patterns.length; i++) {
        if (view.includes(patterns[i])) return needles[i];
      }

      consumed += bytes;
      carry = Math.min(overlap, view.length);
      view.subarray(view.length - carry).copy(buf, 0);
    }
  } catch {
    // Unreadable or non-regular file — treat as "no match".
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }

  return null;
}

/**
 * Convenience wrapper: does the binary contain this single marker?
 * @param {string} binPath
 * @param {string} needle
 * @param {{ maxBytes?: number }} [options]
 * @returns {boolean}
 */
export function binaryContains(binPath, needle, options) {
  return binaryContainsAny(binPath, [needle], options) !== null;
}
