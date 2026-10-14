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
  python: '-p',
  gtk: '-g',
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
  python: chalk.hex('#3776AB'),
  gtk: chalk.hex('#729FCF'),
  wails: chalk.hex('#00ADD8'),
  neutralino: chalk.cyan,
  sciter: chalk.green,
  compose: chalk.hex('#7F52FF'),
  avalonia: chalk.hex('#8B44AC'),
  juce: chalk.hex('#8DC63F'),
  godot: chalk.hex('#478CBF'),
  unreal: chalk.hex('#0E1128'),
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
  python: '🐍',
  gtk: '🟫',
  wails: '🐹',
  neutralino: '🚀',
  sciter: '📜',
  compose: '🟣',
  avalonia: '🦅',
  juce: '🎵',
  godot: '🤖',
  unreal: '🎯',
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
 * Pad a label string to a fixed visual display width.
 */
function padLabel(str, width = 14) {
  const s = String(str ?? '');
  const w = stringWidth(s);
  return w >= width ? s : s + ' '.repeat(width - w);
}

/**
 * Render an elegant section divider header with icon and rule.
 */
function renderSectionDivider(icon, title) {
  const text = `  ${icon} ${chalk.bold(title)} `;
  const w = stringWidth(text);
  const termCols = process.stdout.columns || 80;
  const maxLine = Math.min(68, Math.max(30, termCols - 4));
  return text + chalk.dim('─'.repeat(Math.max(6, maxLine - w)));
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

  const rows = [];
  if (result.platform === 'darwin') {
    if (sig) {
      let label = t('sec_signed_valid');
      let color = chalk.green;
      let badge = '✓';
      if (!sig.signed && !sig.adHoc) {
        label = t('sec_unsigned');
        color = chalk.red;
        badge = '✗';
      } else if (sig.adHoc) {
        label = t('sec_ad_hoc');
        color = chalk.yellow;
        badge = '⚠';
      }
      rows.push({
        label: t('label_sec_signature'),
        val: color(`${badge} ${label}`) + (sig.signed ? chalk.dim(' (Valid)') : ''),
      });
    }

    if (sig?.developer) {
      const devVal = sig.teamId
        ? `${sig.developer} ${chalk.dim('(Team ID: ' + sig.teamId + ')')}`
        : sig.developer;
      rows.push({
        label: t('label_sec_developer'),
        val: devVal,
      });
    }

    if (not) {
      let notLabel = t('sec_notarized');
      let notColor = chalk.green;
      let badge = '✓';
      if (not.rejected) {
        notLabel = t('sec_rejected');
        notColor = chalk.red;
        badge = '✗';
      } else if (not.source === 'Apple System') {
        notLabel = t('sec_apple_system');
      } else if (/Mac App Store/i.test(not.source || '')) {
        notLabel = t('sec_mac_app_store');
      } else if (!not.notarized) {
        notLabel = t('sec_not_notarized');
        notColor = chalk.yellow;
        badge = '⚠';
      }
      const sourceSuffix = (not.source && not.source !== 'Apple System' && !/Mac App Store/i.test(not.source))
        ? chalk.dim(` (${not.source})`)
        : '';
      rows.push({
        label: t('label_sec_notarization'),
        val: notColor(`${badge} ${notLabel}`) + sourceSuffix,
      });
    } else if (sig?.notarizationTicket) {
      rows.push({
        label: t('label_sec_notarization'),
        val: chalk.green(`✓ ${t('sec_stapled_ticket')}`),
      });
    }

    if (sig) {
      const hr = sig.hardenedRuntime
        ? chalk.green(`✓ ${t('sec_hardened_enabled')}`) + chalk.dim(' (Hardened Runtime)')
        : chalk.yellow(`✗ ${t('sec_hardened_disabled')}`);
      rows.push({
        label: t('label_sec_hardened'),
        val: hr,
      });
    }
  } else if (result.platform === 'win32' && sig) {
    if (sig.publisher) {
      rows.push({
        label: t('label_sec_publisher'),
        val: sig.publisher,
      });
    }
    const status = sig.status || (sig.signed ? 'Valid' : 'NotSigned');
    const color = sig.signed ? chalk.green : (status === 'NotSigned' ? chalk.red : chalk.yellow);
    const badge = sig.signed ? '✓' : (status === 'NotSigned' ? '✗' : '⚠');
    rows.push({
      label: t('label_sec_signature'),
      val: color(`${badge} ${status}`),
    });
  }

  if (rows.length === 0) return;

  console.log(renderSectionDivider('🔒', t('section_security')));
  for (const s of rows) {
    console.log(`    ${chalk.dim('•')} ${chalk.dim(padLabel(s.label, 14))} ${s.val}`);
  }
  console.log();
}

