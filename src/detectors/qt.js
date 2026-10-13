import fs from 'fs';
import path from 'path';
import { listFrameworksDeep } from './shared.js';

export const meta = {
  id: 'qt',
  name: 'Qt',
  category: 'cross-platform',
  color: 'green',
  description: 'C++ cross-platform framework with native look and feel',
  website: 'https://www.qt.io',
};

function readQtPlistVersion(frameworkPath) {
  const plistCandidates = [
    path.join(frameworkPath, 'Resources', 'Info.plist'),
    path.join(frameworkPath, 'Versions', 'Current', 'Resources', 'Info.plist'),
    path.join(frameworkPath, 'Versions', '5', 'Resources', 'Info.plist'),
    path.join(frameworkPath, 'Versions', '6', 'Resources', 'Info.plist'),
    path.join(frameworkPath, 'Versions', 'A', 'Resources', 'Info.plist'),
    path.join(frameworkPath, 'Info.plist'),
  ];

  for (const plistPath of plistCandidates) {
    try {
      if (!fs.existsSync(plistPath)) continue;
      const content = fs.readFileSync(plistPath, 'utf8');
      const shortVer = content.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
      if (shortVer) return shortVer.trim();
      const bundleVer = content.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
      if (bundleVer) return bundleVer.trim();
    } catch {
      // ignore
    }
  }
  return null;
}

export function detect(appPath, platform) {
  const evidence = [];
  let frameworkVersion = null;

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');

    // Scan one level deep: vendors sometimes group Qt in a subdirectory
    // (WPS Office ships QtCoreKso.framework under Frameworks/office6/).
    const deepEntries = listFrameworksDeep(frameworksDir);
    const items = deepEntries.map((entry) => entry.name);

    // Qt frameworks (e.g. QtCore.framework, Qt6Core.framework, QtCoreKso.framework)
    for (const item of items) {
      if (item.startsWith('Qt') && item.endsWith('.framework')) {
        evidence.push(item);
        if (evidence.length >= 3) break;
      }
    }

    // Try extracting Qt version from QtCore.framework or any Qt*Core.framework
    const coreEntry = deepEntries.find(
      (entry) =>
        entry.name === 'QtCore.framework' ||
        entry.name === 'Qt6Core.framework' ||
        entry.name === 'Qt5Core.framework' ||
        (entry.name.startsWith('QtCore') && entry.name.endsWith('.framework'))
    );
    if (coreEntry) {
      frameworkVersion = readQtPlistVersion(path.join(coreEntry.dir, coreEntry.name));
    }

    // Some Qt apps ship Qt as dylib instead of framework
    if (evidence.length === 0) {
      const qtLibs = items.filter((item) => item.startsWith('libQt') && item.endsWith('.dylib'));
      if (qtLibs.length > 0) {
        evidence.push(...qtLibs.slice(0, 2));
      }
    }

    if (fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'qt.conf'))) {
      evidence.push('qt.conf');
    }
  } else if (platform === 'win32') {
    const qtDlls = [
      'Qt5Core.dll',
      'Qt6Core.dll',
      'Qt5Widgets.dll',
      'Qt6Widgets.dll',
      'Qt5Gui.dll',
      'Qt6Gui.dll',
    ];

    for (const dll of qtDlls) {
      if (fs.existsSync(path.join(appPath, dll))) {
        evidence.push(dll);
        if (evidence.length >= 3) break;
      }
    }
  }

  if (evidence.length === 0) return null;

  if (frameworkVersion) {
    evidence.push(`Qt version: ${frameworkVersion}`);
  }

  return {
    ...meta,
    frameworkVersion: frameworkVersion || null,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
