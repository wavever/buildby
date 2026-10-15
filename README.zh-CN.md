<div align="center">
  <img src="./assets/buildby-icon.svg" width="112" height="112" alt="buildby logo">

  <h1>buildby</h1>

  <p><strong>识别桌面应用到底是用什么技术构建的。</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@wavever/buildby"><img alt="npm version" src="https://img.shields.io/npm/v/@wavever/buildby?color=CB3837&label=npm"></a>
    <a href="https://github.com/wavever/buildby/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/wavever/buildby?label=release"></a>
    <a href="https://github.com/wavever/buildby/actions/workflows/release.yml"><img alt="Release workflow" src="https://github.com/wavever/buildby/actions/workflows/release.yml/badge.svg"></a>
    <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/wavever/buildby"></a>
    <img alt="Node.js 18" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&amp;logoColor=white">
    <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-555">
  </p>

  <p>
    <a href="./README.md">English</a>
    ·
    <a href="#效果演示">演示</a>
    ·
    <a href="#快速开始与安装">安装</a>
    ·
    <a href="#用法">用法</a>
    ·
    <a href="#支持检测的技术栈">技术栈</a>
  </p>
</div>

`buildby` 可以检测 macOS、Windows 与 Linux 上桌面应用所使用的技术栈，快速看出一个应用是使用 **原生技术**（Swift、Objective-C、Win32 等），还是使用 **跨平台框架**（Electron、Flutter、Tauri、Qt、JVM、CEF、NW.js、React Native、wxWidgets、Unity、.NET、Neutralinojs、Sciter 等）构建的。

同时支持展示 **CPU 芯片架构**（Apple Silicon `arm64`、Intel `x86_64`、`universal` 通用二进制）、**框架具体版本**，以及 **签名与公证** 信息。

## 亮点

- 基于文件系统与二进制头极速检测，纯 JS 内存流式解析，不需要管理员权限。
- 支持单应用查看、全量扫描、按技术栈过滤。
- 原生 CPU 芯片架构识别（Apple Silicon arm64 / Intel x86_64 / Universal 二进制）。
- 双应用横向对比模式（`buildby compare <app1> <app2>`）。
- 应用快速浏览与模糊搜索（`buildby -i`）。
- 多种导出格式：终端排版、`--json`、`--markdown` 和 `--csv`。
- 展示 macOS 与 Windows 应用的签名、公证和信任状态。
- 跨平台支持：macOS、Windows 与 Linux（.desktop 与 Flatpak/Snap）。

## 效果演示

<div align="center">
  <a href="./assets/pk-demo.mp4">
    <img src="./assets/pk-demo.gif" width="760" alt="buildby vs / pk demo">
  </a>
  <p><em>双应用 PK 对比 (<code>buildby vs</code> / <code>buildby pk</code>)</em></p>
</div>

## 截图

| 查看单个应用 | 扫描所有已安装应用 | 按技术栈过滤 |
| :---: | :---: | :---: |
| ![](/screenshot/img-app.png) | ![](/screenshot/img-scan.png) | ![](/screenshot/img-filter.png) |

### 快速开始与安装

#### 无需安装，直接通过 npx 尝鲜

```bash
npx @wavever/buildby
```

#### 全局安装

```bash
# 从 npm 全局安装
npm i -g @wavever/buildby

# 或克隆仓库并全局链接
git clone https://github.com/wavever/buildby.git
cd buildby
npm install
npm link

# 或直接从源码运行
node bin/buildby.js
```

> 早期发布名为 `desktop-app-build-by`，现已**弃用**，请改用 `npm i -g @wavever/buildby`。CLI 命令保持为 `buildby`。详情见 [CHANGELOG.md](./CHANGELOG.md)。

#### 自动检查更新与手动升级

在终端中，`buildby` 在执行命令前会自动进行快速、轻量的版本检查：

- **新版本提示**：当发现新版本时，终端会弹出类似 Codex 的更新提示框。
- **全键盘选择**：使用方向键 `↑` / `↓` 或数字键 `1` / `2` 切换 **立即升级** 或 **稍后升级（跳过）**，按 `Enter` 确认（按 `q` 或 `Esc` 快速跳过）。
- **无感继续执行**：选择升级后，`buildby` 会自动通过 npm 安装最新版本，并在安装完成后**直接调用新版本继续执行您原本输入的命令**！
- **跳过检查**：支持添加 `--no-update-check` 参数、设置环境变量 `BUILDBY_NO_UPDATE_CHECK=1`，或在 `config.json` 中配置 `"checkForUpdates": false`。

```bash
# 手动升级命令：
buildby update           # 检查新版本并直接安装
buildby update --check   # 仅检查是否有新版本，不安装
```