/**
 * Print a single app's tech stack details with modern visual hierarchy and aligned specs.
 * @param {import('./analyzer.js').AnalysisResult} result
 */
export function printAppDetail(result) {
  const icon = STACK_ICONS[result.stack] || '❓';
  const colorFn = STACK_COLORS[result.stack] || chalk.white;

  console.log();
  const ver = result.metadata?.version ? chalk.dim(` (v${result.metadata.version})`) : '';
  console.log(`  ${chalk.bold.white('📦 ' + result.name)}${ver}`);
  console.log(`  ${chalk.dim('📂 ' + result.path)}\n`);

  // Hero Verdict Banner
  const categoryBadge =
    result.category === 'native'
      ? chalk.bgGreen.black(t('badge_native'))
      : chalk.bgCyan.black(t('badge_cross'));

  const fwVer = result.frameworkVersion ? chalk.dim(' · ') + chalk.cyan.bold('v' + result.frameworkVersion) : '';
  console.log(`  ${categoryBadge}  ${icon} ${colorFn.bold(result.stackName)}${fwVer}`);

  const desc = stackDesc(result.stack, result.description);
  if (desc) {
    console.log(`  ${chalk.dim(desc)}`);
  }
  if (result.website) {
    console.log(`  ${chalk.dim('🌐 ' + chalk.underline(result.website))}`);
  }
  console.log();

  // Section 1: Specifications (核心规格)
  const specs = [];
  if (result.architecture && result.architecture !== 'unknown') {
    let archLabel = result.architecture;
    if (result.architecture === 'universal') {
      archLabel = 'Universal (Apple Silicon · Intel)';
    } else if (result.architecture === 'arm64' && result.platform === 'darwin') {
      archLabel = 'Apple Silicon (arm64)';
    } else if (result.architecture === 'x86_64') {
      archLabel = 'Intel (x86_64)';
    }
    const archColor = (result.architecture === 'arm64' || result.architecture === 'universal')
      ? chalk.green
      : chalk.yellow;
    specs.push({
      label: t('label_spec_arch'),
      val: archColor(archLabel),
    });
  }

  if (result.sizeBytes > 0) {
    specs.push({
      label: t('label_spec_size'),
      val: chalk.bold.white(formatSize(result.sizeBytes)),
    });
  }

  if (result.metadata?.version) {
    specs.push({
      label: t('label_spec_version'),
      val: result.metadata.version,
    });
  }

  if (result.metadata?.bundleId) {
    specs.push({
      label: t('label_spec_bundle_id'),
      val: chalk.dim(result.metadata.bundleId),
    });
  }

  if (specs.length > 0) {
    console.log(renderSectionDivider('📋', t('section_specs')));
    for (const s of specs) {
      console.log(`    ${chalk.dim('•')} ${chalk.dim(padLabel(s.label, 14))} ${s.val}`);
    }
    console.log();
  }

  // Section 2: Detection Evidence (判定依据)
  if (result.evidence && result.evidence.length > 0) {
    console.log(renderSectionDivider('🔍', t('section_evidence')));
    for (const e of result.evidence) {
      console.log(`    ${chalk.cyan('•')} ${e}`);
    }
    console.log();
  }

  // Section 3: Security & Trust (签名与安全)
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
 * Print a success message.
 */
export function printSuccess(message) {
  console.log(chalk.green(`\n  ✔ ${message}\n`));
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
