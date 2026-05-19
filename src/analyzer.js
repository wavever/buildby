import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { detectStack } from './detectors/index.js';
import { LOCALE } from './i18n.js';

/**
 * Get the disk usage of an app directory in bytes.
 * Uses `du -sk` on macOS/Linux (very fast, ~5-50ms).
 * Falls back to recursive file walk on Windows.
 * @param {string} appPath
 * @returns {number} size in bytes, or 0 on error
 */
function getAppSize(appPath) {
  if (process.platform !== 'win32') {
    try {
      const out = execFileSync('du', ['-sk', appPath], {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString();
      const kb = parseInt(out.split('\t')[0], 10);
      return isNaN(kb) ? 0 : kb * 1024;
    } catch {
      return 0;
    }
  }

  // Windows: recursive walk
  let total = 0;
  const walk = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try { total += fs.statSync(full).size; } catch { /* skip */ }
        }
      }
    } catch { /* skip inaccessible dirs */ }
  };
  walk(appPath);
  return total;
}

/**
 * Format bytes into a human-readable size string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Read macOS app Info.plist as raw text for basic metadata extraction.
 * @param {string} appPath
 * @returns {{ bundleId?: string, version?: string, executable?: string } | null}
 */
function readPlistMetadata(appPath) {
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plistPath)) return null;

  try {
    const content = fs.readFileSync(plistPath, 'utf8');

    const extract = (key) => {
      const re = new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`);
      const m = content.match(re);
      return m ? m[1] : undefined;
    };

    return {
      bundleId: extract('CFBundleIdentifier'),
      version: extract('CFBundleShortVersionString') || extract('CFBundleVersion'),
      executable: extract('CFBundleExecutable'),
      displayName: extract('CFBundleDisplayName') || extract('CFBundleName'),
    };
  } catch {
    return null;
  }
}

/**
 * Read localized display name from .lproj/InfoPlist.strings.
 * macOS apps store per-language overrides of CFBundleDisplayName / CFBundleName
 * inside Contents/Resources/<lang>.lproj/InfoPlist.strings (often binary plist).
 * @param {string} appPath
 * @returns {string | null}
 */
function readLocalizedDisplayName(appPath) {
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');

  const lprojCandidates = LOCALE === 'zh'
    ? ['zh-Hans.lproj', 'zh_CN.lproj', 'zh-Hant.lproj', 'zh_TW.lproj', 'zh_HK.lproj']
    : [];

  if (lprojCandidates.length === 0) return null;

  for (const lproj of lprojCandidates) {
    const stringsFile = path.join(resourcesDir, lproj, 'InfoPlist.strings');
    if (!fs.existsSync(stringsFile)) continue;

    try {
      const xml = execFileSync('plutil', ['-convert', 'xml1', '-o', '-', stringsFile], {
        timeout: 3000,
        maxBuffer: 256 * 1024,
      }).toString();

      const extractFromXml = (key) => {
        const re = new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`);
        const m = xml.match(re);
        return m ? m[1] : undefined;
      };

      const name = extractFromXml('CFBundleDisplayName') || extractFromXml('CFBundleName');
      if (name) return name;
    } catch {
      // plutil failed or file unreadable — try next candidate
    }
  }

  return null;
}

/**
 * Get app icon path (for display purposes).
 * @param {string} appPath
 * @param {string} platform
 * @returns {string | null}
 */
