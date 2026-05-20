# buildby

Detect the technology stack of desktop applications on macOS and Windows.

Instantly see whether an app is built with **Native** technologies (Swift, Objective-C, Win32) or a **cross-platform** framework (Electron, Flutter, Tauri, Qt, JVM, CEF, etc.).

Beyond the tech stack, `buildby` also reports each app's **signature & notarization** info — developer name, Team ID, signature status, Apple notarization (macOS) or Authenticode status (Windows), and whether Hardened Runtime is enabled.

## Screenshots

| Inspect a single app | Scan all installed apps | Filter by tech stack |
| :---: | :---: | :---: |
| ![](/screenshot/img-app.png) | ![](/screenshot/img-scan.png) | ![](/screenshot/img-filter.png) |

## Install

```bash
# Install from npm
npm i -g desktop-app-build-by

# Clone and link globally
git clone <repo>
cd desktop-app-build-by
npm install
npm link

# Or run directly
node bin/buildby.js <command>
```

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