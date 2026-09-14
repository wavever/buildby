<div align="center">
  <img src="./assets/buildby-icon.svg" width="112" height="112" alt="buildby logo">

  <h1>buildby</h1>

  <p><strong>Detect what desktop apps are built with.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@wavever/buildby"><img alt="npm version" src="https://img.shields.io/npm/v/@wavever/buildby?color=CB3837&label=npm"></a>
    <a href="https://github.com/wavever/buildby/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/wavever/buildby?label=release"></a>
    <a href="https://github.com/wavever/buildby/actions/workflows/release.yml"><img alt="Release workflow" src="https://github.com/wavever/buildby/actions/workflows/release.yml/badge.svg"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/wavever/buildby"></a>
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&amp;logoColor=white">
    <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-555">
  </p>

  <p>
    <a href="./README.zh-CN.md">简体中文</a>
    ·
    <a href="#install">Install</a>
    ·
    <a href="#usage">Usage</a>
    ·
    <a href="#detected-tech-stacks">Tech Stacks</a>
  </p>
</div>

`buildby` inspects desktop applications on macOS and Windows, then tells you whether each app is built with **native technologies** (Swift, Objective-C, Win32) or a **cross-platform framework** such as Electron, Flutter, Tauri, Qt, JVM, CEF, NW.js, React Native, wxWidgets, Unity, or .NET.

It also surfaces **signature and notarization** details for single-app inspection, including developer name, Team ID, signature status, Apple notarization on macOS, Authenticode status on Windows, and Hardened Runtime status.

## Highlights

- Fast file-system based detection with no admin privileges required.
- Single-app inspection, full installed-app scan, and per-stack filters.
- Signature and notarization metadata for macOS and Windows apps.
- npm package, GitHub Release artifact, and GitHub Packages publishing.
- Works as a small global CLI: `buildby <app name>`.

## Screenshots

| Inspect a single app | Scan all installed apps | Filter by tech stack |
| :---: | :---: | :---: |
| ![](/screenshot/img-app-en.png) | ![](/screenshot/img-scan-en.png) | ![](/screenshot/img-filter-en.png) |

## Install

```bash
# Install from npm
npm i -g @wavever/buildby

# Clone and link globally
git clone https://github.com/wavever/buildby.git
cd buildby
npm install
npm link

# Or run directly
node bin/buildby.js <command>
```

> Previously published as `desktop-app-build-by`. That name is now **deprecated** — please switch to `npm i -g @wavever/buildby`. The CLI command stays `buildby`. See [CHANGELOG.md](./CHANGELOG.md) for details.

## Usage

### Inspect a single app

```bash
buildby wechat
buildby discord
buildby "visual studio code"
buildby "clash verge"
```

Output example:

```
  Discord
  /Applications/Discord.app

   CROSS-PLATFORM   ⚡ Electron

  Cross-platform desktop apps with web technologies (HTML/CSS/JS)
  https://www.electronjs.org

  Evidence:
    • Electron Framework.framework
    • app.asar

  Bundle ID: com.hnc.Discord
  Version:   0.0.335
  Size:      375.4 MB

  Signature & Notarization
    Developer:        Discord, Inc.
    Team ID:          53Q6R32WPB
    Signature:        Signed
    Notarization:     Notarized
    Hardened Runtime: ✓ Yes
```

> The **Signature & Notarization** section is only printed for single-app inspection (`buildby <name>` and `--path`). `--all` and `--<stack>` skip it so batch scans stay fast.

### Scan all installed apps

```bash
buildby --all
buildby -a
```

Scans all apps in `/Applications` (macOS) or `Program Files` (Windows) and groups them by tech stack with a distribution chart.

> `--scan` is still supported as a legacy alias for `--all`.

Batch scans use a local analysis cache. If an app's version and main executable fingerprint have not changed, BuildBy reuses the previous result so repeated scans are nearly instant.

```bash
buildby --all --no-cache   # Force a fresh analysis
```

### JSON output

Add `--json` to any mode to get machine-readable output on stdout. Progress and
errors stay on stderr, so stdout is always safe to pipe.

```bash
buildby discord --json
buildby --all --json | jq '.summary.stacks'
buildby --electron --json | jq -r '.apps[].name'
```

