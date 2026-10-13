import fs from 'fs';
import path from 'path';
import { execCached } from '../commandCache.js';
import { binaryContainsAny, resolveWindowsExecutable } from './shared.js';
import { getMachOLinkedLibraries } from '../binary.js';

const TAURI_MARKERS = ['tauri-runtime-wry', 'tauri::', '/tauri-'];

const TAURI_V2_MARKERS = [
  'tauri-runtime-wry/2',
  'tauri-runtime/2',
  'tauri-build/2',
  'tauri-2.',
  '/tauri-2.',
  'tauri@2',
  'tauri-plugin-',
  'plugin:tauri',
  'plugins.tauri.app',
];

const TAURI_V1_MARKERS = [
  'tauri-runtime-wry/1',
  'tauri-runtime/1',
  'tauri-build/1',
  'tauri-1.',
  '/tauri-1.',
  'tauri@1',
];

export const meta = {
  id: 'tauri',
  name: 'Tauri',
  category: 'cross-platform',
  color: 'magenta',
  description: 'Rust-based framework using system WebView (lightweight alternative to Electron)',
  website: 'https://tauri.app',
};

/**
 * Check if a binary links against WebKit.
 * Prefers pure-JS Mach-O parsing, falling back to `otool -L`.
 */
function linksWebKit(binaryPath) {
  try {
    const libs = getMachOLinkedLibraries(binaryPath);
    if (libs && libs.length > 0) {
      return libs.some((lib) => lib.includes('WebKit.framework'));
    }
  } catch {
    // fallback
  }

  const output = execCached('otool', ['-L', binaryPath], {
    timeout: 3000,
    maxBuffer: 256 * 1024,
  });
  return output.includes('WebKit.framework');
}

/**
 * Check if a binary contains Tauri-specific strings (crate paths, symbols).
 * Streams the file via binaryContainsAny without spawning `strings`.
 */
function containsTauriSignature(binaryPath) {
  return binaryContainsAny(binaryPath, TAURI_MARKERS, { maxBytes: 160 * 1024 * 1024 }) !== null;
}

export function detect(appPath, platform) {
  const evidence = [];
  let detectedVariant = null;

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
    let hasIndexHtml = false;
    try {
      const resourcesItems = fs.readdirSync(resourcesDir);

      for (const item of resourcesItems) {
        const p = path.join(resourcesDir, item);
        const stat = fs.statSync(p);

        if (stat.isFile() && (item === 'index.html' || item === 'index.htm')) {
          hasIndexHtml = true;
          break;
        }

        if (stat.isDirectory()) {
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

        const shouldScanBinary =
          (hasWebKitLink || hasIndexHtml) &&
          !hasHeavyFramework &&
          stat.size <= 160 * 1024 * 1024;

        if (shouldScanBinary && containsTauriSignature(binPath)) {
          evidence.push('Tauri framework signature in binary');

          // Check for v1 vs v2 indicators
          if (binaryContainsAny(binPath, TAURI_V2_MARKERS, { maxBytes: 160 * 1024 * 1024 })) {
            detectedVariant = 'v2';
          } else if (binaryContainsAny(binPath, TAURI_V1_MARKERS, { maxBytes: 160 * 1024 * 1024 })) {
            detectedVariant = 'v1';
          }
        }

        if (evidence.length > 0) break;
      }
    } catch {
      // ignore
    }

    if (!detectedVariant) {
      if (hasIndexHtml) {
        detectedVariant = 'v1';
      } else if (evidence.some((e) => e.includes('Tauri framework signature'))) {
        detectedVariant = 'v2';
      }
    }
  } else if (platform === 'win32') {
    // Tauri on Windows uses WebView2
    if (fs.existsSync(path.join(appPath, 'WebView2Loader.dll'))) {
      evidence.push('WebView2Loader.dll');
    }

    try {
      const files = fs.readdirSync(appPath);
      const hasWebView2 = evidence.length > 0;

      const exeFiles = files.filter((f) => f.endsWith('.exe'));
      if (hasWebView2 && exeFiles.length === 1) {
        evidence.push(`Single executable: ${exeFiles[0]}`);
      }
    } catch {
      // ignore
    }

    const exePath = resolveWindowsExecutable(appPath);
    if (exePath && binaryContainsAny(exePath, TAURI_MARKERS)) {
      evidence.push('Tauri framework signature in binary');

      if (binaryContainsAny(exePath, TAURI_V2_MARKERS)) {
        detectedVariant = 'v2';
      } else if (binaryContainsAny(exePath, TAURI_V1_MARKERS)) {
        detectedVariant = 'v1';
      }
    }
  }

  if (evidence.length === 0) return null;

  const hasWebKitLink = evidence.some((e) => e.includes('WebKit.framework'));
  const hasBundledIndex = evidence.some((e) => e.includes('index.html'));
  const hasTauriSig = evidence.some((e) => e.includes('Tauri framework signature'));
  const hasWebView2 = evidence.includes('WebView2Loader.dll');

  if (!hasTauriSig && !hasWebView2) return null;
  if (hasWebView2 && !hasTauriSig) return null;

  let confidence = 'high';
  if (hasTauriSig && (hasWebKitLink || hasBundledIndex || hasWebView2)) confidence = 'high';
  else if (hasTauriSig) confidence = 'medium';

  return {
    ...meta,
    variant: detectedVariant,
    confidence,
    evidence,
  };
}