function getAppIcon(appPath, platform) {
  if (platform === 'darwin') {
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');
    try {
      const items = fs.readdirSync(resourcesDir);
      const icon = items.find((item) => item.endsWith('.icns'));
      return icon ? path.join(resourcesDir, icon) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Read macOS code signature info via `codesign -dv --verbose=4`.
 * Note: codesign writes diagnostics to stderr, so we use spawnSync and merge streams.
 * @param {string} appPath
 * @returns {object | null}
 */
function readMacSignature(appPath) {
  try {
    const r = spawnSync('codesign', ['-dv', '--verbose=4', appPath], {
      timeout: 3000,
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    });
    const out = (r.stderr || '') + (r.stdout || '');
    if (!out) return null;

    if (/code object is not signed/i.test(out)) {
      return {
        signed: false, adHoc: false, authorities: [], teamId: null,
        developer: null, signingTime: null, hardenedRuntime: false,
        format: null, identifier: null, notarizationTicket: false,
      };
    }

    const authorities = [...out.matchAll(/^Authority=(.+)$/gm)].map((m) => m[1]);
    const teamRaw = out.match(/^TeamIdentifier=(.+)$/m)?.[1];
    const teamId = teamRaw && teamRaw !== 'not set' ? teamRaw : null;
    const identifier = out.match(/^Identifier=(.+)$/m)?.[1] ?? null;
    const format = out.match(/^Format=(.+)$/m)?.[1] ?? null;
    const signingTime = out.match(/^(?:Signing Time|Timestamp)=(.+)$/m)?.[1] ?? null;

    const flagsMatch = out.match(/CodeDirectory[^\n]*flags=0x[0-9a-f]+(?:\(([^)]+)\))?/i);
    const flagsLabel = flagsMatch?.[1] || '';
    const hardenedRuntime = /\bruntime\b/.test(flagsLabel);
    const adHoc = /\badhoc\b/.test(flagsLabel) || /^Signature=adhoc$/m.test(out);
    const notarizationTicket = /^Notarization Ticket=stapled/m.test(out);

    let developer = null;
    for (const a of authorities) {
      const m = a.match(/^(?:Developer ID Application|Apple Development|Apple Distribution|3rd Party Mac Developer Application):\s*(.+?)\s*\(([A-Z0-9]+)\)$/);
      if (m) { developer = m[1]; break; }
    }

    return {
      signed: !adHoc, adHoc, authorities, teamId, developer,
      signingTime, hardenedRuntime, format, identifier, notarizationTicket,
    };
  } catch {
    return null;
  }
}

/**
 * Read macOS notarization / Gatekeeper assessment via `spctl --assess`.
 * @param {string} appPath
 * @returns {object | null}
 */
function readMacNotarization(appPath) {
  try {
    const r = spawnSync('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath], {
      timeout: 15000,
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    });
    const out = (r.stderr || '') + (r.stdout || '');
    if (!out) return null;

    const accepted = /:\s*accepted\b/.test(out);
    const rejected = /:\s*rejected\b/.test(out);
    const source = out.match(/^source=(.+)$/m)?.[1]?.trim() ?? null;
    const notarized = !!source && /notariz/i.test(source);

    return { accepted, rejected, source, notarized };
  } catch {
    return null;
  }
}

/**
 * Locate the primary .exe for a Windows app directory.
 * Prefers <basename>.exe, falls back to the largest .exe in the folder.
 * @param {string} appPath
 * @returns {string | null}
 */
function findPrimaryExe(appPath) {
  try {
    const stat = fs.statSync(appPath);
    if (stat.isFile() && appPath.toLowerCase().endsWith('.exe')) return appPath;

    const base = path.basename(appPath);
    const guess = path.join(appPath, `${base}.exe`);
    if (fs.existsSync(guess)) return guess;

    let best = null;
    let bestSize = 0;
    for (const entry of fs.readdirSync(appPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.exe')) continue;
      const full = path.join(appPath, entry.name);
      try {
        const size = fs.statSync(full).size;
        if (size > bestSize) { bestSize = size; best = full; }
      } catch { /* skip */ }
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Read Windows Authenticode signature info via PowerShell.
 * @param {string} exePath
 * @returns {object | null}
 */
function readWindowsSignature(exePath) {
  const escaped = exePath.replace(/'/g, "''");
  const command = `try { Get-AuthenticodeSignature -FilePath '${escaped}' | Select-Object Status,@{n='Subject';e={$_.SignerCertificate.Subject}},@{n='NotAfter';e={$_.SignerCertificate.NotAfter}},@{n='TimeStamper';e={$_.TimeStamperCertificate.Subject}} | ConvertTo-Json -Compress } catch { '' }`;

  try {
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', command], {
      timeout: 3000,
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    });
    if (r.error || !r.stdout) return null;

    const json = JSON.parse(r.stdout.trim() || 'null');
    if (!json) return null;

    const statusMap = {
      0: 'Valid', 1: 'UnknownError', 2: 'NotSigned',
      3: 'HashMismatch', 4: 'NotTrusted',
      5: 'NotSupportedFileFormat', 6: 'Incompatible',
    };
    const status = typeof json.Status === 'number'
      ? (statusMap[json.Status] || String(json.Status))
      : String(json.Status || '');

    const subject = json.Subject || '';
    const cn = subject.match(/CN=(?:"([^"]+)"|([^,]+))/);
    const org = subject.match(/(?:^|,\s*)O=(?:"([^"]+)"|([^,]+))/);
    const publisher = cn ? (cn[1] || cn[2]).trim() : null;
    const organization = org ? (org[1] || org[2]).trim() : null;

    return {
      signed: status === 'Valid',
      status,
      publisher,
      organization,
      signingTime: !!json.TimeStamper,
    };
  } catch {
    return null;
  }
}

/**
 * Analyze a single application and return a complete result object.
 * @param {{ name: string, path: string, platform: string }} app
 * @param {{ includeSignature?: boolean }} [opts]
 * @returns {AnalysisResult}
 */
export function analyzeApp(app, { includeSignature = false } = {}) {
  const { name, path: appPath, platform } = app;

  const detection = detectStack(appPath, platform);
  const metadata = platform === 'darwin' ? readPlistMetadata(appPath) : null;
  const localizedName = platform === 'darwin' ? readLocalizedDisplayName(appPath) : null;
  const sizeBytes = getAppSize(appPath);

  let signature = null;
  let notarization = null;
  if (includeSignature) {
    if (platform === 'darwin') {
      signature = readMacSignature(appPath);
      notarization = readMacNotarization(appPath);
    } else if (platform === 'win32') {
      const exePath = findPrimaryExe(appPath);
      if (exePath) signature = readWindowsSignature(exePath);
    }
  }

  return {
    name: localizedName || metadata?.displayName || name,
    path: appPath,
    platform,
    stack: detection.id,
    stackName: detection.name,
    category: detection.category,
    confidence: detection.confidence,
    evidence: detection.evidence,
    color: detection.color,
    description: detection.description,
    website: detection.website,
    metadata: metadata || {},
    sizeBytes,
    signature,
    notarization,
  };
}

/**
 * Analyze multiple apps with a progress callback.
 * @param {{ name: string, path: string, platform: string }[]} apps
 * @param {(current: number, total: number, name: string) => void} [onProgress]
 * @returns {AnalysisResult[]}
 */
export function analyzeApps(apps, onProgress) {
  const results = [];

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    if (onProgress) onProgress(i + 1, apps.length, app.name);

    try {
      results.push(analyzeApp(app));
    } catch {
      // Skip apps that can't be analyzed (permission denied, etc.)
      results.push({
        name: app.name,
        path: app.path,
        platform: app.platform,
        stack: 'unknown',
        stackName: 'Unknown',
        category: 'unknown',
        confidence: 'low',
        evidence: ['Analysis failed'],
        color: 'gray',
        description: 'Could not analyze this application',
        website: null,
        metadata: {},
        sizeBytes: 0,
        signature: null,
        notarization: null,
      });
    }
  }

  return results;
}

/**
 * Group analysis results by tech stack.
 * @param {AnalysisResult[]} results
 * @returns {Map<string, AnalysisResult[]>}
 */
export function groupByStack(results) {
  const groups = new Map();

  for (const result of results) {
    const key = result.stack;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(result);
  }

  // Sort each group alphabetically
  for (const [, apps] of groups) {
    apps.sort((a, b) => a.name.localeCompare(b.name));
  }

  return groups;
}

/**
 * @typedef {Object} AnalysisResult
 * @property {string} name
 * @property {string} path
 * @property {string} platform
 * @property {string} stack
 * @property {string} stackName
 * @property {string} category
 * @property {string} confidence
 * @property {string[]} evidence
 * @property {string} color
 * @property {string} description
 * @property {string|null} website
 * @property {object} metadata
 * @property {number} sizeBytes
 * @property {{signed:boolean,adHoc:boolean,authorities:string[],teamId:string|null,developer:string|null,signingTime:string|null,hardenedRuntime:boolean,format:string|null,identifier:string|null,notarizationTicket?:boolean,publisher?:string|null,organization?:string|null,status?:string}|null} signature
 * @property {{accepted:boolean,rejected:boolean,source:string|null,notarized:boolean}|null} notarization
 */
