import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from './config.js';

/**
 * Get all application directories for the current platform.
 * @returns {{ paths: string[], platform: string }}
 */
export function getAppDirectories() {
  const platform = process.platform;

  if (platform === 'darwin') {
    return {
      platform,
      paths: [
        '/Applications',
        path.join(os.homedir(), 'Applications'),
      ].filter((p) => fs.existsSync(p)),
    };
  }

  if (platform === 'win32') {
    const programFiles = [
      process.env['ProgramFiles'] || 'C:\\Program Files',
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      process.env['LOCALAPPDATA'] ? path.join(process.env['LOCALAPPDATA'], 'Programs') : null,
    ].filter(Boolean).filter((p) => fs.existsSync(p));

    return { platform, paths: programFiles };
  }

  return { platform, paths: [] };
}

/**
 * List all .app bundles in a macOS directory (non-recursive, shallow).
 * @param {string} dir
 * @returns {string[]} Array of full .app paths
 */
function listMacOSApps(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.app'))
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/**
 * List all top-level subdirectories in a Windows Program Files directory.
 * Each subdirectory is treated as an application.
 * @param {string} dir
 * @returns {string[]} Array of full directory paths
 */
function listWindowsApps(dir) {
  try {
    return fs
      .readdirSync(dir)
      .map((name) => path.join(dir, name))
      .filter((p) => {
        try {
          return fs.statSync(p).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function readMacBundleId(appPath) {
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  try {
    const content = fs.readFileSync(plistPath, 'utf8');
    return content.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1] || '';
  } catch {
    return '';
  }
}

function normalizeMatchValue(value) {
  return value.toLowerCase().replace(/\.app$/i, '').trim();
}

function isExcludedApp(app, excludeApps, bundleId = '') {
  if (excludeApps.length === 0) return false;

  const candidates = [
    app.name,
    path.basename(app.path),
    app.path,
    bundleId,
  ]
    .filter(Boolean)
    .map(normalizeMatchValue);

  return excludeApps.some((entry) => {
    const normalizedEntry = normalizeMatchValue(entry);
    return candidates.some((candidate) => candidate === normalizedEntry);
  });
}

/**
 * Scan all application directories and return a flat list of app entries.
 * @param {{ applyExclusions?: boolean }} [opts]
 * @returns {{ name: string, path: string, platform: string }[]}
 */
export function scanAllApps({ applyExclusions = true } = {}) {
  const { paths, platform } = getAppDirectories();
  const { excludeApps } = applyExclusions ? loadConfig() : { excludeApps: [] };
  const apps = [];
  const seen = new Set();

  for (const dir of paths) {
    const appPaths =
      platform === 'darwin' ? listMacOSApps(dir) : listWindowsApps(dir);

    for (const appPath of appPaths) {
      if (seen.has(appPath)) continue;
      seen.add(appPath);

      const name = platform === 'darwin'
        ? path.basename(appPath, '.app')
        : path.basename(appPath);
      const app = { name, path: appPath, platform };
      const bundleId = platform === 'darwin' && excludeApps.length > 0
        ? readMacBundleId(appPath)
        : '';

      if (isExcludedApp(app, excludeApps, bundleId)) continue;

      apps.push(app);
    }
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find apps by name (case-insensitive fuzzy match).
 * @param {string} query
 * @returns {{ name: string, path: string, platform: string }[]}
 */
export function findAppsByName(query) {
  const all = scanAllApps({ applyExclusions: false });
  const lower = query.toLowerCase().replace(/\s+/g, '');

  // Exact match first
  const exact = all.filter((app) => app.name.toLowerCase() === query.toLowerCase());
  if (exact.length > 0) return exact;

  // Fuzzy: name contains query or query contains name
  return all.filter((app) => {
    const appName = app.name.toLowerCase().replace(/\s+/g, '');
    return (
      appName.includes(lower) ||
      lower.includes(appName) ||
      levenshtein(appName, lower) <= 2
    );
  });
}

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}
