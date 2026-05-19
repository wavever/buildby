import chalk from 'chalk';
import Table from 'cli-table3';
import { t, stackDesc } from './i18n.js';
import { formatSize } from './analyzer.js';
import { ALL_STACK_METAS } from './detectors/index.js';

const META_NAME_MAP = new Map(ALL_STACK_METAS.map((m) => [m.id, m.name]));

// Map stack id -> chalk color function
const STACK_COLORS = {
  electron: chalk.cyan,
  flutter: chalk.blue,
  cef: chalk.yellow,
  chromium: chalk.hex('#4285F4'),
  tauri: chalk.magenta,
  qt: chalk.green,
  wxwidgets: chalk.hex('#00B894'),
  unity: chalk.hex('#AAAAAA'),
  jvm: chalk.red,
  dotnet: chalk.hex('#9B59B6'),
  nwjs: chalk.hex('#1ABC9C'),
  reactnative: chalk.hex('#61DAFB'),
  native: chalk.white,
  unknown: chalk.gray,
};

// Stack icons
const STACK_ICONS = {
  electron: '⚡',
  flutter: '🐦',
  cef: '🌐',
  chromium: '🌐',
  tauri: '🦀',
  qt: '🔷',
  wxwidgets: '🧩',
  unity: '🎮',
  jvm: '☕',
  dotnet: '🔵',
  nwjs: '🟩',
  reactnative: '⚛️',
  native: '🖥️',
  unknown: '❓',
};

/**
 * Color a stack name string.
 */
export function colorStack(stackId, text) {
  const colorFn = STACK_COLORS[stackId] || chalk.white;
  return colorFn(text);
}

/**
 * Render the signature & notarization section for a single app.
 * No-ops when no signature data was collected (batch-scan path).
 * @param {import('./analyzer.js').AnalysisResult} result
 */
function renderSecurity(result) {
  const sig = result.signature;
  const not = result.notarization;
  if (!sig && !not) return;

  console.log(`  ${chalk.bold(t('label_security_section'))}`);

  if (result.platform === 'darwin') {
    if (sig?.developer) {
      console.log(`    ${chalk.bold(t('label_developer'))} ${chalk.dim(sig.developer)}`);
    }
    if (sig?.teamId) {
      console.log(`    ${chalk.bold(t('label_team_id'))} ${chalk.dim(sig.teamId)}`);
    }

    if (sig) {
      let label, color;
      if (!sig.signed && !sig.adHoc) { label = t('value_unsigned'); color = chalk.red; }
      else if (sig.adHoc) { label = t('value_ad_hoc'); color = chalk.yellow; }
      else { label = t('value_signed'); color = chalk.green; }
      console.log(`    ${chalk.bold(t('label_signature'))} ${color(label)}`);
    }

    if (not) {
      let label, color;
      if (not.rejected) { label = t('value_rejected'); color = chalk.red; }
      else if (not.source === 'Apple System') { label = t('value_apple_system'); color = chalk.green; }
      else if (/Mac App Store/i.test(not.source || '')) { label = t('value_mac_app_store'); color = chalk.green; }
      else if (not.notarized) { label = t('value_notarized'); color = chalk.green; }
      else { label = t('value_not_notarized'); color = chalk.yellow; }
      console.log(`    ${chalk.bold(t('label_notarization'))} ${color(label)}`);
    } else if (sig?.notarizationTicket) {
      // spctl unavailable / timed out, but codesign reported a stapled ticket.
      console.log(`    ${chalk.bold(t('label_notarization'))} ${chalk.green(t('value_notarized'))}`);
    }

    if (sig) {
      const mark = sig.hardenedRuntime
        ? chalk.green(`✓ ${t('value_yes')}`)
        : chalk.yellow(`✗ ${t('value_no')}`);
      console.log(`    ${chalk.bold(t('label_hardened_runtime'))} ${mark}`);
    }
  } else if (result.platform === 'win32' && sig) {
    if (sig.publisher) {
      console.log(`    ${chalk.bold(t('label_publisher'))} ${chalk.dim(sig.publisher)}`);
    }
    const status = sig.status || (sig.signed ? 'Valid' : 'NotSigned');
    const color = sig.signed
      ? chalk.green
      : (status === 'NotSigned' ? chalk.red : chalk.yellow);
    console.log(`    ${chalk.bold(t('label_signature'))} ${color(status)}`);
  }

  console.log();
}

/**
 * Print a single app's tech stack details.
 * @param {import('./analyzer.js').AnalysisResult} result
 */
