import { detect as detectElectron, meta as electronMeta } from './electron.js';
import { detect as detectFlutter, meta as flutterMeta } from './flutter.js';
import { detect as detectCEF, meta as cefMeta } from './cef.js';
import { detect as detectTauri, meta as tauriMeta } from './tauri.js';
import { detect as detectWails, meta as wailsMeta } from './wails.js';
import { detect as detectQt, meta as qtMeta } from './qt.js';
import { detect as detectGTK, meta as gtkMeta } from './gtk.js';
import { detect as detectWxWidgets, meta as wxwidgetsMeta } from './wxwidgets.js';
import { detect as detectJVM, meta as jvmMeta } from './jvm.js';
import { detect as detectCompose, meta as composeMeta } from './compose.js';
import { detect as detectDotNet, meta as dotnetMeta } from './dotnet.js';
import { detect as detectAvalonia, meta as avaloniaMeta } from './avalonia.js';
import { detect as detectPython, meta as pythonMeta } from './python.js';
import { detect as detectNWJS, meta as nwjsMeta } from './nwjs.js';
import { detect as detectReactNative, meta as reactnativeMeta } from './reactnative.js';
import { detect as detectChromium, meta as chromiumMeta } from './chromium.js';
import { detect as detectUnity, meta as unityMeta } from './unity.js';
import { detect as detectUnreal, meta as unrealMeta } from './unreal.js';
import { detect as detectGodot, meta as godotMeta } from './godot.js';
import { detect as detectJUCE, meta as juceMeta } from './juce.js';
import { detect as detectNative, meta as nativeMeta } from './native.js';

// Detection priority order: most distinctive signatures first.
//
// Rules that the order encodes:
//   - Unity/Unreal/Godot precede .NET (game engines bundle Mono assemblies).
//   - Chromium follows Electron/CEF/NW.js (they are more specific wrappers).
//   - Compose precedes JVM, and Avalonia precedes .NET — each is a specific UI
//     framework on top of a runtime the later detector would claim first.
//   - Python precedes Qt/GTK: for a PyQt app the bundled interpreter is the
//     app's own stack, while Qt is the library it draws with. The Python
//     detector folds the toolkit into its name ("Python (PyQt)") so both
//     layers survive the single-label output.
//   - Wails precedes Tauri (both are system-WebView shells; the Go module path
//     is the discriminator).
//   - JUCE and wxWidgets are late because their macOS checks read binaries.
const DETECTORS = [
  { meta: electronMeta, detect: detectElectron },
  { meta: flutterMeta, detect: detectFlutter },
  { meta: cefMeta, detect: detectCEF },
  { meta: nwjsMeta, detect: detectNWJS },
  { meta: chromiumMeta, detect: detectChromium },
  { meta: reactnativeMeta, detect: detectReactNative },
  { meta: unrealMeta, detect: detectUnreal },
  { meta: godotMeta, detect: detectGodot },
  { meta: unityMeta, detect: detectUnity },
  { meta: composeMeta, detect: detectCompose },
  { meta: jvmMeta, detect: detectJVM },
  { meta: avaloniaMeta, detect: detectAvalonia },
  { meta: dotnetMeta, detect: detectDotNet },
  { meta: pythonMeta, detect: detectPython },
  { meta: qtMeta, detect: detectQt },
  { meta: gtkMeta, detect: detectGTK },
  { meta: wailsMeta, detect: detectWails },
  { meta: tauriMeta, detect: detectTauri },
  { meta: juceMeta, detect: detectJUCE },
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
  gtkMeta,
  wxwidgetsMeta,
  juceMeta,
  unityMeta,
  unrealMeta,
  godotMeta,
  jvmMeta,
  composeMeta,
  dotnetMeta,
  avaloniaMeta,
  pythonMeta,
  wailsMeta,
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
