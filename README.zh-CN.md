<div align="center">
  <img src="./assets/buildby-icon.svg" width="112" height="112" alt="buildby logo">

  <h1>buildby</h1>

  <p><strong>识别桌面应用到底是用什么技术构建的。</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@wavever/buildby"><img alt="npm version" src="https://img.shields.io/npm/v/@wavever/buildby?color=CB3837&label=npm"></a>
    <a href="https://github.com/wavever/buildby/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/wavever/buildby?label=release"></a>
    <a href="https://github.com/wavever/buildby/actions/workflows/release.yml"><img alt="Release workflow" src="https://github.com/wavever/buildby/actions/workflows/release.yml/badge.svg"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/wavever/buildby"></a>
    <img alt="Node.js >= 18" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&amp;logoColor=white">
    <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-555">
  </p>

  <p>
    <a href="./README.md">English</a>
    ·
    <a href="#安装">安装</a>
    ·
    <a href="#用法">用法</a>
    ·
    <a href="#支持检测的技术栈">技术栈</a>
  </p>
</div>

`buildby` 可以检测 macOS 与 Windows 上桌面应用所使用的技术栈，快速看出一个应用是使用 **原生技术**（Swift、Objective-C、Win32 等），还是使用 **跨平台框架**（Electron、Flutter、Tauri、Qt、JVM、CEF、NW.js、React Native、wxWidgets、Unity、.NET 等）构建的。

除了识别技术栈，`buildby` 还会在单应用检查时展示 **签名与公证** 信息，包括开发者名称、Team ID、签名状态、Apple 公证状态（macOS）或 Authenticode 状态（Windows），以及是否启用了强化运行时（Hardened Runtime）。

## 亮点

- 基于文件系统快速检测，不需要管理员权限。
- 支持单应用查看、全量扫描、按技术栈过滤。
- 展示 macOS 与 Windows 应用的签名、公证和信任状态。
- 同时支持 npm 包、GitHub Release 构建包和 GitHub Packages 发布。
- 安装后直接作为全局 CLI 使用：`buildby <应用名>`。

## 截图

| 查看单个应用 | 扫描所有已安装应用 | 按技术栈过滤 |
| :---: | :---: | :---: |
| ![](/screenshot/img-app.png) | ![](/screenshot/img-scan.png) | ![](/screenshot/img-filter.png) |

### 安装

```bash
# 从 npm 安装
npm i -g @wavever/buildby

# 克隆仓库并全局链接
git clone https://github.com/wavever/buildby.git
cd buildby
npm install
npm link

# 或直接运行
node bin/buildby.js <command>
```

> 早期发布名为 `desktop-app-build-by`，现已**弃用**，请改用 `npm i -g @wavever/buildby`。CLI 命令保持为 `buildby`。详情见 [CHANGELOG.md](./CHANGELOG.md)。

### 用法

#### 查看单个应用

```bash
buildby wechat
buildby discord
buildby "visual studio code"
buildby "clash verge"
```

输出示例：

```text
  Discord
  /Applications/Discord.app

   跨平台   ⚡ Electron

  使用 Web 技术（HTML/CSS/JS）构建的跨平台桌面应用
  https://www.electronjs.org

  检测依据：
    • Electron Framework.framework
    • app.asar

  Bundle ID： com.hnc.Discord
  版本： 0.0.335
  大小： 375.4 MB

  签名与公证
    开发者： Discord, Inc.
    团队 ID： 53Q6R32WPB
    签名： 已签名
    公证： 已公证
    强化运行时： ✓ 是
```

> **签名与公证** 部分仅在单应用查看时输出（`buildby <name>` 与 `--path`）。`--scan` 与 `--<stack>` 模式为了保证批量扫描速度，会跳过这一部分。

#### 扫描所有已安装应用

```bash
buildby --scan
```

会扫描 `/Applications`（macOS）或 `Program Files`（Windows）等目录下的所有桌面应用，按技术栈分组，并展示“技术栈分布”统计条形图。

#### 按技术栈过滤

