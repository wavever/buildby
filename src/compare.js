import { createRequire } from 'module';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { formatSize } from './analyzer.js';
import { colorStack } from './display.js';
import { getAppArchitecture, getSignatureStatus, getNotarizationStatus } from './formatters.js';
import { JSON_SCHEMA_VERSION } from './json.js';
import { t, LOCALE } from './i18n.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

/**
 * Truncate a string to a visual width using string-width.
 */
function truncateByWidth(str, maxWidth) {
  const s = String(str ?? '');
  if (stringWidth(s) <= maxWidth) return s;
  let res = '';
  for (const ch of s) {
    if (stringWidth(res + ch + '…') > maxWidth) break;
    res += ch;
  }
  return res + '…';
}

/**
 * Pad a cell with trailing spaces up to target visual width.
 */
function padCell(str, width) {
  const visible = String(str ?? '');
  const current = stringWidth(visible);
  if (current >= width) return visible;
  return visible + ' '.repeat(width - current);
}

/**
 * Deeply compare two application analysis results.
 * Produces structured comparison data, difference flags, delta calculations,
 * and human-readable key takeaways.
 *
 * @param {object} resultA - First analysis result
 * @param {object} resultB - Second analysis result
 * @returns {object} Comparison data
 */
export function compareAppsData(resultA, resultB) {
  const archA = getAppArchitecture(resultA);
  const archB = getAppArchitecture(resultB);
  const sigA = getSignatureStatus(resultA);
  const sigB = getSignatureStatus(resultB);
  const notA = getNotarizationStatus(resultA);
  const notB = getNotarizationStatus(resultB);

  const sizeA = resultA.sizeBytes || 0;
  const sizeB = resultB.sizeBytes || 0;
  const diffBytes = Math.abs(sizeA - sizeB);
  const diffFormatted = formatSize(diffBytes);

  let larger = 'equal';
  let percentage = 0;
  let ratio = 1;

  if (sizeA > sizeB) {
    larger = 'A';
    ratio = sizeB > 0 ? Number((sizeA / sizeB).toFixed(2)) : Number((sizeA / (1024 * 1024)).toFixed(1));
    percentage = sizeB > 0 ? Number(((sizeA - sizeB) / sizeB * 100).toFixed(1)) : 100;
  } else if (sizeB > sizeA) {
    larger = 'B';
    ratio = sizeA > 0 ? Number((sizeB / sizeA).toFixed(2)) : Number((sizeB / (1024 * 1024)).toFixed(1));
    percentage = sizeA > 0 ? Number(((sizeB - sizeA) / sizeA * 100).toFixed(1)) : 100;
  }

  // Evidence sets
  const evSetA = new Set(resultA.evidence || []);
  const evSetB = new Set(resultB.evidence || []);
  const commonEvidence = (resultA.evidence || []).filter((e) => evSetB.has(e));
  const onlyAEvidence = (resultA.evidence || []).filter((e) => !evSetB.has(e));
  const onlyBEvidence = (resultB.evidence || []).filter((e) => !evSetA.has(e));

  const diffs = {
    stack: {
      same: resultA.stack === resultB.stack && (resultA.variant ?? null) === (resultB.variant ?? null),
      valA: resultA.stackName || resultA.stack,
      valB: resultB.stackName || resultB.stack,
      stackIdA: resultA.stack,
      stackIdB: resultB.stack,
      variantA: resultA.variant || null,
      variantB: resultB.variant || null,
    },
    category: {
      same: resultA.category === resultB.category,
      valA: resultA.category,
      valB: resultB.category,
    },
    architecture: {
      same: archA === archB,
      valA: archA,
      valB: archB,
    },
    size: {
      same: sizeA === sizeB,
      valA: sizeA,
      valB: sizeB,
      formattedA: formatSize(sizeA),
      formattedB: formatSize(sizeB),
      diffBytes,
      diffFormatted,
      larger,
      percentage,
      ratio,
    },
    confidence: {
      same: resultA.confidence === resultB.confidence,
      valA: resultA.confidence,
      valB: resultB.confidence,
    },
    version: {
      same: (resultA.metadata?.version || null) === (resultB.metadata?.version || null),
      valA: resultA.metadata?.version || null,
      valB: resultB.metadata?.version || null,
    },
    bundleId: {
      same: (resultA.metadata?.bundleId || null) === (resultB.metadata?.bundleId || null),
      valA: resultA.metadata?.bundleId || null,
      valB: resultB.metadata?.bundleId || null,
    },
    signature: {
      same: sigA === sigB,
      valA: sigA,
      valB: sigB,
      signedA: !!resultA.signature?.signed,
      signedB: !!resultB.signature?.signed,
    },
    notarization: {
      same: notA === notB,
      valA: notA,
      valB: notB,
      notarizedA: !!(resultA.notarization?.notarized || resultA.signature?.notarizationTicket),
      notarizedB: !!(resultB.notarization?.notarized || resultB.signature?.notarizationTicket),
    },
  };

  // Generate highlights
  const highlights = [];
  const nameA = resultA.name || 'App A';
  const nameB = resultB.name || 'App B';

  if (!diffs.stack.same || !diffs.category.same) {
    const descA = diffs.diffs?.stack?.variantA
      ? `${diffs.stack.valA} (${diffs.stack.variantA})`
      : diffs.stack.valA;
    const descB = diffs.diffs?.stack?.variantB
      ? `${diffs.stack.valB} (${diffs.stack.variantB})`
      : diffs.stack.valB;

    if (!diffs.category.same) {
      highlights.push(
        LOCALE === 'zh'
          ? `${nameA} 使用 ${descA}（${diffs.category.valA}），而 ${nameB} 使用 ${descB}（${diffs.category.valB}）`
          : `${nameA} is built with ${descA} (${diffs.category.valA}) while ${nameB} is built with ${descB} (${diffs.category.valB})`
      );
    } else {
      highlights.push(
        LOCALE === 'zh'
          ? `${nameA} 使用 ${descA}，而 ${nameB} 使用 ${descB}`
          : `${nameA} uses ${descA} while ${nameB} uses ${descB}`
      );
    }
  }

  if (!diffs.size.same) {
    const largerName = larger === 'A' ? nameA : nameB;
    const smallerName = larger === 'A' ? nameB : nameA;
    highlights.push(
      LOCALE === 'zh'
        ? `${largerName} 比 ${smallerName} 体积大出 ${diffFormatted}（+${percentage}%，约 ${ratio} 倍）`
        : `${largerName} is ${diffFormatted} (+${percentage}%, ~${ratio}x) larger than ${smallerName}`
    );
  }

  if (!diffs.architecture.same) {
    highlights.push(
      LOCALE === 'zh'
        ? `${nameA} 芯片架构为 ${archA}，而 ${nameB} 为 ${archB}`
        : `${nameA} architecture is ${archA} while ${nameB} is ${archB}`
    );
  }

  if (!diffs.signature.same) {
    highlights.push(
      LOCALE === 'zh'
        ? `代码签名：${nameA} 为 ${sigA}，而 ${nameB} 为 ${sigB}`
        : `Signature: ${nameA} is ${sigA} while ${nameB} is ${sigB}`
    );
  }

  if (!diffs.notarization.same) {
    highlights.push(
      LOCALE === 'zh'
        ? `公证状态：${nameA} 为 ${notA}，而 ${nameB} 为 ${notB}`
        : `Notarization: ${nameA} is ${notA} while ${nameB} is ${notB}`
    );
  }

  if (highlights.length === 0) {
    highlights.push(
      LOCALE === 'zh'
        ? '两个应用的技术栈、架构与核心安全属性完全一致。'
        : 'Both applications share identical technology stack and core attributes.'
    );
  }

  return {
    appA: {
      name: resultA.name,
      path: resultA.path,
      stack: resultA.stack,
      stackName: resultA.stackName,
      variant: resultA.variant || null,
      category: resultA.category,
      confidence: resultA.confidence,
      architecture: archA,
      sizeBytes: sizeA,
      formattedSize: formatSize(sizeA),
      version: resultA.metadata?.version || null,
      bundleId: resultA.metadata?.bundleId || null,
      signature: sigA,
      notarization: notA,
      website: resultA.website || null,
      evidence: resultA.evidence || [],
    },
    appB: {
      name: resultB.name,
      path: resultB.path,
      stack: resultB.stack,
      stackName: resultB.stackName,
      variant: resultB.variant || null,
      category: resultB.category,
      confidence: resultB.confidence,
      architecture: archB,
      sizeBytes: sizeB,
      formattedSize: formatSize(sizeB),
      version: resultB.metadata?.version || null,
      bundleId: resultB.metadata?.bundleId || null,
      signature: sigB,
      notarization: notB,
      website: resultB.website || null,
      evidence: resultB.evidence || [],
    },
    diffs,
    evidenceDiff: {
      common: commonEvidence,
      onlyA: onlyAEvidence,
      onlyB: onlyBEvidence,
    },
    highlights,
  };
}

