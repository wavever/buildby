import path from 'path';
import { binaryContainsAny, listDir, resolveMainExecutable, resolveWindowsExecutable } from './shared.js';

export const meta = {
  id: 'juce',
  name: 'JUCE',
  category: 'cross-platform',
  color: 'yellow',
  description: 'C++ framework for audio applications and plug-in hosts',
  website: 'https://juce.com',
};

// JUCE keeps its namespace and version banner in the compiled binary.
const JUCE_MARKERS = ['JUCE v', 'juce::', 'JucePlugin_', 'JUCEApplication'];

// JUCE apps are typically modest in size; skip the tail of anything unusual.
const PROBE_MAX_BYTES = 192 * 1024 * 1024;

export function detect(appPath, platform) {
  let exePath = null;

  if (platform === 'darwin') {
    exePath = resolveMainExecutable(appPath);
  } else if (platform === 'win32') {
    exePath = resolveWindowsExecutable(appPath);
  }

  if (!exePath) return null;

  const marker = binaryContainsAny(exePath, JUCE_MARKERS, { maxBytes: PROBE_MAX_BYTES });
  if (!marker) return null;

  const evidence = [`${marker} in binary`];

  // Plug-in hosts ship their formats alongside the app.
  if (platform === 'darwin') {
    const plugIns = listDir(path.join(appPath, 'Contents', 'PlugIns'))
      .filter((i) => i.endsWith('.vst3') || i.endsWith('.component'));
    if (plugIns.length > 0) {
      evidence.push(`${plugIns.length} bundled audio plug-ins`);
    }
  }

  return {
    ...meta,
    confidence: 'high',
    evidence,
  };
}
