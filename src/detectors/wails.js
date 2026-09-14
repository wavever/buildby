import fs from 'fs';
import path from 'path';
import { binaryContainsAny, resolveMainExecutable, resolveWindowsExecutable } from './shared.js';

export const meta = {
  id: 'wails',
  name: 'Wails',
  category: 'cross-platform',
  color: 'cyan',
  description: 'Go backend with the system WebView (WKWebView / WebView2)',
  website: 'https://wails.io',
};

// Wails links its runtime by module path, which survives into the binary.
const WAILS_MARKERS = [
  'github.com/wailsapp/wails',
  'wailsapp/wails/v2',
  'wails.localhost',
];

// Wails bundles are compact single binaries; bound the read so this probe does
// not dominate a full scan when it runs against unrelated large apps.
const PROBE_MAX_BYTES = 192 * 1024 * 1024;

export function detect(appPath, platform) {
  let exePath = null;

  if (platform === 'darwin') {
    exePath = resolveMainExecutable(appPath);
  } else if (platform === 'win32') {
    exePath = resolveWindowsExecutable(appPath);
  }

  if (!exePath) return null;

  // The module path is the only signal that separates Wails from any other Go
  // binary hosting a system WebView, so it is required rather than corroborating.
  const marker = binaryContainsAny(exePath, WAILS_MARKERS, { maxBytes: PROBE_MAX_BYTES });
  if (!marker) return null;

  const evidence = [`${marker} in binary`];

  if (platform === 'darwin') {
    if (fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'index.html'))) {
      evidence.push('Bundled index.html (web UI assets)');
    }
  } else if (fs.existsSync(path.join(appPath, 'WebView2Loader.dll'))) {
    evidence.push('WebView2Loader.dll');
  }

  return {
    ...meta,
    confidence: 'high',
    evidence,
  };
}