export function printAppDetail(result) {
  const icon = STACK_ICONS[result.stack] || '❓';
  const colorFn = STACK_COLORS[result.stack] || chalk.white;

  console.log();
  console.log(chalk.bold(`  ${result.name}`));
  console.log(chalk.dim(`  ${result.path}`));
  console.log();

  const categoryBadge =
    result.category === 'native'
      ? chalk.bgGreen.black(t('badge_native'))
      : chalk.bgBlue.white(t('badge_cross'));

  console.log(`  ${categoryBadge}  ${icon} ${colorFn.bold(result.stackName)}`);
  console.log();

  const desc = stackDesc(result.stack, result.description);
  if (desc) {
    console.log(`  ${chalk.dim(desc)}`);
    if (result.website) {
      console.log(`  ${chalk.dim.underline(result.website)}`);
    }
    console.log();
  }

  if (result.evidence && result.evidence.length > 0) {
    console.log(`  ${chalk.bold(t('label_evidence'))}`);
    for (const e of result.evidence) {
      console.log(`    ${chalk.dim('•')} ${e}`);
    }
    console.log();
  }

  if (result.metadata?.bundleId) {
    console.log(`  ${chalk.bold(t('label_bundle_id'))} ${chalk.dim(result.metadata.bundleId)}`);
  }
  if (result.metadata?.version) {
    console.log(`  ${chalk.bold(t('label_version'))} ${chalk.dim(result.metadata.version)}`);
  }
  if (result.sizeBytes > 0) {
    console.log(`  ${chalk.bold(t('label_size'))} ${chalk.dim(formatSize(result.sizeBytes))}`);
  }
  if (result.metadata?.bundleId || result.metadata?.version || result.sizeBytes > 0) {
    console.log();
  }

  renderSecurity(result);
}

/**
 * Print scan results grouped by tech stack.
 * @param {Map<string, import('./analyzer.js').AnalysisResult[]>} groups
 * @param {import('./analyzer.js').AnalysisResult[]} allResults
 */
export function printGroupedResults(groups, allResults) {
  const total = allResults.length;

  console.log();
  console.log(chalk.bold(`  ${t('scan_summary', { total: chalk.cyan(total) })}\n`));

  // Sort groups: cross-platform first (by count desc), then native
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aIsNative = a[0] === 'native' || a[0] === 'unknown';
    const bIsNative = b[0] === 'native' || b[0] === 'unknown';
    if (aIsNative && !bIsNative) return 1;
    if (!aIsNative && bIsNative) return -1;
    return b[1].length - a[1].length;
  });

  for (const [stackId, apps] of sortedGroups) {
    if (apps.length === 0) continue;

    const icon = STACK_ICONS[stackId] || '❓';
    const colorFn = STACK_COLORS[stackId] || chalk.white;
    const stackName = META_NAME_MAP.get(stackId) || apps[0].stackName;
    const percentage = ((apps.length / total) * 100).toFixed(1);
    const stat = t('scan_group_stat', { count: apps.length, pct: percentage });
    const totalSize = apps.reduce((sum, a) => sum + (a.sizeBytes || 0), 0);
    const sizeStr = totalSize > 0 ? chalk.dim(` · ${formatSize(totalSize)}`) : '';

    console.log(`  ${icon} ${colorFn.bold(stackName)} ${chalk.dim(stat)}${sizeStr}`);

    const showSubTech = stackId === 'native';
    const table = new Table({
      chars: {
        top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
        bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        left: '    ', 'left-mid': '', mid: '', 'mid-mid': '',
        right: '', 'right-mid': '', middle: '  ',
      },
      style: { 'padding-left': 0, 'padding-right': 0, head: [], border: [] },
      colWidths: showSubTech ? [26, 10, 24, 22] : [32, 12, 38],
    });

    for (const app of apps) {
      if (showSubTech) {
        const subTech = extractSubTech(app.stackName);
        table.push([
          colorFn(truncate(app.name, 24)),
          chalk.dim(formatSize(app.sizeBytes)),
          chalk.cyan(truncate(subTech, 22)),
          chalk.dim(truncate(app.path, 20)),
        ]);
      } else {
        table.push([
          colorFn(truncate(app.name, 30)),
          chalk.dim(formatSize(app.sizeBytes)),
          chalk.dim(truncate(app.path, 36)),
        ]);
      }
    }

    console.log(table.toString());
    console.log();
  }

  // Summary bar chart
  printSummaryBar(sortedGroups, total);
}

/**
 * Print a compact list of apps for --electron / --flutter etc. filter commands.
 * @param {import('./analyzer.js').AnalysisResult[]} results
 * @param {string} stackId
 */
