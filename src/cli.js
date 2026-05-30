import { Option, program } from 'commander';
import ora from 'ora';
import { createRequire } from 'module';
import { findAppsByName, scanAllApps } from './scanner.js';
import { analyzeApp, analyzeApps, groupByStack } from './analyzer.js';
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
    .option('--no-cache', t('cmd_no_cache'));

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
    };

    if (platform !== 'darwin' && platform !== 'win32') {
      printError(t('err_unsupported_platform', { platform }));
      process.exit(1);
    }

    // ── Custom path override ─────────────────────────────────────────────────
    if (opts.path) {
      await handleSinglePath(opts.path, platform);
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
      await handleSingleApp(appname);
      return;
    }

    // No args: show help
    program.help();
  });

  program.parse();
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleSingleApp(query) {
  const spinner = ora(t('spinner_searching', { query })).start();

  const matches = findAppsByName(query);

  if (matches.length === 0) {
    spinner.fail(t('spinner_no_match', { query }));
    printWarning(t('warn_use_scan'));
    return;
  }

  if (matches.length === 1) {
    spinner.text = t('spinner_analyzing', { name: matches[0].name });
    const result = analyzeApp(matches[0], { includeSignature: true });
    spinner.succeed(t('spinner_analyzed', { name: matches[0].name }));
    printAppDetail(result);
    return;
  }

  // Multiple matches: analyze all and show each
  spinner.text = t('spinner_multi_match', { count: matches.length });
  const results = matches
    .map((m) => {
      try { return analyzeApp(m, { includeSignature: true }); }
      catch { return null; }
    })
    .filter(Boolean);
  spinner.succeed(t('spinner_multi_done', { count: matches.length }));

  for (const result of results) {
    printAppDetail(result);
  }
}

async function handleSinglePath(dirPath, platform) {
  const { default: fs } = await import('fs');
  const { default: path } = await import('path');

  if (!fs.existsSync(dirPath)) {
    printError(t('err_path_not_found', { path: dirPath }));
    process.exit(1);
  }

  const name = platform === 'darwin'
    ? path.basename(dirPath, '.app')
    : path.basename(dirPath);

  const spinner = ora(t('spinner_analyzing', { name })).start();

  try {
    const result = analyzeApp({ name, path: dirPath, platform }, { includeSignature: true });
    spinner.succeed(t('spinner_analyzed', { name }));
    printAppDetail(result);
  } catch (err) {
    spinner.fail(t('spinner_path_fail', { msg: err.message }));
  }
}

async function handleScan(opts = {}) {
  const spinner = ora(t('spinner_scanning')).start();

  const apps = scanAllApps();

  if (apps.length === 0) {
    spinner.fail(t('spinner_no_apps'));
    printWarning(t('warn_platform'));
    return;
  }

  spinner.text = t('spinner_analyzing_n', { count: apps.length });

  const results = await analyzeApps(apps, (current, total) => {
    spinner.text = t('spinner_analyzing_progress', { current, total });
  }, { includeNativeDetails: false, useCache: opts.cache });

  spinner.succeed(t('spinner_analyzed_n', { count: results.length }));

  const groups = groupByStack(results);
  printGroupedResults(groups, results);
}

async function handleFilterByStack(stackId, opts = {}) {
  const spinner = ora(t('spinner_filter_scan', { stack: stackId })).start();

  const apps = scanAllApps();

  if (apps.length === 0) {
    spinner.fail(t('spinner_no_apps'));
    return;
  }

  spinner.text = t('spinner_analyzing_n', { count: apps.length });

  const results = await analyzeApps(apps, (current, total) => {
    spinner.text = t('spinner_analyzing_progress', { current, total });
  }, { includeNativeDetails: stackId === 'native', useCache: opts.cache });

  spinner.succeed(t('spinner_scan_done'));

  const filtered = results.filter((r) => r.stack === stackId);
  printFilteredResults(filtered, stackId);
}