`update` 通过 npm 查询最新版本，因此会沿用你自己的 registry 镜像、代理与认证配置。如果当前运行的是 git 检出或 `npm link` 的副本，它会提示所在路径并停止，不会覆盖你的工作目录。

> 由于 `update` 是子命令，名字恰好叫 "update" 的应用无法再按名称检测 —— 这种情况请用 `buildby --path`。

### 用法

#### 应用浏览与搜索（默认模式）

在终端中直接运行 `buildby` 不传参数，默认启动应用浏览与搜索：

```bash
buildby                  # 默认浏览与搜索已安装应用
buildby -i               # 指定搜索浏览模式
buildby ui               # 别名
```

- **全键盘操作**：使用方向键 `↑` / `↓` 浏览应用，按 `Enter` 查看选中应用的完整详情。
- **即时输入过滤**：随时键入文字即可实时模糊搜索匹配应用。
- **平滑视口滚动**：丝滑无闪烁地滚动浏览系统内全部已安装应用，带分页与位置提示（`▲` / `▼` 及 `[当前/总数]`）。
- **快捷退出**：按 `q` 或 `Ctrl+C` 随时退出。

#### 双应用对比（`vs` / `pk`）

并排对比两个应用的技术栈、芯片架构、体积差与代码签名：

```bash
# 直接指定两个应用进行对比
buildby vs "ChatGPT" "Amphetamine"
buildby pk "WeChat" "Discord"
buildby compare "Visual Studio Code" "Sublime Text"

# 或直接进入多选对比
buildby vs
# → 方向键浏览，按空格键勾选两个应用，回车即可开始并排对比！
```

#### 查看单个应用

```bash
buildby wechat
buildby discord
buildby "visual studio code"
buildby "clash verge"
```

输出示例：

```text
  ╭──────────────────────────────────────────────────────────────────────────╮
  │ 📦 Discord (v0.0.335)                                      macOS · arm64 │
  │ 📂 /Applications/Discord.app                                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  跨平台   ⚡ Electron                                                    │
  │ 使用 Web 技术（HTML/CSS/JS）构建的跨平台桌面应用                         │
  │ 🌐 https://www.electronjs.org                                            │
  ├───────────────────────────────────┬──────────────────────────────────────┤
  │ 📋 核心规格                       │ 🔒 签名与安全                        │
  │   • 架构: Apple Silicon (arm64)   │   • 签名: ✓ 已签名                   │
  │   • 体积: 375.4 MB                │   • 开发者: Discord, Inc. (53Q6…    │
  │   • 版本: 0.0.335                 │   • 公证: ✓ Apple 公证               │
  │   • 标识: com.hnc.Discord         │   • 强化运行: ✓ 已启用               │
  ├───────────────────────────────────┴──────────────────────────────────────┤
  │ 🔍 判定依据                                                              │
  │   • Electron Framework.framework                                         │
  │   • app.asar                                                             │
  ╰──────────────────────────────────────────────────────────────────────────╯
```

> **签名与安全** 部分仅在单应用查看时输出（`buildby <name>` 与 `--path`）。`--all` 与 `--<stack>` 模式为了保证批量扫描速度，会跳过这一部分。

#### 扫描所有已安装应用

```bash
buildby --all
buildby -a
```

会扫描 `/Applications`（macOS）或 `Program Files`（Windows）等目录下的所有桌面应用，按技术栈分组，并展示适合截图分享的“桌面应用技术栈画像”。

> `--scan` 仍然保留为 `--all` 的兼容别名。

批量扫描会使用本地分析缓存。如果应用版本与主可执行文件指纹没有变化，BuildBy 会直接复用上一次分析结论，重复扫描几乎是瞬时完成。

```bash
buildby --all --no-cache   # 强制重新分析
```

#### 导出格式

##### Markdown 表格（`--markdown` / `--md`）

将检测结果导出为整洁的 GitHub Flavored Markdown (GFM) 表格，包含详细信息及顶部的技术栈分布汇总表：

```bash
buildby --all --md > apps.md
buildby discord --md
```

##### CSV 表格（`--csv`）

将应用清单导出为标准 RFC 4180 CSV 格式，方便导入 Excel、Numbers 或数据分析工具：

```bash
buildby --all --csv > apps.csv
```

#### JSON 输出

任意**检测模式**加上 `--json` 即可在 stdout 得到机器可读输出（`update` 是动作命令，没有 JSON 形式）。进度与错误信息走 stderr，因此 stdout 始终可以安全地管道传递。

```bash
buildby discord --json
buildby --all --json | jq '.summary.stacks'
buildby --electron --json | jq -r '.apps[].name'
```

所有模式返回同一个信封结构，消费方无需按模式分支处理：

