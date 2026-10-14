import chalk from 'chalk';
import stringWidth from 'string-width';
import { t, stackDesc, LOCALE } from './i18n.js';
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
/**
 * Safely truncate a string to a visual width using stringWidth.
 */
function truncateByDisplayWidth(str, maxW) {
  const s = String(str ?? '');
  if (stringWidth(s) <= maxW) return s;
  let out = '';
  for (const ch of s) {
    if (stringWidth(out + ch + '…') > maxW) break;
    out += ch;
  }
  return out + '…';
}

/**
 * Smart middle truncation for file paths (e.g. /Applications/.../App.app).
 */
function truncatePathMiddle(p, maxW) {
  const s = String(p ?? '');
  if (stringWidth(s) <= maxW) return s;
  if (maxW <= 7) return truncateByDisplayWidth(s, maxW);
  const partW = Math.floor((maxW - 3) / 2);
  let start = '';
  for (const ch of s) {
    if (stringWidth(start + ch) > partW) break;
    start += ch;
  }
  let end = '';
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (stringWidth(ch + end) > (maxW - 3 - stringWidth(start))) break;
    end = ch + end;
  }
  return `${start}…${end}`;
}

/**
 * Format a cell to exact display width, ensuring border alignment across all terminals.
 */
function formatBentoCell(label, val, width, valColor = (s) => s) {
  const labelW = stringWidth(label);
  const valMaxW = Math.max(0, width - labelW);
  const truncatedVal = truncateByDisplayWidth(val, valMaxW);
  const cellContent = label + valColor(truncatedVal);
  const pad = Math.max(0, width - stringWidth(cellContent));
  return cellContent + ' '.repeat(pad);
}

/**
 * Render Bento Box card string for a single application detail.
 * Guarantees 100% strict column width alignment across all card borders.
 * @param {import('./analyzer.js').AnalysisResult} result
 * @returns {string}
 */
