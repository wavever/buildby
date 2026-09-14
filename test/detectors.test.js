import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { detectStack } from '../src/detectors/index.js';
import { makeMacApp, makeWindowsApp, makeTempDir, rmDir } from './helpers.js';

// Bundles are synthesised rather than committed, and every case passes the
// platform explicitly — so these run identically on macOS, Linux and Windows.
let root;

before(() => { root = makeTempDir('detectors'); });
after(() => { rmDir(root); });

describe('macOS detection', () => {
  test('Python: PyInstaller layout, with the UI toolkit folded into variant', () => {
    const app = makeMacApp(root, 'PyApp', {
      files: [
        'Contents/MacOS/_internal/base_library.zip',
        'Contents/Frameworks/libpython3.12.dylib',
        'Contents/Frameworks/QtCore.framework/',
      ],
    });

    const result = detectStack(app, 'darwin');
    assert.equal(result.id, 'python');
    assert.equal(result.variant, 'PyQt');
    assert.equal(result.name, 'Python (PyQt)');
  });

  test('Python: no toolkit means no variant', () => {
    const app = makeMacApp(root, 'PyHeadless', {
      files: ['Contents/Resources/__boot__.py'],
    });

    const result = detectStack(app, 'darwin');
    assert.equal(result.id, 'python');
    assert.equal(result.variant, null);
    assert.equal(result.name, 'Python');
  });

  test('GTK', () => {
    const app = makeMacApp(root, 'GtkApp', {
      files: [
        'Contents/Frameworks/libgtk-3.0.dylib',
        'Contents/Frameworks/libgdk-3.0.dylib',
        'Contents/Frameworks/libglib-2.0.0.dylib',
      ],
    });

    assert.equal(detectStack(app, 'darwin').id, 'gtk');
  });

  test('Compose Multiplatform wins over JVM', () => {
    const app = makeMacApp(root, 'ComposeApp', {
      files: [
        'Contents/app/skiko-awt-runtime-macos-arm64-0.8.4.jar',
        'Contents/app/libskiko-macos-arm64.dylib',
        // Also looks like a plain JVM app; the more specific detector must win.
        'Contents/app/app.jar',
        'Contents/runtime/Contents/Home/',
      ],
    });

    assert.equal(detectStack(app, 'darwin').id, 'compose');
  });

  test('Avalonia wins over .NET', () => {
    const app = makeMacApp(root, 'AvaloniaApp', {
      files: [
        'Contents/MonoBundle/Avalonia.dll',
        'Contents/MonoBundle/Avalonia.Base.dll',
        'Contents/MacOS/libcoreclr.dylib',
      ],
    });

    assert.equal(detectStack(app, 'darwin').id, 'avalonia');
  });

  test('Unreal Engine', () => {
    const app = makeMacApp(root, 'UnrealApp', {
      files: [
        'Contents/UE5/MyGame/Content/Paks/pakchunk0-Mac.pak',
        'Contents/UE5/MyGame/Content/Paks/global.utoc',
      ],
    });

    assert.equal(detectStack(app, 'darwin').id, 'unreal');
  });

  test('Godot requires the engine marker, not just a .pck', () => {
    const withMarker = makeMacApp(root, 'GodotApp', {
      executableBody: 'noise godotengine v4.2.stable noise',
      files: ['Contents/Resources/MyGame.pck'],
    });
    assert.equal(detectStack(withMarker, 'darwin').id, 'godot');

    // A .pck alone is too generic to conclude Godot.
    const pckOnly = makeMacApp(root, 'PckOnly', {
      files: ['Contents/Resources/data.pck'],
    });
    assert.notEqual(detectStack(pckOnly, 'darwin').id, 'godot');
  });

  test('JUCE', () => {
    const app = makeMacApp(root, 'JuceApp', {
      executableBody: 'binary noise JUCE v7.0.9 more noise',
    });

    assert.equal(detectStack(app, 'darwin').id, 'juce');
  });

  test('Wails', () => {
    const app = makeMacApp(root, 'WailsApp', {
      executableBody: 'go noise github.com/wailsapp/wails/v2/internal noise',
      files: ['Contents/Resources/index.html'],
    });

    assert.equal(detectStack(app, 'darwin').id, 'wails');
  });
});

