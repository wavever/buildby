import fs from 'fs';
import path from 'path';
import { listDir } from './shared.js';

export const meta = {
  id: 'unreal',
  name: 'Unreal Engine',
  category: 'cross-platform',
  color: 'white',
  description: 'Epic Games Unreal Engine (UE4 / UE5) applications',
  website: 'https://www.unrealengine.com',
};

/**
 * Locate the `<Project>/Content/Paks` directory that every cooked Unreal build
 * ships, searching the one or two levels where packagers place it.
 */
function findPakDir(roots) {
  for (const root of roots) {
    const direct = path.join(root, 'Content', 'Paks');
    if (fs.existsSync(direct)) return direct;

    for (const child of listDir(root)) {
      const nested = path.join(root, child, 'Content', 'Paks');
      if (fs.existsSync(nested)) return nested;
    }
  }
  return null;
}

export function detect(appPath, platform) {
  const evidence = [];

  const roots = platform === 'darwin'
    ? [path.join(appPath, 'Contents', 'UE4'), path.join(appPath, 'Contents', 'UE5'), path.join(appPath, 'Contents', 'Resources')]
    : [appPath];

  const pakDir = findPakDir(roots);
  if (pakDir) {
    const paks = listDir(pakDir).filter((f) => f.endsWith('.pak') || f.endsWith('.utoc'));
    if (paks.length > 0) {
      evidence.push(`Content/Paks (${paks.length} cooked asset archives)`);
    }
  }

  if (platform === 'darwin') {
    for (const version of ['UE4', 'UE5']) {
      if (fs.existsSync(path.join(appPath, 'Contents', version))) {
        evidence.push(`Contents/${version}/`);
      }
    }
  } else {
    if (fs.existsSync(path.join(appPath, 'Engine', 'Binaries'))) {
      evidence.push('Engine/Binaries/');
    }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
