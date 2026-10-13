import fs from 'fs';
import path from 'path';
import { formatSize } from './analyzer.js';
import { ALL_STACK_METAS } from './detectors/index.js';

const STACK_NAME_MAP = new Map(ALL_STACK_METAS.map((m) => [m.id, m.name]));
const STACK_CAT_MAP = new Map(ALL_STACK_METAS.map((m) => [m.id, m.category]));

/**
 * Inspect Mach-O executable header to extract binary architectures.
 * Fast, pure Node.js synchronous read (first 4KB).
 * @param {string} filePath
 * @returns {string | null}
 */
function readMachOArch(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return null;

    const magicBE = buf.readUInt32BE(0);
    const magicLE = buf.readUInt32LE(0);

    // Universal / Fat binary
    if (magicBE === 0xcafebabe || magicBE === 0xcafebabf) {
      if (bytesRead < 8) return 'Universal';
      const nfat = buf.readUInt32BE(4);
      const arches = new Set();
      for (let i = 0; i < nfat && (8 + (i + 1) * 20) <= bytesRead; i++) {
        const cputype = buf.readUInt32BE(8 + i * 20);
        if (cputype === 0x01000007) arches.add('x86_64');
        else if (cputype === 0x0100000c) arches.add('arm64');
        else if (cputype === 0x00000007) arches.add('i386');
        else if (cputype === 0x0000000c) arches.add('arm');
      }
      if (arches.has('arm64') && arches.has('x86_64')) {
        return 'Universal (arm64, x86_64)';
      }
      if (arches.size > 0) {
        return `Universal (${[...arches].join(', ')})`;
      }
      return 'Universal';
    }

    // Mach-O 64-bit Little Endian
    if (magicLE === 0xfeedfacf) {
      const cputype = buf.readUInt32LE(4);
      if (cputype === 0x0100000c) return 'arm64';
      if (cputype === 0x01000007) return 'x86_64';
      return 'Mach-O 64-bit';
    }

    // Mach-O 32-bit Little Endian
    if (magicLE === 0xfeedface) {
      const cputype = buf.readUInt32LE(4);
      if (cputype === 0x00000007) return 'x86';
      if (cputype === 0x0000000c) return 'arm';
      return 'Mach-O 32-bit';
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Inspect Windows PE header to extract machine architecture.
 * @param {string} filePath
 * @returns {string | null}
 */
function readPeArch(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(1024);
    const bytesRead = fs.readSync(fd, buf, 0, 1024, 0);
    fs.closeSync(fd);
    if (bytesRead < 0x40) return null;
    if (buf[0] !== 0x4d || buf[1] !== 0x5a) return null; // 'MZ'
    const peOffset = buf.readUInt32LE(0x3c);
    if (peOffset + 6 > bytesRead) return null;
    if (buf.toString('utf8', peOffset, peOffset + 4) !== 'PE\0\0') return null;
    const machine = buf.readUInt16LE(peOffset + 4);
    if (machine === 0x8664) return 'x64';
    if (machine === 0x014c) return 'x86';
    if (machine === 0xaa64) return 'arm64';
    if (machine === 0x01c0) return 'arm';
  } catch {
    return null;
  }
  return null;
}

/**
 * Determine the architecture of an application from result or binary inspection.
 * @param {object} result
 * @returns {string} e.g. "Universal (arm64, x86_64)", "arm64", "x64", "x86_64", or "—"
 */
export function getAppArchitecture(result) {
  if (result.architecture) return String(result.architecture);
  if (result.metadata?.architecture) return String(result.metadata.architecture);
  if (result.metadata?.arches) {
    return Array.isArray(result.metadata.arches)
      ? result.metadata.arches.join(', ')
      : String(result.metadata.arches);
  }

  // Attempt reading binary if path exists
  const appPath = result.path;
  if (!appPath) return '—';

  try {
    const platform = result.platform || process.platform;
    if (platform === 'darwin') {
      const macosDir = path.join(appPath, 'Contents', 'MacOS');
      let exePath = null;
      if (result.metadata?.executable) {
        exePath = path.join(macosDir, result.metadata.executable);
      } else if (fs.existsSync(macosDir)) {
        const files = fs.readdirSync(macosDir);
        if (files.length > 0) exePath = path.join(macosDir, files[0]);
      } else if (fs.existsSync(appPath) && fs.statSync(appPath).isFile()) {
        exePath = appPath;
      }

      if (exePath && fs.existsSync(exePath)) {
        const arch = readMachOArch(exePath);
        if (arch) return arch;
      }
    } else if (platform === 'win32') {
      let exePath = null;
      if (fs.existsSync(appPath)) {
        const stat = fs.statSync(appPath);
        if (stat.isFile() && appPath.toLowerCase().endsWith('.exe')) {
          exePath = appPath;
        } else if (stat.isDirectory()) {
          const files = fs.readdirSync(appPath);
          const exe = files.find((f) => f.toLowerCase().endsWith('.exe'));
          if (exe) exePath = path.join(appPath, exe);
        }
      }
      if (exePath && fs.existsSync(exePath)) {
        const arch = readPeArch(exePath);
        if (arch) return arch;
      }
    }
  } catch {
    // Non-fatal, fallback to default
  }

  return '—';
}

/**
 * Format signature status into a clean human-readable label.
 * @param {object} result
 * @returns {string}
 */
export function getSignatureStatus(result) {
  const sig = result.signature;
  if (!sig) return '—';
  if (sig.adHoc) return 'Ad-hoc';
  if (sig.signed) {
    if (sig.developer) return `Signed (${sig.developer})`;
    if (sig.publisher) return `Signed (${sig.publisher})`;
    return 'Signed';
  }
  return 'Unsigned';
}

/**
 * Format notarization status into a clean human-readable label.
 * @param {object} result
 * @returns {string}
 */
export function getNotarizationStatus(result) {
  const not = result.notarization;
  const sig = result.signature;
  if (not) {
    if (not.rejected) return 'Rejected';
    if (not.source === 'Apple System') return 'Apple System';
    if (/Mac App Store/i.test(not.source || '')) return 'Mac App Store';
    if (not.notarized) return 'Notarized';
    return 'Not notarized';
  }
  if (sig?.notarizationTicket) return 'Notarized';
  return '—';
}

/**
 * Compute summary statistics from a list of results.
 * @param {object[]} results
 * @returns {{ totalApps: number, totalSizeBytes: number, stacks: object[] }}
 */
function buildSummaryFromResults(results) {
  const byStack = new Map();

  for (const app of results) {
    const stackId = app.stack || 'unknown';
    const entry = byStack.get(stackId) || {
      stack: stackId,
      stackName: STACK_NAME_MAP.get(stackId) || app.stackName || stackId,
      category: STACK_CAT_MAP.get(stackId) || app.category || 'unknown',
      count: 0,
      sizeBytes: 0,
    };
    entry.count += 1;
    entry.sizeBytes += (app.sizeBytes || 0);
    byStack.set(stackId, entry);
  }

  const stacks = [...byStack.values()].sort((a, b) => b.count - a.count || a.stack.localeCompare(b.stack));

  return {
    totalApps: results.length,
    totalSizeBytes: results.reduce((sum, a) => sum + (a.sizeBytes || 0), 0),
    stacks,
  };
}

/**
 * Escape a cell value according to RFC 4180 rules.
 * @param {any} val
 * @returns {string}
 */
export function escapeCsvField(val) {
  if (val == null) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format analysis results as GitHub Flavored Markdown.
 * Includes a summary table (if summary provided/requested),
 * an applications overview table, and per-app details.
 *
 * @param {object | object[]} results - One or more analysis results
 * @param {{ query?: string, summary?: object | boolean }} [options]
 * @returns {string} Markdown string
 */
export function formatMarkdown(results, { query = null, summary = null } = {}) {
  const list = Array.isArray(results) ? results : [results];
  const lines = [];

  // Title
  if (query) {
    lines.push(`# Applications Matching "${query}"\n`);
  } else {
    lines.push('# Desktop Applications Tech Stack Report\n');
  }

  if (list.length === 0) {
    lines.push('No applications found.\n');
    return lines.join('\n');
  }

  // Summary section (if requested or provided)
  if (summary) {
    const summaryData = (typeof summary === 'object' && summary?.stacks)
      ? summary
      : buildSummaryFromResults(list);

    lines.push('## Technology Stack Summary\n');
    lines.push(`- **Total Applications**: ${summaryData.totalApps}`);
    lines.push(`- **Total Disk Footprint**: ${formatSize(summaryData.totalSizeBytes)}\n`);

    lines.push('| Tech Stack | Category | Apps | Share | Total Size |');
    lines.push('| :--- | :--- | ---: | ---: | ---: |');

    for (const st of summaryData.stacks) {
      const pct = summaryData.totalApps > 0
        ? ((st.count / summaryData.totalApps) * 100).toFixed(1)
        : '0.0';
      const category = st.category || STACK_CAT_MAP.get(st.stack) || '—';
      const sizeStr = formatSize(st.sizeBytes || 0);
      lines.push(`| ${st.stackName} | ${category} | ${st.count} | ${pct}% | ${sizeStr} |`);
    }

    lines.push('');
  }

  // Applications table
  lines.push('## Applications\n');
  lines.push('| Name | Stack | Category | Confidence | Size | Architecture | Signed | Notarized |');
  lines.push('| :--- | :--- | :--- | :--- | ---: | :--- | :--- | :--- |');

  for (const app of list) {
    const name = app.name || 'Unknown';
    const stackDisplay = app.variant && !app.stackName?.includes(app.variant)
      ? `${app.stackName || app.stack} (${app.variant})`
      : (app.stackName || app.stack || 'Unknown');
    const category = app.category || '—';
    const confidence = app.confidence || '—';
    const size = formatSize(app.sizeBytes || 0);
    const arch = getAppArchitecture(app);
    const signed = app.signature ? (app.signature.signed ? 'Signed' : (app.signature.adHoc ? 'Ad-hoc' : 'Unsigned')) : '—';
    const notarized = app.notarization ? (app.notarization.notarized ? 'Yes' : 'No') : (app.signature?.notarizationTicket ? 'Yes' : '—');

    lines.push(`| ${name} | ${stackDisplay} | ${category} | ${confidence} | ${size} | ${arch} | ${signed} | ${notarized} |`);
  }

  lines.push('');

  // Detailed information section
  lines.push('## Application Details\n');

  for (const app of list) {
    const stackDisplay = app.variant && !app.stackName?.includes(app.variant)
      ? `${app.stackName || app.stack} (${app.variant})`
      : (app.stackName || app.stack || 'Unknown');
    const arch = getAppArchitecture(app);
    const sigStatus = getSignatureStatus(app);
    const notStatus = getNotarizationStatus(app);

    lines.push(`### ${app.name || 'Unknown'}\n`);
    lines.push(`- **Path**: \`${app.path || '—'}\``);
    lines.push(`- **Tech Stack**: ${stackDisplay}`);
    lines.push(`- **Category**: ${app.category || '—'}`);
    lines.push(`- **Confidence**: ${app.confidence || '—'}`);
    lines.push(`- **Size**: ${formatSize(app.sizeBytes || 0)}`);
    lines.push(`- **Architecture**: ${arch}`);
    lines.push(`- **Code Signature**: ${sigStatus}`);
    lines.push(`- **Notarization**: ${notStatus}`);

    if (app.metadata?.bundleId) {
      lines.push(`- **Bundle ID**: \`${app.metadata.bundleId}\``);
    }
    if (app.metadata?.version) {
      lines.push(`- **Version**: \`${app.metadata.version}\``);
    }
    if (app.website) {
      lines.push(`- **Homepage**: [${app.website}](${app.website})`);
    }

    if (app.evidence && app.evidence.length > 0) {
      lines.push('- **Packaging Evidence**:');
      for (const ev of app.evidence) {
        lines.push(`  - \`${ev}\``);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Format analysis results as an RFC 4180 compliant CSV string.
 * Columns: Name, Stack, Category, Confidence, SizeBytes, FormattedSize,
 *          Architecture, Signed, Notarized, Path, Version, BundleID, Website
 *
 * @param {object | object[]} results - One or more analysis results
 * @returns {string} CSV string with CRLF line endings
 */
export function formatCsv(results) {
  const list = Array.isArray(results) ? results : [results];

  const headers = [
    'Name',
    'Stack',
    'Category',
    'Confidence',
    'SizeBytes',
    'FormattedSize',
    'Architecture',
    'Signed',
    'Notarized',
    'Path',
    'Version',
    'BundleID',
    'Website',
  ];

  const rows = [headers.map(escapeCsvField).join(',')];

  for (const app of list) {
    const stackDisplay = app.variant && !app.stackName?.includes(app.variant)
      ? `${app.stackName || app.stack} (${app.variant})`
      : (app.stackName || app.stack || '');
    const arch = getAppArchitecture(app);
    const sigStatus = app.signature
      ? (app.signature.signed ? 'Signed' : (app.signature.adHoc ? 'Ad-hoc' : 'Unsigned'))
      : '—';
    const notStatus = app.notarization
      ? (app.notarization.notarized ? 'Notarized' : (app.notarization.rejected ? 'Rejected' : 'Not notarized'))
      : (app.signature?.notarizationTicket ? 'Notarized' : '—');

    const row = [
      app.name || '',
      stackDisplay,
      app.category || '',
      app.confidence || '',
      app.sizeBytes ?? 0,
      formatSize(app.sizeBytes ?? 0),
      arch,
      sigStatus,
      notStatus,
      app.path || '',
      app.metadata?.version || '',
      app.metadata?.bundleId || '',
      app.website || '',
    ];

    rows.push(row.map(escapeCsvField).join(','));
  }

  return rows.join('\r\n') + '\r\n';
}
