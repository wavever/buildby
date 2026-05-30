import fs from 'fs';
import path from 'path';
import { execCached } from '../commandCache.js';

export const meta = {
  id: 'tauri',
  name: 'Tauri',
  category: 'cross-platform',
  color: 'magenta',
  description: 'Rust-based framework using system WebView (lightweight alternative to Electron)',
  website: 'https://tauri.app',
};

/**
 * Use `otool -L` (macOS only) to check if a binary links against WebKit.
 * This is very fast (~20ms) and reliable for detecting Tauri apps.
 */
function linksWebKit(binaryPath) {
  const output = execCached('otool', ['-L', binaryPath], {
    timeout: 3000,
    maxBuffer: 256 * 1024,
  });
  return output.includes('WebKit.framework');
}

/**
 * Check if a binary contains Tauri-specific strings (crate paths, symbols).
 * Tauri v2 embeds web assets directly into the binary via include_dir!,
 * so we can't rely on external index.html alone.
 */
function containsTauriSignature(binaryPath) {
  const output = execCached('strings', ['-n', '12', binaryPath], {
    timeout: 5000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const markers = [
    'tauri-runtime-wry',
    'tauri::',
    '/tauri-',
  ];
  return markers.some((m) => output.includes(m));
}

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
    const macosDir = path.join(appPath, 'Contents', 'MacOS');
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');

    // Tauri apps have minimal frameworks (no Electron/Flutter/CEF)
    // but use system WebKit/WKWebView
    let hasHeavyFramework = false;
    try {
      const items = fs.readdirSync(frameworksDir);
      hasHeavyFramework = items.some((item) =>
        item.includes('Electron Framework') ||
        item.includes('FlutterMacOS') ||
        item.includes('Chromium Embedded Framework') ||
        item.includes('QtCore')
      );
    } catch {
      // no frameworks dir is fine for Tauri
    }

    if (hasHeavyFramework) return null;

    // Check Resources for bundled web assets (Tauri front-end)
    // We intentionally only do a shallow scan for performance.
    try {
      const resourcesItems = fs.readdirSync(resourcesDir);
      let hasIndexHtml = false;

      for (const item of resourcesItems) {
        const p = path.join(resourcesDir, item);
        const stat = fs.statSync(p);

        if (stat.isFile() && (item === 'index.html' || item === 'index.htm')) {
          hasIndexHtml = true;
          break;
        }

        if (stat.isDirectory()) {
          // One-level-deep scan for index.html in typical dist/build folders
          try {
            const subItems = fs.readdirSync(p);
            if (subItems.some((f) => f === 'index.html' || f === 'index.htm')) {
              hasIndexHtml = true;
              break;
            }
          } catch {
            // ignore subdir errors
          }
        }
      }

      if (hasIndexHtml) {
        evidence.push('Bundled index.html inside Resources (web UI assets)');
      }
    } catch {
      // No Resources directory or unreadable – ignore
    }

    // Use otool -L to check if main binary links against system WebKit
    // Tauri apps use WKWebView (system WebKit), unlike Electron which bundles Chromium
    try {
      const binaries = fs.readdirSync(macosDir);
      for (const bin of binaries) {
        const binPath = path.join(macosDir, bin);
        const stat = fs.statSync(binPath);
        if (!stat.isFile()) continue;

        const hasWebKitLink = linksWebKit(binPath);
        if (hasWebKitLink) {
          evidence.push('Links system WebKit.framework (WKWebView)');
        }

        // Tauri v2 embeds web assets into the binary — no external index.html.
        // Fall back to scanning for Tauri crate strings inside the binary.
        const shouldScanBinary =
          hasWebKitLink &&
          !hasHeavyFramework &&
          // `strings` on huge app binaries is expensive. Most Tauri bundles are
          // compact single binaries, so keep this fallback focused.
          stat.size <= 160 * 1024 * 1024;
        if (shouldScanBinary && containsTauriSignature(binPath)) {
          evidence.push('Tauri framework signature in binary');
        }

        if (evidence.length > 0) break;
      }
    } catch {
      // ignore
    }
  } else if (platform === 'win32') {
    // Tauri on Windows uses WebView2
    if (fs.existsSync(path.join(appPath, 'WebView2Loader.dll'))) {
      evidence.push('WebView2Loader.dll');
    }

    // Check for Tauri updater or config
    try {
      const files = fs.readdirSync(appPath);
      const hasWebView2 = evidence.length > 0;

      // Tauri apps typically have a single .exe with WebView2Loader.dll
      const exeFiles = files.filter((f) => f.endsWith('.exe'));
      if (hasWebView2 && exeFiles.length === 1) {
        evidence.push(`Single executable: ${exeFiles[0]}`);
      }
    } catch {
      // ignore
    }
  }

  if (evidence.length === 0) return null;

  const hasWebKitLink = evidence.some((e) => e.includes('WebKit.framework'));
  const hasBundledIndex = evidence.some((e) => e.includes('index.html'));
  const hasTauriSig = evidence.some((e) => e.includes('Tauri framework signature'));
  const hasWebView2 = evidence.includes('WebView2Loader.dll');

  // Tauri signature in binary is the strongest signal.
  // WebKit + index.html alone is NOT sufficient (many native apps use WKWebView + bundled HTML).
  // macOS: require Tauri signature, optionally reinforced by WebKit/index.html
  // Windows: require WebView2 + Tauri signature (WebView2 alone could be any WebView2 app)
  if (!hasTauriSig && !hasWebView2) return null;
  if (hasWebView2 && !hasTauriSig) return null;

  let confidence = 'high';
  if (hasTauriSig && (hasWebKitLink || hasBundledIndex || hasWebView2)) confidence = 'high';
  else if (hasTauriSig) confidence = 'medium';

  return {
    ...meta,
    confidence,
    evidence,
  };
}
