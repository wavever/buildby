import { execFile, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { t, LOCALE } from './i18n.js';
import { setupInputListener } from './interactive.js';

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
 * Fast check for latest version via HTTP fetch with short timeout.
 * Returns version string or null if timed out / offline.
 *
 * @param {string} [packageName]
 * @param {number} [timeoutMs=2000]
 * @returns {Promise<string|null>}
 */
export async function fetchLatestVersionFast(packageName = PACKAGE_NAME, timeoutMs = 2000) {
  const registry = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/+$/, '');
  const encodedName = packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);
  const url = `${registry}/${encodedName}/latest`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = await res.json();
    const version = data && typeof data.version === 'string' ? data.version.trim() : null;
    return version && /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch {
    return null;
  }
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

/**
 * Render Codex-style rounded notification box with options.
 *
 * @param {object} params
 * @param {string} params.currentVersion
 * @param {string} params.latestVersion
 * @param {number} [params.selectedIndex=0]
 * @param {boolean} [params.isZh]
 * @returns {string}
 */
export function renderUpdateBox({
  currentVersion,
  latestVersion,
  selectedIndex = 0,
  isZh = LOCALE.startsWith('zh'),
}) {
  const title = ` ${t('update_prompt_title')} `;
  const versionLine = `buildby ${chalk.dim(currentVersion)} → ${chalk.bold.green(latestVersion)}`;
  const releaseUrl = 'https://github.com/wavever/buildby/releases';
  const urlLine = chalk.dim(t('update_prompt_changelog', { url: chalk.underline(releaseUrl) }));
  const question = t('update_prompt_question');

  const opt1Text = t('update_prompt_opt_update');
  const opt2Text = t('update_prompt_opt_skip');

  const opt1 = selectedIndex === 0
    ? chalk.cyan.bold(`❯ ${opt1Text}`)
    : chalk.gray(`  ${opt1Text}`);
  const opt2 = selectedIndex === 1
    ? chalk.cyan.bold(`❯ ${opt2Text}`)
    : chalk.gray(`  ${opt2Text}`);

  const hint = chalk.dim(t('update_prompt_hint'));

  const rawLines = [
    versionLine,
    urlLine,
    '',
    chalk.bold(question),
    opt1,
    opt2,
    '',
    hint,
  ];

  const contentWidth = Math.max(
    ...rawLines.map((l) => stringWidth(l)),
    stringWidth(title) + 4,
  ) + 4;
  const boxWidth = Math.max(contentWidth, 62);

  const topBorder = chalk.yellow('╭───') +
    chalk.bold.yellow(title) +
    chalk.yellow('─'.repeat(Math.max(0, boxWidth - 3 - stringWidth(title)))) +
    chalk.yellow('╮');
  const bottomBorder = chalk.yellow('╰' + '─'.repeat(boxWidth) + '╯');

  const paddedLines = rawLines.map((line) => {
    const w = stringWidth(line);
    const pad = Math.max(0, boxWidth - 2 - w);
    return `${chalk.yellow('│')} ${line}${' '.repeat(pad)}${chalk.yellow('│')}`;
  });

  return [topBorder, ...paddedLines, bottomBorder].join('\n');
}

/**
 * Prompt user with keyboard navigation (Codex style) to update or skip.
 *
 * @param {object} params
 * @param {string} params.currentVersion
 * @param {string} params.latestVersion
 * @param {NodeJS.ReadableStream} [params.input=process.stdin]
 * @param {NodeJS.WritableStream} [params.output=process.stdout]
 * @param {boolean} [params.isZh]
 * @returns {Promise<'update' | 'skip'>}
 */
export function promptUpdateSelection({
  currentVersion,
  latestVersion,
  input = process.stdin,
  output = process.stdout,
  isZh = LOCALE.startsWith('zh'),
}) {
  return new Promise((resolve) => {
    let selectedIndex = 0;
    let lastRenderedLineCount = 0;
    let isDone = false;

    const render = () => {
      let buf = '';
      if (lastRenderedLineCount > 0 && output.isTTY) {
        buf += `\x1b[${lastRenderedLineCount}A\r`;
      }
      const box = renderUpdateBox({
        currentVersion,
        latestVersion,
        selectedIndex,
        isZh,
      });
      const lines = box.split('\n');
      for (const line of lines) {
        buf += `\x1b[2K${line}\n`;
      }
      if (lastRenderedLineCount > lines.length && output.isTTY) {
        buf += '\x1b[0J';
      }
      output.write(buf);
      lastRenderedLineCount = lines.length;
    };

    const finish = (result) => {
      if (isDone) return;
      isDone = true;
      if (cleanup) cleanup();

      // Erase rendered box so terminal remains clean
      if (output.isTTY && lastRenderedLineCount > 0) {
        output.write(`\x1b[${lastRenderedLineCount}A\r\x1b[0J`);
      }
      resolve(result);
    };

    const cleanup = setupInputListener(
      input,
      output,
      (str, key) => {
        if (!key) return;

        // Ctrl+C
        if (key.ctrl && key.name === 'c') {
          if (cleanup) cleanup();
          if (output.isTTY && lastRenderedLineCount > 0) {
            output.write(`\x1b[${lastRenderedLineCount}A\r\x1b[0J`);
          }
          process.exit(130);
        }

        // Up / Down / k / j
        if (key.name === 'up' || key.name === 'k') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'down' || key.name === 'j') {
          selectedIndex = 1;
          render();
          return;
        }

        // 1 or 2
        if (str === '1') {
          selectedIndex = 0;
          render();
          return;
        }
        if (str === '2') {
          selectedIndex = 1;
          render();
          return;
        }

        // Enter or Space
        if (key.name === 'return' || key.name === 'enter' || str === ' ') {
          finish(selectedIndex === 0 ? 'update' : 'skip');
          return;
        }

        // Escape or 'q'
        if (key.name === 'escape' || str === 'q') {
          finish('skip');
        }
      },
      (line) => {
        // Line-based fallback for tests or non-raw inputs
        const trimmed = (line || '').trim();
        if (trimmed === '1' || trimmed.toLowerCase().includes('update')) {
          finish('update');
        } else {
          finish('skip');
        }
      },
    );

    render();
  });
}