describe('macOS regression fixes', () => {
  test('Qt nested one level under Frameworks (WPS Office layout)', () => {
    const app = makeMacApp(root, 'NestedQtApp', {
      files: [
        'Contents/Frameworks/office6/QtCoreKso.framework/',
        'Contents/Frameworks/office6/QtGuiKso.framework/',
      ],
    });

    assert.equal(detectStack(app, 'darwin').id, 'qt');
  });

  test('JVM via the legacy Contents/Java layout (Nutstore)', () => {
    const app = makeMacApp(root, 'LegacyJavaApp', {
      files: ['Contents/Java/client.jar'],
    });

    const result = detectStack(app, 'darwin');
    assert.equal(result.id, 'jvm');
    assert.match(result.evidence.join(' '), /Apple Java bundle/);
  });

  test('QtWebEngine is attributed to Qt, not Chromium', () => {
    const app = makeMacApp(root, 'QtWebEngineApp', {
      files: [
        'Contents/Frameworks/QtWebEngineCore.framework/Versions/A/Resources/qtwebengine_resources.pak',
        'Contents/Frameworks/QtWebEngineCore.framework/Versions/A/Resources/v8_context_snapshot.bin',
        'Contents/Frameworks/QtCore.framework/',
      ],
    });

    assert.equal(detectStack(app, 'darwin').id, 'qt');
  });

  test('Rust native app is not reported as Objective-C', () => {
    const app = makeMacApp(root, 'RustNativeApp', {
      executableBody: 'noise /Users/x/.cargo/registry/src/index/foo-1.0/src/lib.rs noise',
    });

    const result = detectStack(app, 'darwin');
    assert.equal(result.id, 'native');
    assert.match(result.variant, /^Rust/);
  });

  test('Go native app is identified', () => {
    const app = makeMacApp(root, 'GoNativeApp', {
      executableBody: 'noise Go build ID: "abcdef" noise',
    });

    const result = detectStack(app, 'darwin');
    assert.equal(result.id, 'native');
    assert.match(result.variant, /^Go/);
  });
});

describe('no false positives', () => {
  test('a bare native bundle matches only the native fallback', () => {
    const app = makeMacApp(root, 'PlainApp', {
      executableBody: 'nothing interesting here',
    });

    const result = detectStack(app, 'darwin');
    assert.equal(result.id, 'native');
    assert.equal(result.category, 'native');
  });

  test('an empty directory does not crash any detector', () => {
    const empty = makeTempDir('empty-app');
    try {
      assert.equal(detectStack(empty, 'darwin').id, 'native');
    } finally {
      rmDir(empty);
    }
  });
});

describe('Windows detection', () => {
  test('Python via PyInstaller onedir', () => {
    const app = makeWindowsApp(root, 'PyWin', {
      files: ['_internal/base_library.zip', '_internal/python311.dll'],
    });

    assert.equal(detectStack(app, 'win32').id, 'python');
  });

  test('GTK', () => {
    const app = makeWindowsApp(root, 'GtkWin', {
      files: ['libgtk-3-0.dll', 'libgdk-3-0.dll', 'libglib-2.0-0.dll'],
    });

    assert.equal(detectStack(app, 'win32').id, 'gtk');
  });

  test('Tauri needs the crate marker, not just WebView2', () => {
    const real = makeWindowsApp(root, 'TauriWin', {
      executableBody: 'noise tauri-runtime-wry noise',
      files: ['WebView2Loader.dll'],
    });
    assert.equal(detectStack(real, 'win32').id, 'tauri');

    // WebView2 alone could be any WebView2 host.
    const bare = makeWindowsApp(root, 'WebView2Only', {
      files: ['WebView2Loader.dll'],
    });
    assert.notEqual(detectStack(bare, 'win32').id, 'tauri');
  });

  test('Wails', () => {
    const app = makeWindowsApp(root, 'WailsWin', {
      executableBody: 'noise github.com/wailsapp/wails noise',
      files: ['WebView2Loader.dll'],
    });

    assert.equal(detectStack(app, 'win32').id, 'wails');
  });
});
