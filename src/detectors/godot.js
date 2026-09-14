import path from 'path';
import { listDir, resolveMainExecutable, resolveWindowsExecutable, binaryContainsAny } from './shared.js';

export const meta = {
  id: 'godot',
  name: 'Godot',
  category: 'cross-platform',
  color: 'blue',
  description: 'Open-source game engine (Godot Engine)',
  website: 'https://godotengine.org',
};

const GODOT_MARKERS = ['godotengine', 'GodotEngine', 'godot_'];

export function detect(appPath, platform) {
  const evidence = [];
  let exePath = null;

  if (platform === 'darwin') {
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');

    // Exported Godot games ship their whole project as a single .pck archive.
    const pck = listDir(resourcesDir).find((i) => i.endsWith('.pck'));
    if (pck) evidence.push(`${pck} (Godot project archive)`);

    exePath = resolveMainExecutable(appPath);
  } else if (platform === 'win32') {
    const pck = listDir(appPath).find((i) => i.endsWith('.pck'));
    if (pck) evidence.push(`${pck} (Godot project archive)`);

    exePath = resolveWindowsExecutable(appPath);
  }

  // A .pck sitting next to the executable is already characteristic, but the
  // extension is generic enough that the engine name must confirm it.
  if (exePath) {
    const marker = binaryContainsAny(exePath, GODOT_MARKERS, { maxBytes: 192 * 1024 * 1024 });
    if (marker) evidence.push(`${marker} in binary`);
  }

  const hasEngineMarker = evidence.some((e) => e.includes('in binary'));
  if (!hasEngineMarker) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
