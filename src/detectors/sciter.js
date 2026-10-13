import fs from 'fs';
import path from 'path';
import { binaryContainsAny, listDir, resolveMainExecutable, resolveWindowsExecutable } from './shared.js';
import { getMachOLinkedLibraries } from '../binary.js';

export const meta = {
  id: 'sciter',
  name: 'Sciter',
  category: 'cross-platform',
  color: 'green',
  description: 'Embeddable HTML/CSS/JavaScript UI engine for desktop applications',
  website: 'https://sciter.com',
};

const SCITER_BINARY_MARKERS = ['SciterCreate', 'sciter::'];

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
    const macosDir = path.join(appPath, 'Contents', 'MacOS');

    // Check Frameworks and MacOS directories for sciter dylibs
    const fwItems = listDir(frameworksDir);
    const macosItems = listDir(macosDir);

    const sciterDylib = [...fwItems, ...macosItems].find((item) => {
      const lower = item.toLowerCase();
      return lower.includes('sciter') && (lower.endsWith('.dylib') || lower.endsWith('.framework'));
    });

    if (sciterDylib) {
      evidence.push(`Found Sciter dynamic library: ${sciterDylib}`);
    }

    const execPath = resolveMainExecutable(appPath);
    if (execPath) {
      try {
        const libs = getMachOLinkedLibraries(execPath);
        if (libs.some((lib) => lib.toLowerCase().includes('sciter'))) {
          evidence.push('Links Sciter dynamic library');
        }
      } catch {
        // ignore
      }

      if (binaryContainsAny(execPath, SCITER_BINARY_MARKERS)) {
        evidence.push('Sciter symbols in binary');
      }
    }
  } else if (platform === 'win32') {
    const files = listDir(appPath);
    const sciterDll = files.find((f) => {
      const lower = f.toLowerCase();
      return lower.includes('sciter') && lower.endsWith('.dll');
    });

    if (sciterDll) {
      evidence.push(`Found ${sciterDll}`);
    }

    const exePath = resolveWindowsExecutable(appPath);
    if (exePath && binaryContainsAny(exePath, SCITER_BINARY_MARKERS)) {
      evidence.push('Sciter symbols in binary');
    }
  } else {
    // Linux / generic fallback
    const files = listDir(appPath);
    const sciterLib = files.find((f) => {
      const lower = f.toLowerCase();
      return lower.includes('sciter') && (lower.endsWith('.so') || lower.endsWith('.dll') || lower.endsWith('.dylib'));
    });

    if (sciterLib) {
      evidence.push(`Found ${sciterLib}`);
    }

    try {
      const stat = fs.statSync(appPath);
      if (stat.isFile() && binaryContainsAny(appPath, SCITER_BINARY_MARKERS)) {
        evidence.push('Sciter symbols in binary');
      }
    } catch {
      // ignore
    }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
