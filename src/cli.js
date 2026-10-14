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
  printSuccess,
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
import {
  compareVersions,
  detectInstallKind,
  fetchLatestVersion,
  getPackageRoot,
  runGlobalInstall,
  checkAndUpdateIfNeeded,
  PACKAGE_NAME,
} from './update.js';
import { formatMarkdown, formatCsv } from './formatters.js';
import { printAppComparison, buildCompareJson } from './compare.js';
import { runInteractiveSelect } from './interactive.js';

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

export async function run() {
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
    .option('--no-update-check', t('cmd_no_update_check'))
    .option('--json', t('cmd_json'))
    .option('--markdown', t('cmd_markdown'))
    .option('--md', t('cmd_markdown'))
    .option('--csv', t('cmd_csv'))
    .option('-i, --interactive', t('cmd_interactive'));

  // ─── Pre-action hook: check for updates before command runs ─────────────────
  program.hook('preAction', async (thisCommand, actionCommand) => {
    if (actionCommand.name() === 'update') return;

    const config = loadConfig();
    const opts = program.opts();
    if (opts.updateCheck === false) return;
    if (opts.json || opts.markdown || opts.md || opts.csv) return;

    const res = await checkAndUpdateIfNeeded({
      currentVersion: pkg.version,
      argv: process.argv,
      config,
    });

    if (res && res.updated) {
      await new Promise(() => {});
    }
  });

  // ─── buildby --<stack> filter flags ───────────────────────────────────────
  for (const meta of ALL_STACK_METAS) {
    const shortFlag = STACK_SHORT_FLAGS[meta.id];
    const flags = shortFlag ? `-${shortFlag}, --${meta.id}` : `--${meta.id}`;
    program.option(flags, t('cmd_filter', { name: meta.name }));
  }

  // ─── buildby compare [app1] [app2] ──────────────────────────────────────────
  program
    .command('compare [app1] [app2]')
    .aliases(['vs', 'pk'])
    .description(t('cmd_compare'))
    .option('--json', t('cmd_json'))
    .action(async (app1, app2, opts, cmd) => {
      const mergedOpts = {
        ...program.opts(),
        ...(cmd ? cmd.optsWithGlobals() : {}),
        ...opts,
      };
      await handleCompare(app1, app2, mergedOpts);
    });

  // ─── buildby interactive ────────────────────────────────────────────────────
  program
    .command('interactive')
    .description(t('cmd_interactive'))
    .action(async (opts, cmd) => {
      const mergedOpts = {
        ...program.opts(),
        ...(cmd ? cmd.optsWithGlobals() : {}),
        ...opts,
      };
      await handleInteractive(mergedOpts);
    });

  // ─── buildby update ───────────────────────────────────────────────────────
  // Registered as a subcommand, so it takes precedence over the [appname]
  // positional. The cost is that an app literally named "update" can no longer
  // be inspected by name; --path still reaches it.
  program
    .command('update')
    .description(t('cmd_update'))
    .option('--check', t('cmd_update_check'))
    .action(async (opts) => {
      await handleUpdate(opts);
    });

  // ─── buildby <appname> ────────────────────────────────────────────────────
  program.argument('[appname]', t('cmd_appname'));

  program.action(async (appname, opts) => {
    const platform = process.platform;
    const config = loadConfig();
    const runtimeOpts = {
      ...opts,
      cache: config.cache && opts.cache !== false,
      json: !!opts.json,
      markdown: !!(opts.markdown || opts.md),
      csv: !!opts.csv,
    };

    if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
      if (runtimeOpts.json) {
        printJson(buildErrorPayload('unsupported_platform', `Unsupported platform: ${platform}`));
        process.exit(EXIT_ERROR);
      }
      printError(t('err_unsupported_platform', { platform }));
      process.exit(1);
    }

    // ── Interactive mode flag ────────────────────────────────────────────────
    if (opts.interactive) {
      await handleInteractive(runtimeOpts);
      return;
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

    // No args: default to interactive TUI mode if running in an interactive terminal
    if (process.stdin.isTTY) {
      await handleInteractive(runtimeOpts);
      return;
    }

    // Non-interactive fallback: show help
    program.help();
  });

  await program.parseAsync();
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

  if (opts.markdown) {
    process.stdout.write(formatMarkdown(results, { query }));
    return;
  }

  if (opts.csv) {
    process.stdout.write(formatCsv(results));
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

  if (opts.markdown) {
    process.stdout.write(formatMarkdown([result], { query: dirPath }));
    return;
  }

  if (opts.csv) {
    process.stdout.write(formatCsv([result]));
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
    includeNativeDetails: json || opts.markdown || opts.csv,
    useCache: opts.cache,
  });

  spinner.succeed(t('spinner_analyzed_n', { count: results.length }));

  if (json) {
    printJson(buildPayload({ mode: 'scan', results, includeSummary: true }));
    return;
  }

  if (opts.markdown) {
    process.stdout.write(formatMarkdown(results, { summary: true }));
    return;
  }

  if (opts.csv) {
    process.stdout.write(formatCsv(results));
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
    includeNativeDetails: json || opts.markdown || opts.csv || stackId === 'native',
    useCache: opts.cache,
  });

  spinner.succeed(t('spinner_scan_done'));

  const filtered = results.filter((r) => r.stack === stackId);

  if (json) {
    printJson(buildPayload({ mode: 'filter', value: stackId, results: filtered }));
    if (filtered.length === 0) process.exit(EXIT_NO_RESULTS);
    return;
  }

  if (opts.markdown) {
    process.stdout.write(formatMarkdown(filtered, { query: stackId, summary: true }));
    if (filtered.length === 0) process.exit(EXIT_NO_RESULTS);
    return;
  }

  if (opts.csv) {
    process.stdout.write(formatCsv(filtered));
    if (filtered.length === 0) process.exit(EXIT_NO_RESULTS);
    return;
  }

  printFilteredResults(filtered, stackId);
}