export function renderBentoCard(result) {
  const boxInnerWidth = 72;
  const col1Width = 33;
  const col2Width = boxInnerWidth - 3 - col1Width; // 36
  const border = chalk.dim;
  const indent = '  ';

  function renderFullLine(content = '') {
    const w = stringWidth(content);
    const pad = Math.max(0, boxInnerWidth - w);
    return `${indent}${border('│')} ${content}${' '.repeat(pad)} ${border('│')}`;
  }

  function renderTwoColLine(c1 = '', c2 = '') {
    const w1 = stringWidth(c1);
    const pad1 = Math.max(0, col1Width - w1);
    const w2 = stringWidth(c2);
    const pad2 = Math.max(0, col2Width - w2);
    return `${indent}${border('│')} ${c1}${' '.repeat(pad1)} ${border('│')} ${c2}${' '.repeat(pad2)} ${border('│')}`;
  }

  const lines = [];

  // Top Border
  lines.push(indent + border('╭' + '─'.repeat(boxInnerWidth + 2) + '╮'));

  // Header Line 1: App Name + OS/Arch tag
  const ver = result.metadata?.version ? ` (v${result.metadata.version})` : '';
  const archTag = result.architecture && result.architecture !== 'unknown'
    ? (result.architecture === 'universal' ? 'Universal' : result.architecture)
    : '';
  const osLabel = result.platform === 'darwin' ? 'macOS' : (result.platform === 'win32' ? 'Windows' : 'Linux');
  const platArch = [osLabel, archTag].filter(Boolean).join(' · ');
  const rightBadge = chalk.dim(platArch);
  const maxTitleW = boxInnerWidth - stringWidth(rightBadge) - 2;
  const titleLeft = chalk.bold.white(truncateByDisplayWidth(`📦 ${result.name}${ver}`, maxTitleW));
  const spaceHeader = Math.max(1, boxInnerWidth - stringWidth(titleLeft) - stringWidth(rightBadge));
  lines.push(renderFullLine(titleLeft + ' '.repeat(spaceHeader) + rightBadge));

  // Header Line 2: Path
  const maxPathW = boxInnerWidth - 3;
  const pathStr = truncatePathMiddle(result.path, maxPathW);
  lines.push(renderFullLine(chalk.dim(`📂 ${pathStr}`)));

  lines.push(indent + border('├' + '─'.repeat(boxInnerWidth + 2) + '┤'));

  // Hero Section: Stack & Category
  const catBadge = result.category === 'native'
    ? chalk.bgGreen.black(t('badge_native'))
    : chalk.bgCyan.black(t('badge_cross'));

  const icon = STACK_ICONS[result.stack] || '❓';
  const colorFn = STACK_COLORS[result.stack] || chalk.white;
  const fwVer = result.frameworkVersion ? chalk.dim(' · ') + colorFn.bold(`v${result.frameworkVersion}`) : '';
  const heroBadge = `${catBadge}  ${icon} ${colorFn.bold(result.stackName)}${fwVer}`;
  lines.push(renderFullLine(heroBadge));

  const desc = stackDesc(result.stack, result.description);
  if (desc) {
    lines.push(renderFullLine(chalk.dim(truncateByDisplayWidth(desc, boxInnerWidth))));
  }
  if (result.website) {
    const web = truncateByDisplayWidth(result.website, boxInnerWidth - 3);
    lines.push(renderFullLine(chalk.dim('🌐 ') + chalk.dim.underline(web)));
  }

  // Specifications
  const specs = [];
  if (result.architecture && result.architecture !== 'unknown') {
    let archLabel = result.architecture;
    if (result.architecture === 'universal') {
      archLabel = LOCALE.startsWith('zh') ? 'Universal (双架构)' : 'Universal (arm64 + x64)';
    } else if (result.architecture === 'arm64' && result.platform === 'darwin') {
      archLabel = 'Apple Silicon (arm64)';
    } else if (result.architecture === 'x86_64') {
      archLabel = 'Intel (x86_64)';
    }
    const archColor = (result.architecture === 'arm64' || result.architecture === 'universal') ? chalk.green : chalk.yellow;
    specs.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_spec_arch')}: `, archLabel, col1Width, archColor));
  }
  if (result.sizeBytes > 0) {
    specs.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_spec_size')}: `, formatSize(result.sizeBytes), col1Width, chalk.bold.white));
  }
  if (result.metadata?.version) {
    specs.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_spec_version')}: `, result.metadata.version, col1Width));
  }
  if (result.metadata?.bundleId) {
    specs.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_spec_bundle_id')}: `, result.metadata.bundleId, col1Width, chalk.dim));
  }

  // Security
  const sec = [];
  const sig = result.signature;
  const not = result.notarization;

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
      sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_signature')}: `, `${badge} ${label}`, col2Width, color));

      if (sig.developer) {
        const devVal = sig.teamId ? `${sig.developer} (${sig.teamId})` : sig.developer;
        sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_developer')}: `, devVal, col2Width, chalk.dim));
      }
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
      sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_notarization')}: `, `${badge} ${notLabel}`, col2Width, notColor));
    } else if (sig?.notarizationTicket) {
      sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_notarization')}: `, `✓ ${t('sec_stapled_ticket')}`, col2Width, chalk.green));
    }

    if (sig?.hardenedRuntime !== undefined) {
      const hr = sig.hardenedRuntime
        ? `✓ ${t('sec_hardened_enabled')}`
        : `✗ ${t('sec_hardened_disabled')}`;
      const hrColor = sig.hardenedRuntime ? chalk.green : chalk.yellow;
      sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_hardened')}: `, hr, col2Width, hrColor));
    }
  } else if (result.platform === 'win32' && sig) {
    if (sig.publisher) {
      sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_publisher')}: `, sig.publisher, col2Width, chalk.dim));
    }
    const status = sig.status || (sig.signed ? 'Valid' : 'NotSigned');
    const color = sig.signed ? chalk.green : (status === 'NotSigned' ? chalk.red : chalk.yellow);
    const badge = sig.signed ? '✓' : (status === 'NotSigned' ? '✗' : '⚠');
    sec.push(formatBentoCell(`  ${chalk.dim('•')} ${t('label_sec_signature')}: `, `${badge} ${status}`, col2Width, color));
  }

  const hasEvidence = Boolean(result.evidence && result.evidence.length > 0);

  // Middle Section: 2-column or 1-column
  if (sec.length > 0) {
    lines.push(indent + border('├' + '─'.repeat(col1Width + 2) + '┬' + '─'.repeat(col2Width + 2) + '┤'));
    lines.push(renderTwoColLine(chalk.bold(`📋 ${t('section_specs')}`), chalk.bold(`🔒 ${t('section_security')}`)));
    const rowCount = Math.max(specs.length, sec.length);
    for (let i = 0; i < rowCount; i++) {
      lines.push(renderTwoColLine(specs[i] || '', sec[i] || ''));
    }
    if (hasEvidence) {
      lines.push(indent + border('├' + '─'.repeat(col1Width + 2) + '┴' + '─'.repeat(col2Width + 2) + '┤'));
    } else {
      lines.push(indent + border('╰' + '─'.repeat(col1Width + 2) + '┴' + '─'.repeat(col2Width + 2) + '╯'));
    }
  } else if (specs.length > 0) {
    lines.push(indent + border('├' + '─'.repeat(boxInnerWidth + 2) + '┤'));
    lines.push(renderFullLine(chalk.bold(`📋 ${t('section_specs')}`)));
    for (const s of specs) {
      lines.push(renderFullLine(s));
    }
    if (hasEvidence) {
      lines.push(indent + border('├' + '─'.repeat(boxInnerWidth + 2) + '┤'));
    } else {
      lines.push(indent + border('╰' + '─'.repeat(boxInnerWidth + 2) + '╯'));
    }
  }

  // Evidence Section (if present)
  if (hasEvidence) {
    if (sec.length === 0 && specs.length === 0) {
      lines.push(indent + border('├' + '─'.repeat(boxInnerWidth + 2) + '┤'));
    }
    lines.push(renderFullLine(chalk.bold(`🔍 ${t('section_evidence')}`)));
    for (const e of result.evidence) {
      lines.push(renderFullLine(`  ${chalk.cyan('•')} ${truncateByDisplayWidth(e, boxInnerWidth - 5)}`));
    }
    lines.push(indent + border('╰' + '─'.repeat(boxInnerWidth + 2) + '╯'));
  }

  return lines.join('\n');
}

/**
 * Print a single app's tech stack details in Bento Box card style.
 * @param {import('./analyzer.js').AnalysisResult} result
 */
export function printAppDetail(result) {
  console.log();
  console.log(renderBentoCard(result));
  console.log();
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