/**
 * Spawns the newly installed buildby with the same arguments and exits current process.
 *
 * @param {string[]} [args=process.argv.slice(2)]
 */
export function spawnUpdatedBuildby(args = process.argv.slice(2)) {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'buildby.cmd' : 'buildby';

  const env = {
    ...process.env,
    BUILDBY_UPDATED: '1',
    BUILDBY_NO_UPDATE_CHECK: '1',
  };

  const child = spawn(binName, args, {
    stdio: 'inherit',
    env,
    windowsHide: true,
  });

  child.on('error', () => {
    // If 'buildby' binary is not yet available in PATH, fallback to node + process.argv[1]
    const fallback = spawn(process.execPath, [process.argv[1], ...args], {
      stdio: 'inherit',
      env,
      windowsHide: true,
    });
    fallback.on('close', (code) => {
      process.exit(code ?? 0);
    });
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

/**
 * Checks for updates and prompts the user to upgrade or skip.
 * If user chooses update, updates and re-spawns with new version, then exits.
 * If user chooses skip or check fails, returns false so caller proceeds.
 *
 * @param {object} params
 * @param {string} params.currentVersion
 * @param {string[]} [params.argv=process.argv]
 * @param {object} [params.config]
 * @param {NodeJS.ReadableStream} [params.input=process.stdin]
 * @param {NodeJS.WritableStream} [params.output=process.stdout]
 * @returns {Promise<{ updated: boolean, latest: string|null }>}
 */
export async function checkAndUpdateIfNeeded({
  currentVersion,
  argv = process.argv,
  config = null,
  input = process.stdin,
  output = process.stdout,
} = {}) {
  // Check environment flags
  if (process.env.BUILDBY_NO_UPDATE_CHECK === '1' || process.env.BUILDBY_UPDATED === '1') {
    return { updated: false, latest: null };
  }

  // Check config
  if (config && config.checkForUpdates === false) {
    return { updated: false, latest: null };
  }

  // Check TTY
  if (!input.isTTY || !output.isTTY) {
    return { updated: false, latest: null };
  }

  // Check command-line arguments that indicate non-interactive / export / help modes
  const args = argv.slice(2);
  const skipArgs = [
    '--no-update-check',
    '--json',
    '--markdown',
    '--md',
    '--csv',
    '-h',
    '--help',
    '-v',
    '--version',
    'update',
  ];
  if (args.some((a) => skipArgs.includes(a))) {
    return { updated: false, latest: null };
  }

  const latest = await fetchLatestVersionFast(PACKAGE_NAME, 2000);
  if (!latest || compareVersions(latest, currentVersion) <= 0) {
    return { updated: false, latest };
  }

  const choice = await promptUpdateSelection({
    currentVersion,
    latestVersion: latest,
    input,
    output,
  });

  if (choice === 'skip') {
    return { updated: false, latest };
  }

  // User chose to update!
  if (detectInstallKind() !== 'npm') {
    console.log(
      chalk.yellow(
        t('update_local_install', {
          root: getPackageRoot(),
          pkg: PACKAGE_NAME,
        }),
      ),
    );
    return { updated: false, latest };
  }

  console.log(chalk.cyan(`🚀 ${t('update_updating', { pkg: PACKAGE_NAME, latest })}`));
  const { ok } = await runGlobalInstall(PACKAGE_NAME);

  if (!ok) {
    console.log(chalk.red(t('update_failed', { pkg: PACKAGE_NAME })));
    console.log(chalk.yellow(t('update_failed_continue')));
    return { updated: false, latest };
  }

  console.log(chalk.green(`✓ ${t('update_success', { version: latest })}`));
  console.log(chalk.cyan(`🔄 ${t('update_restarting')}\n`));

  spawnUpdatedBuildby(args);
  return { updated: true, latest };
}