export function printFilteredResults(results, stackId) {
  if (results.length === 0) {
    console.log();
    console.log(chalk.yellow(`  ${t('filter_no_result', { stack: stackId })}\n`));
    return;
  }

  const icon = STACK_ICONS[stackId] || '❓';
  const colorFn = STACK_COLORS[stackId] || chalk.white;
  const stackName = META_NAME_MAP.get(stackId) || results[0]?.stackName || stackId;
  const showSubTech = stackId === 'native';

  const title = t('filter_title', { icon, stack: colorFn(stackName) });
  const found = t('filter_found', { count: results.length });

  console.log();
  console.log(chalk.bold(`  ${title}`) + chalk.dim(` ${found}\n`));

  const head = showSubTech
    ? [
        chalk.bold(t('table_head_app')),
        chalk.bold(t('table_head_tech')),
        chalk.bold(t('table_head_size')),
        chalk.bold(t('table_head_path')),
      ]
    : [
        chalk.bold(t('table_head_app')),
        chalk.bold(t('table_head_version')),
        chalk.bold(t('table_head_size')),
        chalk.bold(t('table_head_path')),
      ];

  const table = new Table({
    head,
    chars: {
      top: '─', 'top-mid': '┬', 'top-left': '  ┌', 'top-right': '┐',
      bottom: '─', 'bottom-mid': '┴', 'bottom-left': '  └', 'bottom-right': '┘',
      left: '  │', 'left-mid': '  ├', mid: '─', 'mid-mid': '┼',
      right: '│', 'right-mid': '┤', middle: ' │ ',
    },
    style: { head: [], border: [], 'padding-left': 1, 'padding-right': 1 },
    colWidths: showSubTech ? [22, 22, 10, 32] : [26, 10, 10, 40],
  });

  for (const app of results.sort((a, b) => a.name.localeCompare(b.name))) {
    if (showSubTech) {
      table.push([
        colorFn(truncate(app.name, 19)),
        chalk.cyan(truncate(extractSubTech(app.stackName), 20)),
        chalk.dim(formatSize(app.sizeBytes)),
        chalk.dim(app.metadata?.bundleId || truncate(app.path, 30)),
      ]);
    } else {
      table.push([
        colorFn(truncate(app.name, 23)),
        chalk.dim(app.metadata?.version || '—'),
        chalk.dim(formatSize(app.sizeBytes)),
        chalk.dim(app.metadata?.bundleId || truncate(app.path, 38)),
      ]);
    }
  }

  console.log(table.toString());
  console.log();
}

/**
 * Print a summary bar chart of tech stacks with size info.
 */
function printSummaryBar(sortedGroups, total) {
  console.log(chalk.bold(`  ${t('scan_distribution')}\n`));
  const BAR_WIDTH = 28;

  let grandTotal = 0;
  for (const [, apps] of sortedGroups) {
    grandTotal += apps.reduce((s, a) => s + (a.sizeBytes || 0), 0);
  }

  for (const [stackId, apps] of sortedGroups) {
    if (apps.length === 0) continue;
    const colorFn = STACK_COLORS[stackId] || chalk.white;
    const icon = STACK_ICONS[stackId] || ' ';
    const stackName = META_NAME_MAP.get(stackId) || apps[0].stackName;
    const ratio = apps.length / total;
    const filled = Math.round(ratio * BAR_WIDTH);
    const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
    const pct = (ratio * 100).toFixed(1).padStart(5);
    const groupSize = apps.reduce((s, a) => s + (a.sizeBytes || 0), 0);
    const sizeLabel = groupSize > 0 ? chalk.dim(`  ${formatSize(groupSize)}`) : '';

    console.log(
      `  ${icon} ${colorFn(bar)} ${chalk.bold(String(apps.length).padStart(3))} ${pct}%${sizeLabel}  ${colorFn(truncate(stackName, 26))}`
    );
  }

  if (grandTotal > 0) {
    console.log();
    console.log(`  ${chalk.dim('─'.repeat(60))}`);
    console.log(
      `  ${chalk.bold(t('label_size'))} ${chalk.cyan(formatSize(grandTotal))}` +
      chalk.dim(`  (${total} apps)`)
    );
  }
  console.log();
}

/**
 * Print an error message.
 */
export function printError(message) {
  console.error(chalk.red(`\n  ✖ ${message}\n`));
}

/**
 * Print a warning.
 */
export function printWarning(message) {
  console.warn(chalk.yellow(`\n  ⚠ ${message}\n`));
}

/**
 * Extract the sub-technology part from a native stackName.
 * e.g. "Native (Swift · SwiftUI)" → "Swift · SwiftUI"
 */
function extractSubTech(stackName) {
  const m = stackName?.match(/^Native\s*\((.+)\)$/);
  return m ? m[1] : stackName || '';
}

/**
 * Truncate a string to max length with ellipsis.
 */
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