```json
{
  "schema": 1,
  "buildbyVersion": "1.5.0",
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

消费方须知：

- **`stack` 才是稳定标识符** —— 请基于它判断，而不是 `stackName`。`stackName` 是展示用名称，`variant` 承载子技术（如 `PyQt`、`Rust · AppKit`）。
- **`evidence` 是给人看的**，不属于稳定 API，请勿解析。
- 体积为原始字节数；JSON 输出中不含任何本地化文案。
- `summary` 仅在 `--all` 下填充，其余模式为 `null`。
- 签名与公证信息仅在单应用模式采集（与报告行为一致），因此 `--all` 下为 `null`。
- `schema` 带版本号，请在依赖字段语义前先校验。

退出码（**仅在 `--json` 下生效**，不影响既有用法）：

| 退出码 | 含义 |
| ------ | ---- |
| `0` | 至少匹配到一个应用 |
| `1` | 无匹配（payload 仍然合法，`apps: []`） |
| `2` | 错误 —— 平台不支持、路径不存在、分析失败 |

出错时 stdout 返回可解析的错误对象，而不是 `apps`：

```json
{ "schema": 1, "error": { "code": "path_not_found", "message": "Path not found: /nope" } }
```

#### 配置文件

BuildBy 会在首次运行时自动创建默认 JSON 配置文件，之后运行时会读取它：

- macOS / Linux / 其他：`$XDG_CONFIG_HOME/buildby/config.json` 或 `~/.config/buildby/config.json`
- Windows：`%APPDATA%\buildby\config.json`

在 macOS 上，如果新路径还不存在，但旧的 `~/.buildby/config.json` 已存在，BuildBy 会自动将旧配置复制到新的 XDG 路径。

也可以通过 `BUILDBY_CONFIG=/path/to/config.json` 指定自定义配置文件；如果该文件不存在，BuildBy 会自动写入默认值。

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

`cache: false` 会默认禁用分析缓存。`excludeApps` 会让匹配的应用不参与 `--all` 与按技术栈过滤扫描；条目可以写应用名、Bundle ID 或完整路径。单应用查询仍然可以查看这些被排除的应用。

#### 输出语言

BuildBy 默认会跟随终端或系统语言。无需修改系统语言，也可以临时展示英文输出：

```bash
LC_ALL=en_US.UTF-8 buildby -a
```

也可以创建一个 alias：

```bash
alias buildby-en='LC_ALL=en_US.UTF-8 buildby'
```

#### 按技术栈过滤

```bash
buildby -e     # 所有 Electron 应用（--electron）
buildby -f     # 所有 Flutter 应用（--flutter）
buildby -t     # 所有 Tauri 应用（--tauri）
buildby -q     # 所有 Qt 应用（--qt）
buildby -w     # 所有 wxWidgets/wxPython 应用（--wxwidgets）
buildby -j     # 所有 JVM 应用（--jvm）
buildby -c     # 所有 CEF 应用（--cef）
buildby -d     # 所有 .NET / MAUI / WPF 应用（--dotnet）
buildby -b     # 所有 Chromium 应用（--chromium）
buildby -W     # 所有 NW.js 应用（--nwjs）
buildby -r     # 所有 React Native 桌面应用（--reactnative）
buildby -u     # 所有 Unity 应用（--unity）
buildby -n     # 所有原生应用（--native）
```

#### 指定自定义路径

```bash
buildby --path /Applications/SomeApp.app
buildby --path "C:\Program Files\SomeApp"
```

### 支持检测的技术栈

| 栈 | 说明 | 主要检测方式 |
|----|------|--------------|
| ⚡ **Electron** | Node.js + Chromium | `Electron Framework.framework`、`app.asar`、提取框架主版本号 |
| 🐦 **Flutter** | Google 跨平台 UI 工具包 | `FlutterMacOS.framework`、`flutter_windows.dll`、提取 Flutter 版本 |
| 🌐 **CEF** | Chromium Embedded Framework | `Chromium Embedded Framework.framework`、`libcef.dll` |
| 🌐 **Chromium** | 直接基于 Chromium 构建 | `.pak` 资源包 + V8 快照（已排除 Qt WebEngine） |
| 🟩 **NW.js** | Node.js + Chromium（原 node‑webkit） | `nwjs Framework.framework`、`app.nw` |
| ⚛️ **React Native** | React Native 桌面端实现 | `React.framework`、`Hermes.framework` / `hermes.dll` |
| 🦀 **Tauri** | Rust + 系统 WebView | 二进制中的 Tauri crate 特征、v1/v2 变体 / Windows 上 `WebView2Loader.dll` |
| ⚡ **Neutralinojs** | 轻量级 HTML/JS 跨平台框架 | `neutralino.js`、`neutralino.config.json`、二进制特征 |
| 🐹 **Wails** | Go + 系统 WebView | 二进制中的 `github.com/wailsapp/wails` |
| 🔷 **Qt** | C++ 跨平台框架 | `Qt*.framework`（含嵌套目录）、`Qt5Core.dll` / `Qt6Core.dll`、提取 Qt 版本 |
| 🟫 **GTK** | GNOME 控件工具包 | `libgtk-3/4.dylib`、`libgtk-3-0.dll` |
| 🧩 **wxWidgets** | C++ 跨平台 GUI 库 | macOS 上 `libwx*.dylib`，Windows 上 `wxmswXXu_*.dll` 等 |
| 🧩 **Sciter** | 嵌入式 HTML/CSS 界面引擎 | `sciter.dll`、`libsciter.dylib`、二进制特征 |
| 🎵 **JUCE** | 音频应用与插件宿主 C++ 框架 | 二进制中的 `JUCE v` / `juce::` 特征 |
| 🐍 **Python** | py2app / PyInstaller / 内置 CPython | `__boot__.py`、`base_library.zip`、`Python.framework` |
| ☕ **JVM** | Java/Kotlin/Scala | `jbr/`、`libjvm.dylib`、`lib/` `app/` `Java/` 下的 `.jar` |
| 🟣 **Compose Multiplatform** | 基于 Skia 的 Kotlin UI 框架 | `libskiko-macos-*.dylib`、`skiko-awt-runtime-*.jar` |
| 🔵 **.NET** | Microsoft .NET / MAUI / WPF | `MonoBundle/`、`coreclr.dll`、`.dll` 组合特征 |
| 🦅 **Avalonia** | 跨平台 .NET UI 框架 | `Avalonia*.dll`、`libAvalonia*` |
| 🎮 **Unity** | Unity 游戏引擎 | `UnityPlayer.dll`、`Data/` 目录结构 |
| 🎯 **Unreal Engine** | Epic 虚幻引擎 UE4 / UE5 | `Content/Paks/*.pak`、`Contents/UE5/` |
| 🤖 **Godot** | Godot 游戏引擎 | `*.pck` 归档 + 二进制中的引擎特征 |
| 🖥️ **Native** | 平台原生技术 | 兜底分类；区分 Swift / Objective-C / Rust / Go / C++ / Win32 |

### 平台支持

| 平台 | 应用发现位置 | 检测方式 |
|------|--------------|----------|
| macOS | `/Applications`、`~/Applications` | `Contents/Frameworks`、进程内纯 JS Mach-O 解析器、`Info.plist` 元数据 |
| Windows | `Program Files`、`Program Files (x86)`、`AppData/Local/Programs` | PE 二进制头探测、扫描 `.exe` / `.dll`、特定框架文件与目录结构 |
| Linux | `/usr/share/applications`、`~/.local/share/applications`、Flatpak、Snap | `.desktop` 桌面规范解析、ELF 二进制头解析、动态库依赖 |

### 工作原理（简要）

检测完全基于 **文件系统与二进制头解析**，安全极速，不需要管理员权限：

1. **扫描框架目录与动态库**：读取应用目录或 `Contents/Frameworks/` 下的 DLL / dylib，匹配各类已知框架的特征文件。  
2. **纯 JS 二进制头解析**：使用内置流式解析器读取 Mach-O 动态库链接命令（`LC_LOAD_DYLIB`）、Universal 通用二进制、PE 与 ELF CPU 芯片架构，避免启动外部子进程。  
3. **资源特征模式**：查找 `app.asar`、`flutter_assets`、`neutralino.js`、`app.nw` 等典型资源。  
4. **框架版本提取**：从 Electron 资源包、Flutter 框架符号、Qt 动态库中自动提取运行时主版本号。  
5. **JVM / 游戏引擎检测**：识别打包的 JRE/JBR、.NET 运行时、Unity Data、Unreal Engine Pak 与 Godot pck 归档。  
6. **元数据提取**：从 `Info.plist`、PE 版本资源与 Linux `.desktop` 文件解析名称、版本号与 Bundle ID。  
7. **签名与公证**：macOS 上调用 `codesign` 与 `spctl`，Windows 上调用 PowerShell `Get-AuthenticodeSignature`，提取开发者 / Team ID / 签发者，以及 Apple 公证或 Authenticode 信任状态。  
8. **智能分析缓存**：根据应用版本与主程序指纹哈希缓存分析结果，重复扫描瞬间完成。  
9. **兜底策略**：如果未匹配到任何跨平台框架特征，则将应用归类为原生技术栈（Native）。

检测按照优先级顺序依次执行，特征越独特的框架越先匹配，以减少误报和重复分类。

### 环境要求

- Node.js >= 18  
- macOS、Windows 或 Linux 系统  
- macOS 需要 `codesign` 与 `spctl`（Xcode Command Line Tools 自带，用于签名信息查询）  
- Windows 需要 `powershell` 在 `PATH` 中（用于读取 Authenticode 签名）  
- Linux 需要标准 XDG / FreeDesktop 桌面环境规范

### 许可证

MIT