async function handleUpdate({ check = false } = {}) {
  const current = pkg.version;
  const spinner = createSpinner(t('update_checking'));

  const latest = await fetchLatestVersion();

  if (!latest) {
    spinner.fail(t('update_check_failed'));
    printWarning(t('update_check_hint', { pkg: PACKAGE_NAME }));
    process.exit(1);
  }

  if (compareVersions(latest, current) <= 0) {
    spinner.succeed(t('update_up_to_date', { version: current }));
    return;
  }

  spinner.succeed(t('update_available', { current, latest }));

  if (check) return;

  // An `npm link`ed or cloned copy is not npm's to replace — installing over it
  // would quietly detach the user from the checkout they are working in.
  if (detectInstallKind() !== 'npm') {
    printWarning(t('update_local_install', { root: getPackageRoot(), pkg: PACKAGE_NAME }));
    return;
  }

  console.log();
  const { ok } = await runGlobalInstall();

  if (!ok) {
    printError(t('update_failed', { pkg: PACKAGE_NAME }));
    process.exit(1);
  }

  printSuccess(t('update_success', { version: latest }));
}

async function executeCompare(appA, appB, opts = {}) {
  const { json = false } = opts;
  const spinner = createSpinner(t('spinner_analyzing', { name: `${appA.name} & ${appB.name}` }));
  const results = await analyzeAppsDetailed([appA, appB]);

  if (results.length < 2) {
    spinner.fail(t('spinner_path_fail', { msg: `${appA.name} vs ${appB.name}` }));
    if (json) {
      printJson(buildErrorPayload('compare_analysis_failed', 'Failed to analyze both applications for comparison'));
      process.exit(EXIT_ERROR);
    }
    return;
  }

  spinner.succeed(t('spinner_analyzed', { name: `${results[0].name} vs ${results[1].name}` }));

  if (json) {
    printJson(buildCompareJson(results[0], results[1]));
    return;
  }

  printAppComparison(results[0], results[1]);
}

async function handleCompare(app1Query, app2Query, opts = {}) {
  const { json = false } = opts;

  // Launch interactive multi-select if arguments are missing and running in TTY
  if ((!app1Query || !app2Query) && process.stdin.isTTY && !json) {
    const { runInteractiveCompare } = await import('./interactive.js');
    await runInteractiveCompare(null, async (selectedApps) => {
      if (selectedApps && selectedApps.length === 2) {
        await executeCompare(selectedApps[0], selectedApps[1], opts);
      }
    }, { preselected: app1Query ? [app1Query] : [] });
    return;
  }

  if (!app1Query || !app2Query) {
    printError('Please specify two applications to compare (e.g. `buildby vs app1 app2`).');
    return;
  }

  const spinner = createSpinner(t('spinner_searching', { query: `${app1Query} vs ${app2Query}` }));

  const resolveApp = async (query) => {
    const { default: fs } = await import('fs');
    if (fs.existsSync(query)) {
      const name = process.platform === 'darwin'
        ? (await import('path')).default.basename(query, '.app')
        : (await import('path')).default.basename(query);
      return { name, path: query, platform: process.platform };
    }
    const matches = findAppsByName(query);
    return matches.length > 0 ? matches[0] : null;
  };

  const appA = await resolveApp(app1Query);
  const appB = await resolveApp(app2Query);

  if (!appA || !appB) {
    const missing = !appA && !appB
      ? `"${app1Query}" and "${app2Query}"`
      : (!appA ? `"${app1Query}"` : `"${app2Query}"`);
    spinner.fail(t('spinner_no_match', { query: missing }));
    if (json) {
      printJson(buildErrorPayload('compare_app_not_found', `Could not find application(s): ${missing}`));
      process.exit(EXIT_NO_RESULTS);
    }
    printWarning(t('warn_use_scan'));
    return;
  }

  await executeCompare(appA, appB, opts);
}

async function handleInteractive(opts = {}) {
  const spinner = createSpinner(t('spinner_scanning'));
  const apps = scanAllApps();
  if (apps.length === 0) {
    spinner.fail(t('spinner_no_apps'));
    return;
  }
  spinner.succeed(t('spinner_analyzed_n', { count: apps.length }));

  await runInteractiveSelect(apps, async (selected) => {
    await handleSinglePath(selected.path, selected.platform || process.platform, opts);
  });
}

