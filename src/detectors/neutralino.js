import fs from 'fs';
import path from 'path';
import { binaryContainsAny, resolveMainExecutable, resolveWindowsExecutable } from './shared.js';

export const meta = {
  id: 'neutralino',
  name: 'Neutralinojs',
  category: 'cross-platform',
  color: 'cyan',
  description: 'Lightweight portable desktop framework using native browser engines',
  website: 'https://neutralino.js.org',
};

const NEUTRALINO_BINARY_MARKERS = ['neutralino', 'NL_NAME'];

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');
    const macosDir = path.join(appPath, 'Contents', 'MacOS');

    if (fs.existsSync(path.join(resourcesDir, 'neutralino.config.json'))) {
      evidence.push('neutralino.config.json in Resources');
    } else if (fs.existsSync(path.join(macosDir, 'neutralino.config.json'))) {
      evidence.push('neutralino.config.json in MacOS');
    } else if (fs.existsSync(path.join(appPath, 'neutralino.config.json'))) {
      evidence.push('neutralino.config.json');
    }

    if (fs.existsSync(path.join(resourcesDir, 'res.neu'))) {
      evidence.push('res.neu (bundled resource package)');
    } else if (fs.existsSync(path.join(macosDir, 'res.neu'))) {
      evidence.push('res.neu in MacOS');
    }

    const execPath = resolveMainExecutable(appPath);
    if (execPath && binaryContainsAny(execPath, NEUTRALINO_BINARY_MARKERS)) {
      evidence.push('Neutralinojs signature in binary');
    }
  } else if (platform === 'win32') {
    if (fs.existsSync(path.join(appPath, 'neutralino.config.json'))) {
      evidence.push('neutralino.config.json');
    }
    if (fs.existsSync(path.join(appPath, 'res.neu'))) {
      evidence.push('res.neu (bundled resource package)');
    }

    const exePath = resolveWindowsExecutable(appPath);
    if (exePath && binaryContainsAny(exePath, NEUTRALINO_BINARY_MARKERS)) {
      evidence.push('Neutralinojs signature in binary');
    }
  } else {
    // Linux / generic fallback
    if (fs.existsSync(path.join(appPath, 'neutralino.config.json'))) {
      evidence.push('neutralino.config.json');
    }
    if (fs.existsSync(path.join(appPath, 'res.neu'))) {
      evidence.push('res.neu');
    }

    try {
      const stat = fs.statSync(appPath);
      if (stat.isFile() && binaryContainsAny(appPath, NEUTRALINO_BINARY_MARKERS)) {
        evidence.push('Neutralinojs signature in binary');
      }
    } catch {
      // ignore
    }
  }

  if (evidence.length === 0) return null;

  const hasConfig = evidence.some((e) => e.includes('neutralino.config.json') || e.includes('res.neu'));
  const hasBinarySig = evidence.some((e) => e.includes('Neutralinojs signature'));

  return {
    ...meta,
    confidence: hasConfig ? 'high' : (hasBinarySig ? 'medium' : 'low'),
    evidence,
  };
}
