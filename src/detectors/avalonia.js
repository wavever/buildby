import path from 'path';
import { listDir } from './shared.js';

export const meta = {
  id: 'avalonia',
  name: 'Avalonia',
  category: 'cross-platform',
  color: 'magenta',
  description: 'Cross-platform .NET UI framework with its own Skia-based renderer',
  website: 'https://avaloniaui.net',
};

/**
 * Avalonia apps are .NET apps, so the .NET detector also matches them. Its own
 * assemblies are distinctive enough to name the UI framework instead of
 * lumping it in with WPF/WinForms/MAUI.
 */
export function detect(appPath, platform) {
  const evidence = [];

  const searchDirs = platform === 'darwin'
    ? [
        path.join(appPath, 'Contents', 'MonoBundle'),
        path.join(appPath, 'Contents', 'MacOS'),
        path.join(appPath, 'Contents', 'Resources'),
        path.join(appPath, 'Contents', 'Frameworks'),
      ]
    : [appPath];

  for (const dir of searchDirs) {
    for (const item of listDir(dir)) {
      if (/^Avalonia(\.[A-Za-z0-9]+)*\.dll$/i.test(item) || /^libAvalonia/i.test(item)) {
        evidence.push(item);
        if (evidence.length >= 3) break;
      }
    }
    if (evidence.length >= 3) break;
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