/**
 * Print application comparison in terminal with aligned columns and chalk styling.
 *
 * @param {object} resultA - First analysis result
 * @param {object} resultB - Second analysis result
 */
export function printAppComparison(resultA, resultB) {
  const comparison = compareAppsData(resultA, resultB);
  const { appA, appB, diffs, highlights } = comparison;

  const titleText = t('compare_title') || (LOCALE === 'zh' ? '应用对比分析' : 'Application Comparison');
  const labelProp = LOCALE === 'zh' ? '对比维度' : 'Property';
  const labelA = `${LOCALE === 'zh' ? '应用 A' : 'App A'}: ${truncateByWidth(appA.name, 22)}`;
  const labelB = `${LOCALE === 'zh' ? '应用 B' : 'App B'}: ${truncateByWidth(appB.name, 22)}`;
  const labelDelta = LOCALE === 'zh' ? '异同状态' : 'Difference';

  const wProp = 16;
  const wA = 28;
  const wB = 28;
  const wDelta = 26;

  console.log();
  console.log(chalk.bold.cyan(`  ╔═══════════════════════════════════════════════════════════════════════════════════╗`));
  console.log(chalk.bold.cyan(`  ║  ${padCell(`${titleText}: ${appA.name}  vs  ${appB.name}`, 77)}║`));
  console.log(chalk.bold.cyan(`  ╚═══════════════════════════════════════════════════════════════════════════════════╝`));
  console.log();

  // Table header
  console.log(
    `  ${chalk.dim(padCell(labelProp, wProp))}  ` +
    `${chalk.bold.white(padCell(labelA, wA))}  ` +
    `${chalk.bold.white(padCell(labelB, wB))}  ` +
    `${chalk.dim(padCell(labelDelta, wDelta))}`
  );
  console.log(`  ${chalk.dim('─'.repeat(wProp + wA + wB + wDelta + 6))}`);

  const rows = [
    {
      prop: LOCALE === 'zh' ? '技术栈' : 'Tech Stack',
      valA: colorStack(diffs.stack.stackIdA, truncateByWidth(diffs.stack.valA, wA)),
      valB: colorStack(diffs.stack.stackIdB, truncateByWidth(diffs.stack.valB, wB)),
      same: diffs.stack.same,
      delta: diffs.stack.same
        ? chalk.dim('—')
        : chalk.yellow(LOCALE === 'zh' ? '不同技术栈' : 'Different Stack'),
    },
    {
      prop: LOCALE === 'zh' ? '技术类型' : 'Category',
      valA: diffs.category.valA === 'native' ? chalk.green('Native') : chalk.blue('Cross-platform'),
      valB: diffs.category.valB === 'native' ? chalk.green('Native') : chalk.blue('Cross-platform'),
      same: diffs.category.same,
      delta: diffs.category.same
        ? chalk.dim('—')
        : chalk.yellow(LOCALE === 'zh' ? '分类不同' : 'Different Category'),
    },
    {
      prop: LOCALE === 'zh' ? '芯片架构' : 'Architecture',
      valA: truncateByWidth(diffs.architecture.valA, wA),
      valB: truncateByWidth(diffs.architecture.valB, wB),
      same: diffs.architecture.same,
      delta: diffs.architecture.same
        ? chalk.dim('—')
        : chalk.yellow(LOCALE === 'zh' ? '架构不同' : 'Different Arch'),
    },
    {
      prop: LOCALE === 'zh' ? '磁盘体积' : 'Disk Size',
      valA: diffs.size.larger === 'A' ? chalk.bold.yellow(diffs.size.formattedA) : diffs.size.formattedA,
      valB: diffs.size.larger === 'B' ? chalk.bold.yellow(diffs.size.formattedB) : diffs.size.formattedB,
      same: diffs.size.same,
      delta: diffs.size.same
        ? chalk.dim('—')
        : chalk.yellow(
            diffs.size.larger === 'A'
              ? `A +${diffs.size.diffFormatted} (+${diffs.size.percentage}%)`
              : `B +${diffs.size.diffFormatted} (+${diffs.size.percentage}%)`
          ),
    },
    {
      prop: LOCALE === 'zh' ? '版本' : 'Version',
      valA: truncateByWidth(diffs.version.valA || '—', wA),
      valB: truncateByWidth(diffs.version.valB || '—', wB),
      same: diffs.version.same,
      delta: diffs.version.same ? chalk.dim('—') : chalk.dim(LOCALE === 'zh' ? '版本不同' : 'Different'),
    },
    {
      prop: LOCALE === 'zh' ? '代码签名' : 'Signature',
      valA: diffs.signature.signedA ? chalk.green(truncateByWidth(diffs.signature.valA, wA)) : chalk.red(diffs.signature.valA),
      valB: diffs.signature.signedB ? chalk.green(truncateByWidth(diffs.signature.valB, wB)) : chalk.red(diffs.signature.valB),
      same: diffs.signature.same,
      delta: diffs.signature.same ? chalk.dim('—') : chalk.yellow(LOCALE === 'zh' ? '签名状态不同' : 'Different'),
    },
    {
      prop: LOCALE === 'zh' ? '公证状态' : 'Notarization',
      valA: diffs.notarization.notarizedA ? chalk.green(diffs.notarization.valA) : chalk.yellow(diffs.notarization.valA),
      valB: diffs.notarization.notarizedB ? chalk.green(diffs.notarization.valB) : chalk.yellow(diffs.notarization.valB),
      same: diffs.notarization.same,
      delta: diffs.notarization.same ? chalk.dim('—') : chalk.yellow(LOCALE === 'zh' ? '公证不同' : 'Different'),
    },
    {
      prop: 'Bundle ID',
      valA: chalk.dim(truncateByWidth(diffs.bundleId.valA || '—', wA)),
      valB: chalk.dim(truncateByWidth(diffs.bundleId.valB || '—', wB)),
      same: diffs.bundleId.same,
      delta: chalk.dim('—'),
    },
  ];

  if (diffs.stack.variantA || diffs.stack.variantB) {
    rows.splice(1, 0, {
      prop: LOCALE === 'zh' ? '细分技术' : 'Variant',
      valA: truncateByWidth(diffs.stack.variantA || '—', wA),
      valB: truncateByWidth(diffs.stack.variantB || '—', wB),
      same: (diffs.stack.variantA || null) === (diffs.stack.variantB || null),
      delta: (diffs.stack.variantA || null) === (diffs.stack.variantB || null)
        ? chalk.dim('—')
        : chalk.yellow(LOCALE === 'zh' ? '不同技术分支' : 'Different'),
    });
  }

  for (const r of rows) {
    console.log(
      `  ${chalk.dim(padCell(r.prop, wProp))}  ` +
      `${padCell(r.valA, wA)}  ` +
      `${padCell(r.valB, wB)}  ` +
      `${padCell(r.delta, wDelta)}`
    );
  }

  console.log(`  ${chalk.dim('─'.repeat(wProp + wA + wB + wDelta + 6))}`);
  console.log();

  // Highlights section
  console.log(`  ${chalk.bold(LOCALE === 'zh' ? '💡 核心差异与洞察：' : '💡 Key Differences & Insights:')}`);
  for (const h of highlights) {
    console.log(`    ${chalk.cyan('•')} ${h}`);
  }

  // Evidence preview if interesting
  if (comparison.evidenceDiff.onlyA.length > 0 || comparison.evidenceDiff.onlyB.length > 0) {
    console.log();
    console.log(`  ${chalk.bold(LOCALE === 'zh' ? '📦 独有打包特征：' : '📦 Distinct Packaging Evidence:')}`);
    if (comparison.evidenceDiff.onlyA.length > 0) {
      console.log(`    ${chalk.dim(`${appA.name}:`)} ${comparison.evidenceDiff.onlyA.slice(0, 3).join(', ')}`);
    }
    if (comparison.evidenceDiff.onlyB.length > 0) {
      console.log(`    ${chalk.dim(`${appB.name}:`)} ${comparison.evidenceDiff.onlyB.slice(0, 3).join(', ')}`);
    }
  }

  console.log();
}

/**
 * Build comparison JSON payload matching the standard buildby envelope.
 *
 * @param {object} resultA - First analysis result
 * @param {object} resultB - Second analysis result
 * @returns {object} JSON payload
 */
export function buildCompareJson(resultA, resultB) {
  const comparison = compareAppsData(resultA, resultB);

  return {
    schema: JSON_SCHEMA_VERSION,
    buildbyVersion: pkg.version,
    platform: process.platform,
    mode: 'compare',
    comparison,
  };
}
