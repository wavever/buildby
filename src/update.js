import { execFile, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export const PACKAGE_NAME = '@wavever/buildby';

/**
 * npm ships as a .cmd shim on Windows, which execFile/spawn cannot launch by
 * the bare name.
 */
function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

/**
 * Compare two semver-ish version strings.
 *
 * Deliberately dependency-free: only the subset this CLI actually publishes
 * needs to work — three numeric parts plus an optional prerelease tag.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareVersions(a, b) {
  const parse = (value) => {
    const [core, ...rest] = String(value).trim().replace(/^v/, '').split('-');
    return {
      nums: core.split('.').map((n) => Number.parseInt(n, 10) || 0),
      pre: rest.length > 0 ? rest.join('-') : null,
    };
  };

  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < 3; i++) {
    const diff = (left.nums[i] || 0) - (right.nums[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  // A prerelease sorts below its own release: 1.3.0-beta.1 < 1.3.0
  if (left.pre && !right.pre) return -1;
  if (!left.pre && right.pre) return 1;
  if (left.pre && right.pre && left.pre !== right.pre) return left.pre < right.pre ? -1 : 1;

  return 0;
}

/**
 * Absolute path to the root of the running buildby package.
 * @returns {string}
 */
export function getPackageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Classify how this copy of buildby is installed.
 *
 * Node resolves symlinks when loading ESM, so an `npm link`ed CLI reports the
 * checkout it points at rather than the global node_modules entry — which is
 * what we want, since `npm install -g` would silently clobber that link.
 *
 * @param {string} [packageRoot]
 * @returns {'npm'|'local'} 'npm' when npm owns this copy and can replace it
 */
export function detectInstallKind(packageRoot = getPackageRoot()) {
  const normalized = packageRoot.split(path.sep).join('/');
  return normalized.includes('/node_modules/') ? 'npm' : 'local';
}

/**
 * Ask npm for the latest published version.
 *
 * Goes through `npm view` rather than querying a registry URL directly so the
 * user's own npm configuration — registry mirror, proxy, auth — is respected.
 *
 * @param {string} [packageName]
 * @returns {Promise<string|null>} the version, or null if it could not be read
 */
export function fetchLatestVersion(packageName = PACKAGE_NAME) {
  return new Promise((resolve) => {
    execFile(
      npmBin(),
      ['view', packageName, 'version'],
      { timeout: 30000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(null);
        const version = String(stdout).trim();
        resolve(/^\d+\.\d+\.\d+/.test(version) ? version : null);
      },
    );
  });
}

/**
 * Run the global install, streaming npm's own output so the user sees progress
 * and any diagnostics verbatim.
 *
 * @param {string} [packageName]
 * @returns {Promise<{ ok: boolean, code: number|null }>}
 */
export function runGlobalInstall(packageName = PACKAGE_NAME) {
  return new Promise((resolve) => {
    const child = spawn(npmBin(), ['install', '-g', `${packageName}@latest`], {
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('close', (code) => resolve({ ok: code === 0, code }));
    child.on('error', () => resolve({ ok: false, code: null }));
  });
}