```bash
buildby --electron      # 所有 Electron 应用
buildby --flutter       # 所有 Flutter 应用
buildby --tauri         # 所有 Tauri 应用
buildby --qt            # 所有 Qt 应用
buildby --wxwidgets     # 所有 wxWidgets/wxPython 应用
buildby --jvm           # 所有 JVM 应用（Java/Kotlin/Scala）
buildby --cef           # 所有 CEF (Chromium Embedded Framework) 应用
buildby --dotnet        # 所有 .NET / MAUI / WPF 应用
buildby --nwjs          # 所有 NW.js 应用
buildby --reactnative   # 所有 React Native 桌面应用
buildby --native        # 所有原生应用（Swift/ObjC/Win32）
```

#### 指定自定义路径

```bash
buildby --path /Applications/SomeApp.app
buildby --path "C:\Program Files\SomeApp"
```

### 支持检测的技术栈

| 栈 | 说明 | 主要检测方式 |
|----|------|--------------|
| ⚡ **Electron** | Node.js + Chromium | `Electron Framework.framework`、`app.asar` |
| 🐦 **Flutter** | Google 跨平台 UI 工具包 | `FlutterMacOS.framework`、`flutter_windows.dll` |
| 🌐 **CEF** | Chromium Embedded Framework | `Chromium Embedded Framework.framework`、`libcef.dll` |
| 🦀 **Tauri** | Rust + 系统 WebView | `otool -L` 检测 `WebKit.framework` + 资源目录 / Windows 上 `WebView2Loader.dll` |
| 🔷 **Qt** | C++ 跨平台框架 | `Qt*.framework`、`Qt5Core.dll` / `Qt6Core.dll` |
| 🧩 **wxWidgets** | C++ 跨平台 GUI 库 | macOS 上 `libwx*.dylib`，Windows 上 `wxmswXXu_*.dll` 等 |
| ☕ **JVM** | Java/Kotlin/Scala | `jbr/`、`libjvm.dylib`、大量 `.jar` 文件 |
| 🔵 **.NET** | Microsoft .NET / MAUI / WPF | `MonoBundle/`、`coreclr.dll`、`.dll` 组合特征 |
| 🟩 **NW.js** | Node.js + Chromium（原 node‑webkit） | `nwjs Framework.framework`、`app.nw` |
| ⚛️ **React Native** | React Native 桌面端实现 | `React.framework`、`Hermes.framework` / `hermes.dll` |
| 🖥️ **Native** | 平台原生技术 | 未命中任何跨平台特征时的兜底分类 |

### 平台支持

| 平台 | 应用发现位置 | 检测方式 |
|------|--------------|----------|
| macOS | `/Applications`、`~/Applications` | `Contents/Frameworks`、`Contents/Resources`、`otool -L`、`Info.plist` 元数据 |
| Windows | `Program Files`、`Program Files (x86)`、`AppData/Local/Programs` | 扫描 `.exe` / `.dll`、特定框架文件与目录结构 |

### 工作原理（简要）

检测完全基于 **文件系统**，不会做反汇编，也不需要管理员权限：

1. **扫描框架目录**：读取 `Contents/Frameworks/` 或应用目录下的 DLL，匹配各类已知框架的特征文件。  
2. **资源文件模式**：查找 `app.asar`、`flutter_assets`、`app.nw` 等典型文件。  
3. **JVM / .NET / 其他运行时检测**：识别打包的 JRE/JBR、.NET 运行时以及关联目录结构。  
4. **Tauri / wxWidgets 等特定栈**：结合 `otool -L` / DLL 名称 + 资源分布做多信号判断。  
5. **元数据提取**：从 `Info.plist` 解析 Bundle ID、版本号和展示名称。  
6. **签名与公证**：macOS 上调用 `codesign -dv` 与 `spctl --assess`，Windows 上调用 PowerShell `Get-AuthenticodeSignature`，提取开发者 / Team ID / 签发者，以及 Apple 公证或 Authenticode 信任状态。  
7. **兜底策略**：如果未匹配到任何跨平台特征，则将应用归类为原生技术栈。

检测按照优先级顺序依次执行，特征越独特的框架越先匹配，以减少误报和重复分类。

### 环境要求

- Node.js >= 18  
- 当前系统为 macOS 或 Windows  
- macOS 需要 `otool`、`codesign`、`spctl`（Xcode Command Line Tools 自带）  
- Windows 需要 `powershell` 在 `PATH` 中（用于读取 Authenticode 签名）

### 许可证

MIT
