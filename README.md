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
| ![](/screenshot/img-app.png) | ![](/screenshot/img-scan.png) | ![](/screenshot/img-filter.png) |

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

> The **Signature & Notarization** section is only printed for single-app inspection (`buildby <name>` and `--path`). `--scan` and `--<stack>` skip it so batch scans stay fast.

### Scan all installed apps

```bash
buildby --scan
```

Scans all apps in `/Applications` (macOS) or `Program Files` (Windows) and groups them by tech stack with a distribution chart.

### Filter by tech stack

```bash
buildby --electron      # All Electron apps
buildby --flutter       # All Flutter apps
buildby --tauri         # All Tauri apps
buildby --qt            # All Qt apps
buildby --jvm           # All JVM apps (Java/Kotlin/Scala)
buildby --cef           # All CEF apps (Chromium Embedded Framework)
buildby --dotnet        # All .NET / MAUI / WPF apps
buildby --nwjs          # All NW.js apps
buildby --reactnative   # All React Native apps
buildby --native        # All native apps (Swift/ObjC/Win32)
```

### Inspect a custom path

```bash
buildby --path /Applications/SomeApp.app
buildby --path "C:\Program Files\SomeApp"
```

## Detected Tech Stacks


| Stack               | Description                      | Detection Method                                        |
| ------------------- | -------------------------------- | ------------------------------------------------------- |
| ⚡ **Electron**      | Node.js + Chromium               | `Electron Framework.framework`, `app.asar`              |
| 🐦 **Flutter**      | Google's UI toolkit              | `FlutterMacOS.framework`, `flutter_windows.dll`         |
| 🌐 **CEF**          | Chromium Embedded Framework      | `Chromium Embedded Framework.framework`, `libcef.dll`   |
| 🦀 **Tauri**        | Rust + system WebView            | Binary strings + `resources/` dir, `WebView2Loader.dll` |
| 🔷 **Qt**           | C++ cross-platform               | `Qt*.framework`, `Qt5Core.dll` / `Qt6Core.dll`          |
| ☕ **JVM**           | Java/Kotlin/Scala                | `jbr/`, `libjvm.dylib`, `.jar` files                    |
| 🔵 **.NET**         | Microsoft .NET / MAUI / WPF      | `MonoBundle/`, `coreclr.dll`, `.dll` files              |
| 🟩 **NW.js**        | Node.js + Chromium (node-webkit) | `nwjs Framework.framework`, `app.nw`                    |
| ⚛️ **React Native** | Facebook's React for desktop     | `React.framework`, `hermes.dll`                         |
| 🖥️ **Native**      | Platform-native technologies     | Fallback when no cross-platform signatures found        |


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
