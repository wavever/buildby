import chalk from 'chalk';
import stringWidth from 'string-width';
import { t, stackDesc } from './i18n.js';
import { formatSize } from './analyzer.js';
import { ALL_STACK_METAS } from './detectors/index.js';

const META_NAME_MAP = new Map(ALL_STACK_METAS.map((m) => [m.id, m.name]));
const STACK_FILTER_FLAGS = {
  electron: '-e',
  flutter: '-f',
  cef: '-c',
  nwjs: '-W',
  chromium: '-b',
  reactnative: '-r',
  qt: '-q',
  wxwidgets: '-w',
  unity: '-u',
  jvm: '-j',
  dotnet: '-d',
  tauri: '-t',
  native: '-n',
};
const GROUP_PREVIEW_LIMIT = 8;

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
  const totalSize = allResults.reduce((sum, app) => sum + (app.sizeBytes || 0), 0);

  // Sort groups: cross-platform first (by count desc), then native
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aIsNative = a[0] === 'native' || a[0] === 'unknown';
    const bIsNative = b[0] === 'native' || b[0] === 'unknown';
    if (aIsNative && !bIsNative) return 1;
    if (!aIsNative && bIsNative) return -1;
    return b[1].length - a[1].length;
  });

  printReportHeader(sortedGroups, total, totalSize);
  console.log(chalk.bold(`  ${t('report_groups')}\n`));

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
    const widths = showSubTech
      ? { app: 30, size: 10, tech: 26 }
      : { app: 36, size: 10 };

    const sortedApps = [...apps].sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));

    for (const app of sortedApps.slice(0, GROUP_PREVIEW_LIMIT)) {
      const appName = truncateByWidth(app.name, widths.app);
      const size = formatSize(app.sizeBytes);
      if (showSubTech) {
        const subTech = truncateByWidth(extractSubTech(app.stackName), widths.tech);
        console.log(
          `    ${colorFn(padCell(appName, widths.app))}  ` +
          `${chalk.dim(padCell(size, widths.size))}  ` +
          `${chalk.cyan(subTech)}`
        );
      } else {
        console.log(
          `    ${colorFn(padCell(appName, widths.app))}  ` +
          `${chalk.dim(size)}`
        );
      }
    }

    if (sortedApps.length > GROUP_PREVIEW_LIMIT) {
      const command = `buildby ${STACK_FILTER_FLAGS[stackId] || `--${stackId}`}`;
      console.log(`    ${chalk.dim(t('report_more', {
        count: sortedApps.length - GROUP_PREVIEW_LIMIT,
        command,
      }))}`);
    }

    console.log();
  }

  printSummaryBar(sortedGroups, total, totalSize);
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

  const widths = showSubTech
    ? { app: 24, detail: 24, size: 10, id: 38 }
    : { app: 28, detail: 12, size: 10, id: 42 };

  const detailHead = showSubTech ? t('table_head_tech') : t('table_head_version');
  console.log(
    `  ${chalk.bold(padCell(t('table_head_app'), widths.app))}  ` +
    `${chalk.bold(padCell(detailHead, widths.detail))}  ` +
    `${chalk.bold(padCell(t('table_head_size'), widths.size))}  ` +
    `${chalk.bold(t('table_head_path'))}`
  );
  console.log(`  ${chalk.dim('─'.repeat(widths.app + widths.detail + widths.size + widths.id + 6))}`);

  for (const app of [...results].sort((a, b) => a.name.localeCompare(b.name))) {
    const appName = truncateByWidth(app.name, widths.app);
    const size = formatSize(app.sizeBytes);
    const idOrPath = app.metadata?.bundleId || app.path;

    if (showSubTech) {
      const detail = truncateByWidth(extractSubTech(app.stackName), widths.detail);
      console.log(
        `  ${colorFn(padCell(appName, widths.app))}  ` +
        `${chalk.cyan(padCell(detail, widths.detail))}  ` +
        `${chalk.dim(padCell(size, widths.size))}  ` +
        `${chalk.dim(truncateByWidth(idOrPath, widths.id))}`
      );
    } else {
      const detail = truncateByWidth(app.metadata?.version || '—', widths.detail);
      console.log(
        `  ${colorFn(padCell(appName, widths.app))}  ` +
        `${chalk.dim(padCell(detail, widths.detail))}  ` +
        `${chalk.dim(padCell(size, widths.size))}  ` +
        `${chalk.dim(truncateByWidth(idOrPath, widths.id))}`
      );
    }
  }
  console.log();
}

/**
 * Print a summary bar chart of tech stacks with size info.
 */
