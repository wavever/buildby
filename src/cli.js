import { Option, program } from 'commander';
import ora from 'ora';
import { createRequire } from 'module';
import { findAppsByName, scanAllApps } from './scanner.js';
import { analyzeApps, analyzeAppsDetailed, groupByStack } from './analyzer.js';
import {
  printAppDetail,
  printGroupedResults,
  printFilteredResults,
  printError,
  printWarning,
} from './display.js';
import { ALL_STACK_METAS } from './detectors/index.js';
import { t } from './i18n.js';
import { loadConfig } from './config.js';
import {
  buildErrorPayload,
  buildPayload,
  printJson,
  EXIT_ERROR,
  EXIT_NO_RESULTS,
} from './json.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const STACK_SHORT_FLAGS = {
  electron: 'e',
  flutter: 'f',
  cef: 'c',
  nwjs: 'W',
  chromium: 'b',
  reactnative: 'r',
  qt: 'q',
  wxwidgets: 'w',
  unity: 'u',
  jvm: 'j',
  dotnet: 'd',
  tauri: 't',
  python: 'p',
  gtk: 'g',
  native: 'n',
};

export function run() {
  program
    .name('buildby')
    .description(t('cmd_description'))
    .version(pkg.version, '-v, --version')
    .helpOption('-h, --help', t('cmd_help'));

  // ─── buildby --all / -a ────────────────────────────────────────────────────
  program
    .option('-a, --all', t('cmd_all'))
    .addOption(new Option('--scan', t('cmd_scan_legacy')).hideHelp())
    .option('--path <dir>', t('cmd_path'))
    .option('--no-cache', t('cmd_no_cache'))
    .option('--json', t('cmd_json'));

  // ─── buildby --<stack> filter flags ───────────────────────────────────────
  for (const meta of ALL_STACK_METAS) {
    const shortFlag = STACK_SHORT_FLAGS[meta.id];
    const flags = shortFlag ? `-${shortFlag}, --${meta.id}` : `--${meta.id}`;
    program.option(flags, t('cmd_filter', { name: meta.name }));
  }

  // ─── buildby <appname> ────────────────────────────────────────────────────
  program.argument('[appname]', t('cmd_appname'));

  program.action(async (appname, opts) => {
    const platform = process.platform;
    const config = loadConfig();
    const runtimeOpts = {
      ...opts,
      cache: config.cache && opts.cache !== false,
      json: !!opts.json,
    };

    if (platform !== 'darwin' && platform !== 'win32') {
      if (runtimeOpts.json) {
        printJson(buildErrorPayload('unsupported_platform', `Unsupported platform: ${platform}`));
        process.exit(EXIT_ERROR);
      }
      printError(t('err_unsupported_platform', { platform }));
      process.exit(1);
    }

    // ── Custom path override ─────────────────────────────────────────────────
    if (opts.path) {
      await handleSinglePath(opts.path, platform, runtimeOpts);
      return;
    }

    // ── --all / --scan: scan everything ──────────────────────────────────────
    if (opts.all || opts.scan) {
      await handleScan(runtimeOpts);
      return;
    }

    // ── --<stack> filter flags ───────────────────────────────────────────────
    for (const meta of ALL_STACK_METAS) {
      if (opts[meta.id]) {
        await handleFilterByStack(meta.id, runtimeOpts);
        return;
      }
    }

    // ── buildby <appname> ────────────────────────────────────────────────────
    if (appname) {
      await handleSingleApp(appname, runtimeOpts);
      return;
    }

    // No args: show help
    program.help();
  });

  program.parse();
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * The spinner writes to stderr, so it is safe to show under --json too: stdout
 * still carries nothing but the payload. ora disables itself automatically when
 * stderr is not a TTY, so piping or redirecting stays clean.
 */
function createSpinner(text) {
  return ora({ text, stream: process.stderr }).start();
}

async function handleSingleApp(query, opts = {}) {
  const { json = false } = opts;
  const spinner = createSpinner(t('spinner_searching', { query }));

  const matches = findAppsByName(query);

  if (matches.length === 0) {
    spinner.fail(t('spinner_no_match', { query }));
    if (json) {
      printJson(buildPayload({ mode: 'app', value: query, results: [] }));
      process.exit(EXIT_NO_RESULTS);
    }
    printWarning(t('warn_use_scan'));
    return;
  }

  spinner.text = matches.length === 1
    ? t('spinner_analyzing', { name: matches[0].name })
    : t('spinner_multi_match', { count: matches.length });

  const results = await analyzeAppsDetailed(matches);

  if (results.length === 0) {
    // Every match failed to analyze — report it rather than printing nothing.
    spinner.fail(t('spinner_no_match', { query }));
    if (json) {
      printJson(buildErrorPayload('analysis_failed', `Matched ${matches.length} app(s) but none could be analyzed`));
      process.exit(EXIT_ERROR);
    }
    printWarning(t('warn_use_scan'));
    return;
  }

  spinner.succeed(matches.length === 1
    ? t('spinner_analyzed', { name: matches[0].name })
    : t('spinner_multi_done', { count: matches.length }));

  if (json) {
    printJson(buildPayload({ mode: 'app', value: query, results }));
    return;
  }

  for (const result of results) {
    printAppDetail(result);
  }
}

async function handleSinglePath(dirPath, platform, opts = {}) {
  const { json = false } = opts;
  const { default: fs } = await import('fs');
  const { default: path } = await import('path');

  if (!fs.existsSync(dirPath)) {
    if (json) {
      printJson(buildErrorPayload('path_not_found', `Path not found: ${dirPath}`));
      process.exit(EXIT_ERROR);
    }
    printError(t('err_path_not_found', { path: dirPath }));
    process.exit(1);
  }

  const name = platform === 'darwin'
    ? path.basename(dirPath, '.app')
    : path.basename(dirPath);

  const spinner = createSpinner(t('spinner_analyzing', { name }));

  const [result] = await analyzeAppsDetailed([{ name, path: dirPath, platform }]);

  if (!result) {
    spinner.fail(t('spinner_path_fail', { msg: dirPath }));
    if (json) {
      printJson(buildErrorPayload('analysis_failed', `Could not analyze: ${dirPath}`));
      process.exit(EXIT_ERROR);
    }
    return;
  }

  spinner.succeed(t('spinner_analyzed', { name }));

  if (json) {
    printJson(buildPayload({ mode: 'path', value: dirPath, results: [result] }));
    return;
  }

  printAppDetail(result);
}

async function handleScan(opts = {}) {
  const { json = false } = opts;
  const spinner = createSpinner(t('spinner_scanning'));

  const apps = scanAllApps();

  if (apps.length === 0) {
    spinner.fail(t('spinner_no_apps'));
    if (json) {
      printJson(buildPayload({ mode: 'scan', results: [], includeSummary: true }));
      process.exit(EXIT_NO_RESULTS);
    }
    printWarning(t('warn_platform'));
    return;
  }

  spinner.text = t('spinner_analyzing_n', { count: apps.length });

  const results = await analyzeApps(apps, (current, total) => {
    spinner.text = t('spinner_analyzing_progress', { current, total });
  }, {
    // JSON consumers get the full native breakdown: `variant` should not
    // silently depend on which output mode was requested.
    includeNativeDetails: json,
    useCache: opts.cache,
  });

  spinner.succeed(t('spinner_analyzed_n', { count: results.length }));

  if (json) {
    printJson(buildPayload({ mode: 'scan', results, includeSummary: true }));
    return;
  }

  const groups = groupByStack(results);
  printGroupedResults(groups, results);
}

async function handleFilterByStack(stackId, opts = {}) {
  const { json = false } = opts;
  const spinner = createSpinner(t('spinner_filter_scan', { stack: stackId }));

  const apps = scanAllApps();

  if (apps.length === 0) {
    spinner.fail(t('spinner_no_apps'));
    if (json) {
      printJson(buildPayload({ mode: 'filter', value: stackId, results: [] }));
      process.exit(EXIT_NO_RESULTS);
    }
    return;
  }

  spinner.text = t('spinner_analyzing_n', { count: apps.length });

  const results = await analyzeApps(apps, (current, total) => {
    spinner.text = t('spinner_analyzing_progress', { current, total });
  }, {
    includeNativeDetails: json || stackId === 'native',
    useCache: opts.cache,
  });

  spinner.succeed(t('spinner_scan_done'));

  const filtered = results.filter((r) => r.stack === stackId);

  if (json) {
    printJson(buildPayload({ mode: 'filter', value: stackId, results: filtered }));
    if (filtered.length === 0) process.exit(EXIT_NO_RESULTS);
    return;
  }

  printFilteredResults(filtered, stackId);
}
