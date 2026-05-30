import { detect as detectElectron, meta as electronMeta } from './electron.js';
import { detect as detectFlutter, meta as flutterMeta } from './flutter.js';
import { detect as detectCEF, meta as cefMeta } from './cef.js';
import { detect as detectTauri, meta as tauriMeta } from './tauri.js';
import { detect as detectQt, meta as qtMeta } from './qt.js';
import { detect as detectWxWidgets, meta as wxwidgetsMeta } from './wxwidgets.js';
import { detect as detectJVM, meta as jvmMeta } from './jvm.js';
import { detect as detectDotNet, meta as dotnetMeta } from './dotnet.js';
import { detect as detectNWJS, meta as nwjsMeta } from './nwjs.js';
import { detect as detectReactNative, meta as reactnativeMeta } from './reactnative.js';
import { detect as detectChromium, meta as chromiumMeta } from './chromium.js';
import { detect as detectUnity, meta as unityMeta } from './unity.js';
import { detect as detectNative, meta as nativeMeta } from './native.js';

// Detection priority order: most distinctive signatures first.
// Unity must precede .NET (Unity bundles Mono assemblies that could trigger .NET).
// Chromium must follow Electron/CEF/NW.js (they are more specific Chromium wrappers).
// wxWidgets is intentionally late because macOS detection may call otool.
const DETECTORS = [
  { meta: electronMeta, detect: detectElectron },
  { meta: flutterMeta, detect: detectFlutter },
  { meta: cefMeta, detect: detectCEF },
  { meta: nwjsMeta, detect: detectNWJS },
  { meta: chromiumMeta, detect: detectChromium },
  { meta: reactnativeMeta, detect: detectReactNative },
  { meta: qtMeta, detect: detectQt },
  { meta: unityMeta, detect: detectUnity },
  { meta: jvmMeta, detect: detectJVM },
  { meta: dotnetMeta, detect: detectDotNet },
  { meta: tauriMeta, detect: detectTauri },
  { meta: wxwidgetsMeta, detect: detectWxWidgets },
  { meta: nativeMeta, detect: detectNative }, // always last - fallback
];

export const ALL_STACK_METAS = [
  electronMeta,
  flutterMeta,
  cefMeta,
  nwjsMeta,
  chromiumMeta,
  reactnativeMeta,
  qtMeta,
  wxwidgetsMeta,
  unityMeta,
  jvmMeta,
  dotnetMeta,
  tauriMeta,
  nativeMeta,
];

/**
 * Run all detectors against an app path and return the first match.
 * @param {string} appPath - Full path to the .app bundle or Windows app directory
 * @param {string} platform - 'darwin' | 'win32'
 * @returns {object} Detection result
 */
export function detectStack(appPath, platform, options = {}) {
  for (const { detect } of DETECTORS) {
    const result = detect(appPath, platform, options);
    if (result) return result;
  }
  // Should never reach here since native.js always returns a result
  return { ...nativeMeta, confidence: 'low', evidence: ['Unknown'] };
}

/**
 * Run ALL detectors and return every match (for ambiguous apps).
 * @param {string} appPath
 * @param {string} platform
 * @returns {object[]}
 */
export function detectAllStacks(appPath, platform) {
  const results = [];
  for (const { detect, meta } of DETECTORS) {
    if (meta.id === 'native') continue; // skip fallback in multi-detect
    const result = detect(appPath, platform);
    if (result) results.push(result);
  }
  return results;
}

export { DETECTORS };