function printSummaryBar(sortedGroups, total, grandTotal) {
  console.log(`  ${chalk.dim('─'.repeat(72))}\n`);
  const BAR_WIDTH = 28;
  const electronApps = sortedGroups.find(([stackId]) => stackId === 'electron')?.[1] || [];
  const electronSize = electronApps.reduce((s, a) => s + (a.sizeBytes || 0), 0);
  const crossPlatform = sortedGroups
    .filter(([stackId]) => stackId !== 'native' && stackId !== 'unknown')
    .reduce((acc, [, apps]) => ({
      count: acc.count + apps.length,
      size: acc.size + apps.reduce((s, a) => s + (a.sizeBytes || 0), 0),
    }), { count: 0, size: 0 });
  const title = pickProfileTitle({
    total,
    totalSize: grandTotal,
    electronCount: electronApps.length,
    electronSize,
    crossPlatformCount: crossPlatform.count,
  });

  console.log(`  ${chalk.dim(t('report_profile_summary', {
    count: total,
    size: chalk.cyan(formatSize(grandTotal)),
    title: chalk.cyan(`「${title}」`),
  }))}`);
  console.log();

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

  console.log();
}

/**
 * Print the shareable report header for --all.
 */
function printReportHeader(sortedGroups, total, totalSize) {
  const groupStats = sortedGroups
    .filter(([, apps]) => apps.length > 0)
    .map(([stackId, apps]) => {
      const size = apps.reduce((sum, app) => sum + (app.sizeBytes || 0), 0);
      return { stackId, apps, count: apps.length, size };
    });

  const electron = groupStats.find((g) => g.stackId === 'electron') || { count: 0, size: 0 };
  const crossPlatform = groupStats
    .filter((g) => g.stackId !== 'native' && g.stackId !== 'unknown')
    .reduce((acc, g) => ({
      count: acc.count + g.count,
      size: acc.size + g.size,
    }), { count: 0, size: 0 });
  const largest = groupStats.reduce((best, current) => (
    !best || current.size > best.size ? current : best
  ), null);
  const largestName = largest ? (META_NAME_MAP.get(largest.stackId) || largest.stackId) : '—';
  const largestIcon = largest ? (STACK_ICONS[largest.stackId] || '•') : '•';
  const largestColor = largest ? (STACK_COLORS[largest.stackId] || chalk.white) : chalk.white;

  console.log();
  console.log(chalk.bold(`  ${t('report_title')}`));
  console.log(chalk.dim(`  ${t('report_overview', { count: total, size: formatSize(totalSize) })}`));
  console.log();
  console.log(`  ${chalk.cyan('◇')} ${chalk.bold(t('report_cross_platform'))}  ${formatMetric(crossPlatform.count, total, crossPlatform.size)}`);
  console.log(`  ${largestIcon} ${chalk.bold(t('report_largest_stack'))}  ${largestColor(largestName)} ${chalk.dim(`· ${formatSize(largest?.size || 0)}`)}`);
  console.log();
}

function formatMetric(count, total, size) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  return t('report_metric', {
    count: chalk.bold(count),
    pct,
    size: chalk.cyan(formatSize(size)),
  });
}

function pickProfileTitle({ total, totalSize, electronCount, electronSize, crossPlatformCount }) {
  const electronSizeRatio = totalSize > 0 ? electronSize / totalSize : 0;
  const electronCountRatio = total > 0 ? electronCount / total : 0;
  const crossPlatformRatio = total > 0 ? crossPlatformCount / total : 0;

  if (electronCount === 0) return t('report_title_no_electron');
  if (electronSizeRatio >= 0.35 || electronCountRatio >= 0.35) return t('report_title_electron_heavy');
  if (electronSizeRatio >= 0.2 || electronCountRatio >= 0.2) return t('report_title_electron_medium');
  if (crossPlatformRatio >= 0.5) return t('report_title_cross_platform');
  if (electronCountRatio < 0.1) return t('report_title_electron_light');
  return t('report_title_native');
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

/**
 * Truncate a string by display width, accounting for CJK and emoji.
 */
function truncateByWidth(value, maxWidth) {
  const str = String(value || '');
  if (stringWidth(str) <= maxWidth) return str;

  let out = '';
  for (const char of str) {
    if (stringWidth(out + char + '…') > maxWidth) break;
    out += char;
  }
  return out + '…';
}

/**
 * Pad a string to a display width, accounting for CJK and emoji.
 */
function padCell(value, width) {
  const str = truncateByWidth(value, width);
  return str + ' '.repeat(Math.max(0, width - stringWidth(str)));
}
