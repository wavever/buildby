import fs from 'fs';
import path from 'path';

export const meta = {
  id: 'chromium',
  name: 'Chromium',
  category: 'cross-platform',
  color: 'yellow',
  description: 'Built directly on the Chromium open-source project (Chrome, Brave, Edge, etc.)',
  website: 'https://www.chromium.org',
};

// Frameworks already handled by dedicated detectors — skip them here
const SKIP_FRAMEWORKS = new Set([
  'Electron Framework.framework',
  'Chromium Embedded Framework.framework',
  'nwjs Framework.framework',
]);

/**
 * QtWebEngine embeds Chromium, so its framework carries .pak files and a V8
 * snapshot. Attributing those to "Chromium" hides the real stack — an app
 * shipping QtWebEngineCore.framework is a Qt app. Let the Qt detector own it.
 */
function isQtFramework(name) {
  return name.startsWith('Qt');
}

/**
 * Resolve the versioned content root inside a macOS .framework bundle.
 * Tries Versions/Current (standard symlink), then the first Versions/* subdir.
 */
function resolveFrameworkBase(fwPath) {
  const currentPath = path.join(fwPath, 'Versions', 'Current');
  if (fs.existsSync(currentPath)) {
    try { return fs.realpathSync(currentPath); } catch { return currentPath; }
  }
  try {
    const versionsDir = path.join(fwPath, 'Versions');
    const versions = fs.readdirSync(versionsDir);
    for (const ver of versions) {
      if (ver === 'Current' || ver === '..') continue;
      return path.join(versionsDir, ver);
    }
  } catch { /* ignore */ }
  return fwPath;
}

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');

    try {
      const items = fs.readdirSync(frameworksDir);

      for (const item of items) {
        if (!item.endsWith('.framework') || SKIP_FRAMEWORKS.has(item) || isQtFramework(item)) continue;

        const fwPath = path.join(frameworksDir, item);
        const basePath = resolveFrameworkBase(fwPath);

        // Signal 1: Chromium resource packs (.pak) inside the framework
        let hasPakFiles = false;
        try {
          const resourcesPath = path.join(basePath, 'Resources');
          const resources = fs.readdirSync(resourcesPath);
          hasPakFiles = resources.some((r) => r.endsWith('.pak'));
        } catch { /* ignore */ }

        // Signal 2: V8 JavaScript engine snapshots
        let hasV8Snapshot = false;
        try {
          const resourcesPath = path.join(basePath, 'Resources');
          const resources = fs.readdirSync(resourcesPath);
          hasV8Snapshot = resources.some((r) => r.startsWith('v8_context_snapshot'));
        } catch { /* ignore */ }

        // Signal 3: Chromium helper processes
        let hasHelpers = false;
        try {
          const helpersPath = path.join(basePath, 'Helpers');
          const helpers = fs.readdirSync(helpersPath);
          hasHelpers = helpers.some((h) => h.includes('Helper') && h.endsWith('.app'));
        } catch { /* ignore */ }

        // Signal 4: Chromium renderer libraries (libEGL, libGLESv2)
        let hasRendererLibs = false;
        try {
          const libsPath = path.join(basePath, 'Libraries');
          const libs = fs.readdirSync(libsPath);
          hasRendererLibs = libs.some((l) => l === 'libEGL.dylib' || l === 'libGLESv2.dylib');
        } catch { /* ignore */ }

        if (hasV8Snapshot || (hasPakFiles && (hasHelpers || hasRendererLibs))) {
          evidence.push(`Chromium framework: ${item}`);
          if (hasV8Snapshot) evidence.push('V8 JavaScript engine snapshot');
          if (hasPakFiles) evidence.push('Chromium resource packs (.pak)');
          if (hasHelpers) evidence.push('Chromium helper processes');
          if (hasRendererLibs) evidence.push('Chromium renderer libraries (EGL/GLES)');
          break;
        }
      }
    } catch {
      // no frameworks dir
    }
  } else if (platform === 'win32') {
    // Chromium-based browsers on Windows bundle chrome.dll alongside the exe
    if (fs.existsSync(path.join(appPath, 'chrome.dll'))) {
      evidence.push('chrome.dll');
    }
    // v8 snapshot
    try {
      const files = fs.readdirSync(appPath);
      const v8 = files.find((f) => f.startsWith('v8_context_snapshot'));
      if (v8) evidence.push(`V8 snapshot: ${v8}`);
      const paks = files.filter((f) => f.endsWith('.pak'));
      if (paks.length > 2) evidence.push(`${paks.length} .pak resource files`);
    } catch { /* ignore */ }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
