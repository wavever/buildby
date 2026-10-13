import fs from 'fs';
import path from 'path';

export const meta = {
  id: 'flutter',
  name: 'Flutter',
  category: 'cross-platform',
  color: 'blue',
  description: 'Google\'s UI toolkit for building natively compiled applications',
  website: 'https://flutter.dev',
};

function readFlutterVersion(versionJsonPath) {
  try {
    if (!fs.existsSync(versionJsonPath)) return null;
    const content = fs.readFileSync(versionJsonPath, 'utf8');
    const data = JSON.parse(content);
    return data.version || data.flutter_version || null;
  } catch {
    return null;
  }
}

export function detect(appPath, platform) {
  const evidence = [];
  let frameworkVersion = null;

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');

    if (fs.existsSync(path.join(frameworksDir, 'FlutterMacOS.framework'))) {
      evidence.push('FlutterMacOS.framework');
    }
    if (fs.existsSync(path.join(frameworksDir, 'App.framework'))) {
      const flutterAssets = path.join(frameworksDir, 'App.framework', 'flutter_assets');
      if (fs.existsSync(flutterAssets)) {
        evidence.push('App.framework/flutter_assets');
      } else {
        evidence.push('App.framework');
      }

      const versionCandidates = [
        path.join(flutterAssets, 'version.json'),
        path.join(frameworksDir, 'App.framework', 'Resources', 'flutter_assets', 'version.json'),
      ];
      for (const p of versionCandidates) {
        frameworkVersion = readFlutterVersion(p);
        if (frameworkVersion) break;
      }
    }

    if (!frameworkVersion) {
      frameworkVersion = readFlutterVersion(path.join(resourcesDir, 'flutter_assets', 'version.json'));
    }

    if (fs.existsSync(path.join(resourcesDir, 'flutter_assets'))) {
      evidence.push('flutter_assets');
    }
  } else if (platform === 'win32') {
    if (fs.existsSync(path.join(appPath, 'flutter_windows.dll'))) {
      evidence.push('flutter_windows.dll');
    }
    if (fs.existsSync(path.join(appPath, 'data', 'flutter_assets'))) {
      evidence.push('data/flutter_assets');
      frameworkVersion = readFlutterVersion(path.join(appPath, 'data', 'flutter_assets', 'version.json'));
    }
    if (fs.existsSync(path.join(appPath, 'data', 'app.so'))) {
      evidence.push('data/app.so');
    }
  }

  if (evidence.length === 0) return null;

  if (frameworkVersion) {
    evidence.push(`Flutter version: ${frameworkVersion}`);
  }

  return {
    ...meta,
    frameworkVersion: frameworkVersion || null,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
