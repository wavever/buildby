import fs from 'fs';
import path from 'path';
import { execCached } from '../commandCache.js';

export const meta = {
  id: 'native',
  name: 'Native',
  category: 'native',
  color: 'white',
  description: 'Built with platform-native technologies (Swift/Objective-C on macOS, Win32/MFC/WinUI on Windows)',
  website: null,
};

/**
 * Run otool -L on a Mach-O binary and return the raw output.
 */
function getLinkedLibraries(executablePath) {
  return execCached('otool', ['-L', executablePath], {
    timeout: 3000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * Resolve the main executable path from Info.plist or MacOS directory.
 */
function resolveExecutable(appPath) {
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');

  try {
    if (fs.existsSync(plistPath)) {
      const content = fs.readFileSync(plistPath, 'utf8');
      const m = content.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/);
      if (m) {
        const p = path.join(macosDir, m[1]);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch { /* ignore */ }

  try {
    const entries = fs.readdirSync(macosDir);
    if (entries.length > 0) return path.join(macosDir, entries[0]);
  } catch { /* ignore */ }

  return null;
}

/**
 * Detect macOS native sub-technologies:
 *   Language: Swift vs Objective-C
 *   UI framework: SwiftUI / AppKit / Mac Catalyst (UIKit)
 */
function detectMacOSDetails(appPath) {
  const evidence = [];
  const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');

  let hasSwiftBundled = false;
  let swiftLibCount = 0;
  let hasSwiftUILib = false;

  // ── Phase 1: Frameworks directory (fast, no subprocess) ───────────────────
  try {
    const items = fs.readdirSync(frameworksDir);
    const swiftLibs = items.filter((i) => i.startsWith('libswift') && i.endsWith('.dylib'));
    swiftLibCount = swiftLibs.length;
    hasSwiftBundled = swiftLibCount > 0;
    hasSwiftUILib = swiftLibs.some((l) => l === 'libswiftSwiftUI.dylib');

    const hasOnlyAppleFrameworks = items.every(
      (item) =>
        item.startsWith('libswift') ||
        item.endsWith('.dylib') ||
        [
          'Sparkle.framework',
          'Mantle.framework',
          'ReactiveObjC.framework',
          'Fabric.framework',
          'Crashlytics.framework',
          'Sentry.framework',
          'SentryPrivate.framework',
        ].includes(item) ||
        item.endsWith('.bundle'),
    );

    if (items.length > 0 && hasOnlyAppleFrameworks) {
      evidence.push('No cross-platform framework detected');
    }
  } catch {
    evidence.push('macOS native binary');
  }

  // ── Phase 2: otool -L on main executable (precise framework detection) ────
  let hasSwiftUI = hasSwiftUILib;
  let hasAppKit = false;
  let hasUIKit = false;
  let hasSwiftSystem = false;

  const execPath = resolveExecutable(appPath);
  if (execPath) {
    const otool = getLinkedLibraries(execPath);
    if (otool) {
      hasSwiftUI = hasSwiftUI || otool.includes('SwiftUI.framework');
      hasAppKit = otool.includes('AppKit.framework');
      hasUIKit = otool.includes('UIKit.framework');
      hasSwiftSystem =
        otool.includes('libswiftCore') ||
        otool.includes('/usr/lib/swift/');
    }
  }

  const isSwift = hasSwiftBundled || hasSwiftSystem;

  // ── Determine UI framework ────────────────────────────────────────────────
  let uiFramework = null;

  if (hasUIKit) {
    uiFramework = 'Mac Catalyst';
    evidence.push('UIKit.framework linked (Mac Catalyst)');
  } else if (hasSwiftUI) {
    uiFramework = 'SwiftUI';
    evidence.push('SwiftUI.framework linked');
  } else if (hasAppKit) {
    uiFramework = 'AppKit';
    evidence.push('AppKit.framework linked');
  }

  // ── Language evidence ─────────────────────────────────────────────────────
  if (isSwift && swiftLibCount > 0) {
    evidence.push(`Swift runtime (${swiftLibCount} bundled libs)`);
  } else if (isSwift) {
    evidence.push('Swift (system runtime)');
  } else {
    evidence.push('Objective-C (no Swift runtime detected)');
  }

  // ── Build display name ────────────────────────────────────────────────────
  const lang = isSwift ? 'Swift' : 'Objective-C';
  const name = uiFramework
    ? `Native (${lang} · ${uiFramework})`
    : `Native (${lang})`;

  // ── Info.plist ────────────────────────────────────────────────────────────
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  if (fs.existsSync(plistPath)) {
    evidence.push('Info.plist present');
  }

  return { name, evidence };
}

export function detect(appPath, platform, { includeNativeDetails = true } = {}) {
  if (platform === 'darwin') {
    if (!includeNativeDetails) {
      return {
        ...meta,
        confidence: 'medium',
        evidence: ['No cross-platform framework detected'],
      };
    }

    const { name, evidence } = detectMacOSDetails(appPath);
    return {
      ...meta,
      name,
      confidence: 'medium',
      evidence,
    };
  }

  if (platform === 'win32') {
    const evidence = ['Native Windows app (no cross-platform signatures)'];
    try {
      const files = fs.readdirSync(appPath);
      const exeFiles = files.filter((f) => f.endsWith('.exe'));
      if (exeFiles.length === 1) {
        evidence.push(exeFiles[0]);
      }
    } catch { /* ignore */ }

    return {
      ...meta,
      confidence: 'medium',
      evidence,
    };
  }

  return {
    ...meta,
    confidence: 'medium',
    evidence: ['Native app (no cross-platform signatures)'],
  };
}
