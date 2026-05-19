import { execFileSync } from 'child_process';

/**
 * Detect whether the system language is Chinese.
 * Checks (in order): env vars, Intl API, macOS system preferences.
 */
function detectLocale() {
  const envLang =
    process.env.LANG ||
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    process.env.LANGUAGE ||
    '';
  if (envLang.toLowerCase().startsWith('zh')) return 'zh';

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale.startsWith('zh')) return 'zh';
  } catch {
    // ignore
  }

  // macOS: some terminals (e.g. IDE-embedded) don't propagate locale env vars.
  // Fall back to reading the actual system preference.
  if (process.platform === 'darwin') {
    try {
      const appleLocale = execFileSync('defaults', ['read', '-g', 'AppleLocale'], {
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString().trim();
      if (appleLocale.toLowerCase().startsWith('zh')) return 'zh';
    } catch {
      // ignore
    }
  }

  return 'en';
}

export const LOCALE = detectLocale();

const translations = {
  en: {
    // ── category badges ──────────────────────────────────────────────────────
    badge_native: ' NATIVE ',
    badge_cross: ' CROSS-PLATFORM ',

    // ── detail view ──────────────────────────────────────────────────────────
    label_evidence: 'Evidence:',
    label_bundle_id: 'Bundle ID:',
    label_version: 'Version:',
    label_size: 'Size:',
    table_head_size: 'Size',

    // ── signature & notarization ─────────────────────────────────────────────
    label_security_section: 'Signature & Notarization',
    label_developer: 'Developer:',
    label_team_id: 'Team ID:',
    label_signature: 'Signature:',
    label_notarization: 'Notarization:',
    label_hardened_runtime: 'Hardened Runtime:',
    label_publisher: 'Publisher:',
    value_signed: 'Signed',
    value_unsigned: 'Unsigned',
    value_ad_hoc: 'Ad-hoc',
    value_notarized: 'Notarized',
    value_not_notarized: 'Not notarized',
    value_apple_system: 'Apple System',
    value_mac_app_store: 'Mac App Store',
    value_rejected: 'Rejected',
    value_yes: 'Yes',
    value_no: 'No',

    // ── scan view ────────────────────────────────────────────────────────────
    scan_summary: 'Scanned {total} applications',
    scan_group_stat: '({count} apps, {pct}%)',
    scan_distribution: 'Distribution:',

    // ── filtered list view ───────────────────────────────────────────────────
    filter_no_result: 'No {stack} apps found.',
    filter_title: '{icon} {stack} apps',
    filter_found: '— {count} found',
    table_head_app: 'App',
    table_head_version: 'Version',
    table_head_tech: 'Tech',
    table_head_path: 'Bundle ID / Path',

    // ── spinner / status messages (cli.js) ───────────────────────────────────
    spinner_searching: 'Searching for "{query}"…',
    spinner_analyzing: 'Analyzing {name}…',
    spinner_analyzed: 'Analyzed: {name}',
    spinner_no_match: 'No application found matching "{query}"',
    spinner_multi_match: 'Found {count} matches, analyzing…',
    spinner_multi_done: 'Found {count} matching apps',
    spinner_path_fail: 'Failed to analyze: {msg}',
    spinner_scanning: 'Scanning installed applications…',
    spinner_analyzing_n: 'Analyzing {count} applications…',
    spinner_analyzing_progress: 'Analyzing {current}/{total}…',
    spinner_analyzed_n: 'Analyzed {count} applications',
    spinner_filter_scan: 'Scanning for {stack} apps…',
    spinner_scan_done: 'Scan complete',
    spinner_no_apps: 'No applications found.',

    // ── warnings / errors ────────────────────────────────────────────────────
    warn_use_scan: 'Try using --scan to see all installed apps.',
    warn_platform: 'Make sure you are running on macOS or Windows.',
    err_unsupported_platform: 'Unsupported platform: {platform}. Only macOS and Windows are supported.',
    err_path_not_found: 'Path not found: {path}',

    // ── commander descriptions ────────────────────────────────────────────────
    cmd_description: 'Detect the technology stack of desktop applications',
    cmd_help: 'Show help',
    cmd_scan: 'Scan all installed apps and group by tech stack',
    cmd_path: 'Specify a custom directory to scan',
    cmd_filter: 'Show all apps built with {name}',
    cmd_appname: 'Name of the app to inspect (supports fuzzy match)',

    // ── stack descriptions (keyed by stack id) ───────────────────────────────
    stack_desc_electron: 'Cross-platform desktop apps with web technologies (HTML/CSS/JS)',
    stack_desc_flutter: "Google's UI toolkit for building natively compiled applications",
    stack_desc_cef: 'Embeds Chromium browser in native apps (used by Spotify, Steam, etc.)',
    stack_desc_chromium: 'Built directly on the Chromium open-source project (Chrome, Brave, Edge, etc.)',
    stack_desc_tauri: 'Rust-based framework using system WebView (lightweight alternative to Electron)',
    stack_desc_qt: 'C++ cross-platform framework with native look and feel',
    stack_desc_wxwidgets: 'C++ cross-platform GUI library that wraps native widgets (wxWidgets/wxPython apps)',
    stack_desc_unity: 'Unity game engine for games and interactive applications',
    stack_desc_jvm: 'Java Virtual Machine based apps (Swing, JavaFX, JetBrains IDEs, etc.)',
    stack_desc_dotnet: 'Microsoft .NET framework apps (WPF, WinForms, MAUI, Avalonia, etc.)',
    stack_desc_nwjs: 'Node.js + Chromium based desktop apps (formerly node-webkit)',
    stack_desc_reactnative: "Facebook's framework for building native apps using React",
    stack_desc_native: 'Built with platform-native technologies (Swift/Objective-C on macOS, Win32/MFC/WinUI on Windows)',
  },

  zh: {
    // ── category badges ──────────────────────────────────────────────────────
    badge_native: ' 原生 ',
    badge_cross: ' 跨平台 ',

    // ── detail view ──────────────────────────────────────────────────────────
    label_evidence: '检测依据：',
    label_bundle_id: 'Bundle ID：',
    label_version: '版本：',
    label_size: '大小：',
    table_head_size: '大小',

    // ── signature & notarization ─────────────────────────────────────────────
    label_security_section: '签名与公证',
    label_developer: '开发者：',
    label_team_id: '团队 ID：',
    label_signature: '签名：',
    label_notarization: '公证：',
    label_hardened_runtime: '强化运行时：',
    label_publisher: '签发者：',
    value_signed: '已签名',
    value_unsigned: '未签名',
    value_ad_hoc: '临时签名',
    value_notarized: '已公证',
    value_not_notarized: '未公证',
    value_apple_system: 'Apple 系统签名',
    value_mac_app_store: 'Mac App Store',
    value_rejected: '已拒绝',
    value_yes: '是',
    value_no: '否',

    // ── scan view ────────────────────────────────────────────────────────────
    scan_summary: '已扫描 {total} 个应用',
    scan_group_stat: '（{count} 个应用，{pct}%）',
    scan_distribution: '技术栈分布：',

    // ── filtered list view ───────────────────────────────────────────────────
    filter_no_result: '未找到 {stack} 应用。',
    filter_title: '{icon} {stack} 应用',
    filter_found: '— 共 {count} 个',
    table_head_app: '应用',
    table_head_version: '版本',
    table_head_tech: '技术栈',
    table_head_path: 'Bundle ID / 路径',

    // ── spinner / status messages ─────────────────────────────────────────────
    spinner_searching: '正在搜索 "{query}"…',
    spinner_analyzing: '正在分析 {name}…',
    spinner_analyzed: '分析完成：{name}',
    spinner_no_match: '未找到匹配 "{query}" 的应用',
    spinner_multi_match: '找到 {count} 个匹配项，正在分析…',
    spinner_multi_done: '找到 {count} 个匹配应用',
    spinner_path_fail: '分析失败：{msg}',
    spinner_scanning: '正在扫描已安装的应用…',
    spinner_analyzing_n: '正在分析 {count} 个应用…',
    spinner_analyzing_progress: '正在分析 {current}/{total}…',
    spinner_analyzed_n: '已分析 {count} 个应用',
    spinner_filter_scan: '正在扫描 {stack} 应用…',
    spinner_scan_done: '扫描完成',
    spinner_no_apps: '未找到任何应用。',

    // ── warnings / errors ────────────────────────────────────────────────────
    warn_use_scan: '可使用 --scan 查看所有已安装的应用。',
    warn_platform: '请确认当前系统为 macOS 或 Windows。',
    err_unsupported_platform: '不支持的平台：{platform}，仅支持 macOS 和 Windows。',
    err_path_not_found: '路径不存在：{path}',

    // ── commander descriptions ────────────────────────────────────────────────
    cmd_description: '检测桌面应用的技术栈',
    cmd_help: '显示帮助信息',
    cmd_scan: '扫描所有已安装应用并按技术栈分组展示',
    cmd_path: '指定要扫描的目录路径',
    cmd_filter: '显示所有使用 {name} 构建的应用',
    cmd_appname: '要查询的应用名称（支持模糊匹配）',

    // ── stack descriptions (keyed by stack id) ───────────────────────────────
    stack_desc_electron: '使用 Web 技术（HTML/CSS/JS）构建的跨平台桌面应用',
    stack_desc_flutter: 'Google 跨平台 UI 工具包，编译为原生代码',
    stack_desc_cef: '内嵌 Chromium 浏览器引擎（Spotify、Steam 等使用）',
    stack_desc_chromium: '直接基于 Chromium 开源项目构建（Chrome、Brave、Edge 等浏览器）',
    stack_desc_tauri: '基于 Rust 与系统 WebView 的轻量级跨平台框架',
    stack_desc_qt: '具有原生外观的 C++ 跨平台框架',
    stack_desc_wxwidgets: '基于 C++ 的跨平台 GUI 库，在各平台封装原生控件（含 wxWidgets / wxPython 应用）',
    stack_desc_unity: 'Unity 游戏引擎，用于游戏与交互式应用',
    stack_desc_jvm: '基于 Java 虚拟机的应用（Swing、JavaFX、JetBrains IDE 等）',
    stack_desc_dotnet: 'Microsoft .NET 框架应用（WPF、WinForms、MAUI、Avalonia 等）',
    stack_desc_nwjs: '基于 Node.js + Chromium 的桌面应用（原 node-webkit）',
    stack_desc_reactnative: 'Facebook React Native 桌面端框架',
    stack_desc_native: '使用平台原生技术构建（macOS: Swift/Objective-C，Windows: Win32/WinUI）',
  },
};

/**
 * Translate a key with optional variable interpolation.
 * Variables are written as {varName} in the template string.
 * Falls back to English if the key is missing in the current locale.
 *
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const str =
    translations[LOCALE]?.[key] ??
    translations.en[key] ??
    key;

  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? String(vars[k]) : `{${k}}`);
}

/**
 * Get the translated description for a stack id.
 * Falls back to the raw description string from the detector meta.
 *
 * @param {string} stackId
 * @param {string} fallback - The English description from the detector meta
 * @returns {string}
 */
export function stackDesc(stackId, fallback) {
  return translations[LOCALE]?.[`stack_desc_${stackId}`] ?? fallback;
}
