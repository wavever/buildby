import fs from 'fs';
import path from 'path';

export const meta = {
  id: 'electron',
  name: 'Electron',
  category: 'cross-platform',
  color: 'cyan',
  description: 'Cross-platform desktop apps with web technologies (HTML/CSS/JS)',
  website: 'https://www.electronjs.org',
};

function readPlistVersion(plistPath) {
  try {
    if (!fs.existsSync(plistPath)) return null;
    const content = fs.readFileSync(plistPath, 'utf8');
    const shortVer = content.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    if (shortVer) return shortVer.trim().replace(/^v/, '');
    const bundleVer = content.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    if (bundleVer) return bundleVer.trim().replace(/^v/, '');
  } catch {
    // ignore
  }
  return null;
}

function readVersionFile(verPath) {
  try {
    if (!fs.existsSync(verPath)) return null;
    const content = fs.readFileSync(verPath, 'utf8').trim();
    const match = content.match(/^v?(\d+\.\d+[\w.-]*)/);
    if (match) return match[1];
  } catch {
    // ignore
  }
  return null;
}

export function detect(appPath, platform) {
  const evidence = [];
  let frameworkVersion = null;

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');
    const electronFramework = path.join(frameworksDir, 'Electron Framework.framework');

    if (fs.existsSync(electronFramework)) {
      evidence.push('Electron Framework.framework');

      // Try reading framework version
      const plistCandidates = [
        path.join(electronFramework, 'Resources', 'Info.plist'),
        path.join(electronFramework, 'Versions', 'Current', 'Resources', 'Info.plist'),
        path.join(electronFramework, 'Info.plist'),
      ];
      for (const p of plistCandidates) {
        frameworkVersion = readPlistVersion(p);
        if (frameworkVersion) break;
      }

      if (!frameworkVersion) {
        const verFileCandidates = [
          path.join(electronFramework, 'Resources', 'version'),
          path.join(electronFramework, 'version'),
        ];
        for (const p of verFileCandidates) {
          frameworkVersion = readVersionFile(p);
          if (frameworkVersion) break;
        }
      }
    }
    if (fs.existsSync(path.join(resourcesDir, 'app.asar'))) {
      evidence.push('app.asar');
    }
    if (fs.existsSync(path.join(resourcesDir, 'electron.asar'))) {
      evidence.push('electron.asar');
    }
    // Some Electron apps (e.g. VSCode) ship as unpacked app/ directory instead of app.asar
    if (
      !evidence.includes('app.asar') &&
      fs.existsSync(path.join(resourcesDir, 'app')) &&
      fs.existsSync(path.join(resourcesDir, 'app', 'package.json'))
    ) {
      evidence.push('app/ (unpacked Electron app)');
    }

    // NW.js also uses Electron-like structure but different framework name
    // Check for helper apps pattern: AppName Helper (Renderer).app
    if (evidence.length === 0 && fs.existsSync(frameworksDir)) {
      try {
        const items = fs.readdirSync(frameworksDir);
        const hasElectronHelper = items.some(
          (item) => item.includes('Helper') && item.endsWith('.app') && !item.includes('nwjs')
        );
        const hasAsar = fs.existsSync(path.join(resourcesDir, 'app.asar'));
        if (hasElectronHelper && hasAsar) {
          evidence.push('Electron Helper apps pattern');
          evidence.push('app.asar');
        }
      } catch {
        // ignore
      }
    }
  } else if (platform === 'win32') {
    // Check resources/app.asar or resources/electron.asar
    if (fs.existsSync(path.join(appPath, 'resources', 'app.asar'))) {
      evidence.push('resources/app.asar');
    }
    if (fs.existsSync(path.join(appPath, 'resources', 'electron.asar'))) {
      evidence.push('resources/electron.asar');
    }
    // Check for electron.exe or *Helper*.exe
    try {
      const files = fs.readdirSync(appPath);
      const electronExe = files.find(
        (f) => f.toLowerCase() === 'electron.exe' || f.toLowerCase().includes(' helper.exe')
      );
      if (electronExe) evidence.push(electronExe);
    } catch {
      // ignore
    }

    // Try reading version file on Windows
    frameworkVersion =
      readVersionFile(path.join(appPath, 'version')) ||
      readVersionFile(path.join(appPath, 'resources', 'version'));
  }

  if (evidence.length === 0) return null;

  if (frameworkVersion) {
    evidence.push(`Electron version: ${frameworkVersion}`);
  }

  return {
    ...meta,
    frameworkVersion: frameworkVersion || null,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