Every mode returns the same envelope, so consumers never branch on shape:

```json
{
  "schema": 1,
  "buildbyVersion": "1.2.1",
  "platform": "darwin",
  "query": { "mode": "app", "value": "calibre" },
  "apps": [
    {
      "name": "calibre",
      "stack": "python",
      "stackName": "Python (PyQt)",
      "variant": "PyQt",
      "category": "cross-platform",
      "confidence": "high",
      "evidence": ["Python.framework", "PyQt UI toolkit"],
      "bundleId": "net.kovidgoyal.calibre",
      "version": "7.22.0",
      "sizeBytes": 1052946432
    }
  ],
  "summary": null
}
```

Notes for consumers:

- **`stack` is the stable identifier** — key on it, not on `stackName`. `stackName` is a display label and `variant` carries the sub-technology (`PyQt`, `Rust · AppKit`).
- **`evidence` is human-oriented** and not a stable API. Do not parse it.
- Sizes are raw bytes; no localized text appears in JSON output.
- `summary` is populated for `--all` only; it is `null` elsewhere.
- Signature and notarization are collected for single-app modes only, matching the report behaviour, so they are `null` under `--all`.
- `schema` is versioned — check it before trusting field semantics.

Exit codes (applied under `--json` only, so existing usage is unaffected):

| Code | Meaning |
| ---- | ------- |
| `0`  | At least one app matched |
| `1`  | No apps matched (payload still valid, `apps: []`) |
| `2`  | Error — unsupported platform, missing path, analysis failure |

On error, stdout carries a parseable error object instead of `apps`:

```json
{ "schema": 1, "error": { "code": "path_not_found", "message": "Path not found: /nope" } }
```

### Configuration

BuildBy creates a default JSON config file on first run, then reads it on later runs:

- macOS/Linux/other: `$XDG_CONFIG_HOME/buildby/config.json` or `~/.config/buildby/config.json`
- Windows: `%APPDATA%\buildby\config.json`

On macOS, existing configs from `~/.buildby/config.json` are copied to the new XDG path automatically when the new file does not exist.

You can also point to a custom config file with `BUILDBY_CONFIG=/path/to/config.json`; BuildBy will create that file with defaults if it does not exist.

```json
{
  "cache": true,
  "excludeApps": [
    "Xcode",
    "com.apple.Safari",
    "/Applications/VMware Fusion.app"
  ]
}
```

`cache: false` disables the analysis cache by default. `excludeApps` removes matching apps from `--all` and per-stack scans; entries can be app names, Bundle IDs, or full paths. Single-app inspection still works for excluded apps.

### Language

BuildBy follows your terminal or system language by default. To show English output without changing system language:

```bash
LC_ALL=en_US.UTF-8 buildby -a
```

You can also create an alias:

```bash
alias buildby-en='LC_ALL=en_US.UTF-8 buildby'
```

### Filter by tech stack

```bash
buildby -e     # All Electron apps (--electron)
buildby -f     # All Flutter apps (--flutter)
buildby -t     # All Tauri apps (--tauri)
buildby -q     # All Qt apps (--qt)
buildby -j     # All JVM apps (--jvm)
buildby -c     # All CEF apps (--cef)
buildby -d     # All .NET / MAUI / WPF apps (--dotnet)
buildby -b     # All Chromium apps (--chromium)
buildby -W     # All NW.js apps (--nwjs)
buildby -r     # All React Native apps (--reactnative)
buildby -w     # All wxWidgets apps (--wxwidgets)
buildby -u     # All Unity apps (--unity)
buildby -n     # All native apps (--native)
```

### Inspect a custom path

```bash
buildby --path /Applications/SomeApp.app
buildby --path "C:\Program Files\SomeApp"
```

## Detected Tech Stacks


