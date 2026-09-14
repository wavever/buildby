import path from 'path';
import { listDir } from './shared.js';

export const meta = {
  id: 'compose',
  name: 'Compose Multiplatform',
  category: 'cross-platform',
  color: 'magenta',
  description: "JetBrains' Kotlin UI framework rendering through Skia (skiko)",
  website: 'https://www.jetbrains.com/compose-multiplatform/',
};

/**
 * Compose Desktop runs on the JVM, so it also trips the JVM detector. What
 * makes it identifiable is skiko — the Skia binding Compose renders through —
 * which ships as a native library plus an awt runtime jar.
 */
export function detect(appPath, platform) {
  const evidence = [];

  const searchDirs = platform === 'darwin'
    ? [
        path.join(appPath, 'Contents', 'app'),
        path.join(appPath, 'Contents', 'Frameworks'),
        path.join(appPath, 'Contents', 'MacOS'),
        path.join(appPath, 'Contents', 'Resources'),
        path.join(appPath, 'Contents', 'app', 'resources'),
      ]
    : [appPath, path.join(appPath, 'app'), path.join(appPath, 'runtime', 'bin')];

  for (const dir of searchDirs) {
    for (const item of listDir(dir)) {
      if (/^libskiko-(macos|linux)/.test(item) || /^skiko\.dll$/i.test(item)) {
        evidence.push(item);
      } else if (/^skiko-awt-runtime.*\.jar$/.test(item) || /^skiko-jvm.*\.jar$/.test(item)) {
        evidence.push(item);
      } else if (/^org\.jetbrains\.compose\..*\.jar$/.test(item)) {
        evidence.push(item);
      }

      if (evidence.length >= 3) break;
    }
    if (evidence.length >= 3) break;
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: 'high',
    evidence,
  };
}