| Stack                        | Description                       | Detection Method                                          |
| ---------------------------- | --------------------------------- | --------------------------------------------------------- |
| ⚡ **Electron**               | Node.js + Chromium                | `Electron Framework.framework`, `app.asar`                |
| 🐦 **Flutter**               | Google's UI toolkit               | `FlutterMacOS.framework`, `flutter_windows.dll`           |
| 🌐 **CEF**                   | Chromium Embedded Framework       | `Chromium Embedded Framework.framework`, `libcef.dll`     |
| 🌐 **Chromium**              | Built directly on Chromium        | `.pak` packs + V8 snapshot (Qt WebEngine excluded)        |
| 🟩 **NW.js**                 | Node.js + Chromium (node-webkit)  | `nwjs Framework.framework`, `app.nw`                      |
| ⚛️ **React Native**          | Facebook's React for desktop      | `React.framework`, `hermes.dll`                           |
| 🦀 **Tauri**                 | Rust + system WebView             | Tauri crate markers in binary, `WebView2Loader.dll`       |
| 🐹 **Wails**                 | Go + system WebView               | `github.com/wailsapp/wails` in binary                     |
| 🔷 **Qt**                    | C++ cross-platform                | `Qt*.framework` (incl. nested), `Qt5Core.dll` / `Qt6Core.dll` |
| 🟫 **GTK**                   | GNOME widget toolkit              | `libgtk-3/4.dylib`, `libgtk-3-0.dll`                      |
| 🧩 **wxWidgets**             | C++ wrapper over native widgets   | `libwx*.dylib`, `wxmswXXu_*.dll`                          |
| 🎵 **JUCE**                  | C++ audio apps and plug-in hosts  | `JUCE v` / `juce::` markers in binary                     |
| 🐍 **Python**                | py2app / PyInstaller / CPython    | `__boot__.py`, `base_library.zip`, `Python.framework`     |
| ☕ **JVM**                    | Java/Kotlin/Scala                 | `jbr/`, `libjvm.dylib`, `.jar` in `lib/` `app/` `Java/`   |
| 🟣 **Compose Multiplatform** | Kotlin UI via Skia                | `libskiko-macos-*.dylib`, `skiko-awt-runtime-*.jar`       |
| 🔵 **.NET**                  | Microsoft .NET / MAUI / WPF       | `MonoBundle/`, `coreclr.dll`, `.dll` files                |
| 🦅 **Avalonia**              | Cross-platform .NET UI            | `Avalonia*.dll`, `libAvalonia*`                           |
| 🎮 **Unity**                 | Unity game engine                 | `UnityPlayer.dll`, `Data/` layout                         |
| 🎯 **Unreal Engine**         | Epic UE4 / UE5                    | `Content/Paks/*.pak`, `Contents/UE5/`                     |
| 🤖 **Godot**                 | Godot game engine                 | `*.pck` archive + engine marker in binary                 |
| 🖥️ **Native**               | Platform-native technologies      | Fallback; reports Swift / Objective-C / Rust / Go         |


## Platform Support


| Platform | App Discovery                                                    | Detection                                  |
| -------- | ---------------------------------------------------------------- | ------------------------------------------ |
| macOS    | `/Applications`, `~/Applications`                                | Framework dirs, `otool -L`, plist metadata |
| Windows  | `Program Files`, `Program Files (x86)`, `AppData/Local/Programs` | DLL files, directory structure             |


## How It Works

Detection is purely **file-system based** — no admin privileges, no binary disassembly.

1. **Framework directory scan** — check `Contents/Frameworks/` for known framework bundles (Electron Framework, FlutterMacOS, Chromium Embedded Framework, Qt*.framework, etc.)
2. **Resource file patterns** — look for `app.asar`, `flutter_assets`, `app.nw`, etc.
3. **JVM detection** — detect bundled JRE/JBR runtimes and `.jar` files
4. **Tauri detection** — use `otool -L` (macOS) to check for system WebKit linkage + `resources/` directory
5. **Metadata extraction** — parse `Info.plist` for bundle ID, version, and display name
6. **Signature & notarization** — invoke `codesign -dv` + `spctl --assess` on macOS, or PowerShell `Get-AuthenticodeSignature` on Windows, to surface developer / Team ID / publisher and Apple notarization or Authenticode trust status
7. **Fallback** — apps with no cross-platform signatures are classified as Native

Detection runs in priority order so the most distinctive signatures are checked first.

## Requirements

- Node.js >= 18
- macOS or Windows
- macOS: `otool`, `codesign`, `spctl` (all bundled with Xcode Command Line Tools)
- Windows: `powershell` on `PATH` (for Authenticode signature reading)

## License

MIT
