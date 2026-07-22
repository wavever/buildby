const INSTALL_COMMAND = 'npm i -g @wavever/buildby';
const LANGUAGE_STORAGE_KEY = 'buildby-language';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const translations = {
  en: {
    pageTitle: 'buildby — desktop app forensics',
    metaDescription: 'buildby identifies how desktop apps are built and reports the evidence, signatures, and notarization details behind the result.',
    ogDescription: 'Point buildby at a desktop app. Trace its framework, signature, identity, and notarization status.',
    skipLink: 'Skip to content',
    brandHome: 'buildby home',
    commandTrigger: 'Open command index',
    primaryNavigation: 'Primary navigation',
    readme: 'Readme',
    heroSummary: 'Desktop app forensics · macOS / Windows',
    heroTitle: 'Know the stack. Verify the evidence.',
    heroLede: 'Inspect the bundle, identify the framework, and verify who signed it—all from one local command.',
    installAria: 'Install buildby from npm',
    copyInstall: 'Copy install',
    copy: 'Copy',
    copying: 'Copying…',
    copied: 'Copied ✓',
    copyFailed: 'Copy failed',
    commandNote: 'Node.js 18+ · MIT licensed · local only',
    copySuccessStatus: 'Install command copied to the clipboard.',
    copyErrorStatus: 'Clipboard access was blocked. Select the command and copy it manually.',
    terminalReplay: 'Replay',
    terminalReplayAria: 'Replay terminal command',
    heroTerminalAria: 'Animated terminal running buildby ChatGPT and reproducing its actual inspection output',
    terminalAnalysisComplete: 'Analysis complete: ChatGPT',
    terminalCrossPlatform: 'Cross-platform',
    terminalDescription: 'Cross-platform desktop application built with Web technologies (HTML/CSS/JS)',
    terminalEvidenceHeading: 'Evidence:',
    terminalBundleId: 'Bundle ID:',
    terminalVersion: 'Version:',
    terminalSize: 'Size:',
    terminalSecurityHeading: 'Signature & Notarization',
    terminalDeveloper: 'Developer:',
    terminalTeamId: 'Team ID:',
    terminalSignature: 'Signature:',
    terminalNotarization: 'Notarization:',
    terminalHardenedRuntime: 'Hardened Runtime:',
    terminalYes: 'Yes',
    signalVerified: 'Notarized',
    signalSigned: 'Signed',
    heroCaption: 'Actual CLI output / local inspection',
    heroFoot: 'Trace every verdict to its source',
    traceLabel: 'Trace',
    tourTitle: 'Trace the verdict back to the files.',
    tourLead: 'Start broad, isolate the runtime, then inspect the evidence behind the match.',
    scanTerminalAria: 'Animated terminal running buildby --all and reproducing the complete technology stack report',
    terminalAllComplete: 'Analyzed 68 applications',
    terminalAllOutput: `  Desktop application technology stack report
  Scanned 68 applications · 38.23 GB total

  ◇ Cross-platform applications  37 · 54.4% · 27.68 GB
  🖥️ Largest stack  Native · 10.55 GB

  Browse applications by stack

  ⚡ Electron (19 applications, 27.9%) · 9.98 GB
    ChatGPT                               1.38 GB
    PilotDeck                             838.7 MB
    Pencil                                792.4 MB
    Multica                               723.1 MB
    AdsPower Global                       683.1 MB
    UGREEN NAS                            661.4 MB
    LM Studio                             599.4 MB
    Open Design                           553.5 MB
    … 11 more, use buildby -e to view all

  🌐 Chromium (4 applications, 5.9%) · 4.58 GB
    Quark                                 1.41 GB
    Google Chrome                         1.37 GB
    calibre                               1004.2 MB
    Arc                                   836.1 MB

  🧩 wxWidgets (4 applications, 5.9%) · 4.65 GB
    Microsoft Word                        1.36 GB
    WeChat                                1.27 GB
    Microsoft Excel                       1.07 GB
    Microsoft PowerPoint                  971.5 MB

  🦀 Tauri (3 applications, 4.4%) · 215.7 MB
    Clash Verge                           155.7 MB
    CC Switch                             49.9 MB
    KeyRecall                             10.2 MB

  🐦 Flutter (3 applications, 4.4%) · 277.1 MB
    FlClash                               139.4 MB
    Reqable                               83.0 MB
    LocalSend                             54.7 MB

  ☕ JVM (Java/Kotlin/Scala) (2 applications, 2.9%) · 6.06 GB
    IntelliJ IDEA                         3.07 GB
    Android Studio                        2.99 GB

  🔷 Qt (2 applications, 2.9%) · 1.93 GB
    VideoFusion-macOS                     1.84 GB
    Snipaste                              88.1 MB

  🖥️ Native (31 applications, 45.6%) · 10.55 GB
    Xcode                           4.60 GB     Native
    VMware Fusion                   1.35 GB     Native
    ToDesk                          443.8 MB    Native
    Zed                             372.8 MB    Native
    Keynote                         333.4 MB    Native
    Thunder                         332.0 MB    Native
    Warp                            327.2 MB    Native
    Telegram                        294.3 MB    Native
    … 23 more, use buildby -n to view all

  ────────────────────────────────────────────────────────────────────────

  Detected 68 desktop applications using 38.23 GB, earning the “Electron Collector” title

  ⚡ ████████░░░░░░░░░░░░░░░░░░░░  19  27.9%  9.98 GB  Electron
  🌐 ██░░░░░░░░░░░░░░░░░░░░░░░░░░   4   5.9%  4.58 GB  Chromium
  🧩 ██░░░░░░░░░░░░░░░░░░░░░░░░░░   4   5.9%  4.65 GB  wxWidgets
  🦀 █░░░░░░░░░░░░░░░░░░░░░░░░░░░   3   4.4%  215.7 MB  Tauri
  🐦 █░░░░░░░░░░░░░░░░░░░░░░░░░░░   3   4.4%  277.1 MB  Flutter
  ☕ █░░░░░░░░░░░░░░░░░░░░░░░░░░░   2   2.9%  6.06 GB  JVM (Java/Kotlin/Scala)
  🔷 █░░░░░░░░░░░░░░░░░░░░░░░░░░░   2   2.9%  1.93 GB  Qt
  🖥️ █████████████░░░░░░░░░░░░░░░  31  45.6%  10.55 GB  Native`,
    scanTitle: 'Map the entire machine.',
    scanCopy: 'Scan installed applications in one pass and expose the runtime distribution across the desktop.',
    scanCaption: 'Inventory / runtime distribution',
    scanCount: '68 APPS',
    filterTerminalAria: 'Animated terminal running buildby --electron and reproducing its 19-application table',
    terminalElectronComplete: 'Scan complete',
    terminalElectronOutput: `  ⚡ Electron applications — 19 total

  Application                    Version       Size        Bundle ID / Path
  ──────────────────────────────────────────────────────────────────────────────────────────────────
  aDrive                        6.8.7         422.3 MB    com.alicloud.smartdrive
  AdsPower Global               8.4.3         683.1 MB    com.adspower.global
  BaiduNetdisk_mac              4.14.8        392.7 MB    com.baidu.BaiduNetdisk-mac
  ChatGPT                       26.715.31925  1.38 GB     com.openai.codex
  Cherry Studio                 1.6.5         362.2 MB    com.kangfenmao.CherryStudio
  Discord                       0.0.335       375.4 MB    com.hnc.Discord
  Frame0                        1.5.0         351.0 MB    com.electron.frame0
  LM Studio                     0.4.12+1      599.4 MB    ai.elementlabs.lmstudio
  Multica                       0.4.4         723.1 MB    ai.multica.desktop
  Notion                        7.17.0        229.5 MB    notion.id
  O+Connect                     1.4.5         406.6 MB    com.oplus.devicespace
  Obsidian                      1.12.7        439.3 MB    md.obsidian
  Open Design                   0.11.0        553.5 MB    io.open-design.desktop
  Pencil                        1.1.67        792.4 MB    dev.pencil.desktop
  PilotDeck                     0.0.12        838.7 MB    cc.pilotdeck.desktop
  Postman                       11.31.4       365.4 MB    com.postmanlabs.mac
  Termius                       9.36.2        337.4 MB    com.termius-dmg.mac
  UGREEN NAS                    1.16.0        661.4 MB    com.ugreen.pro.client
  Z-Library                     2.1.2         271.4 MB    zlibrary`,
    filterTitle: 'Narrow the field.',
    filterCopy: 'Filter by framework to compare versions, bundle identities, sizes, and locations without noise.',
    filterCaption: 'Framework filter / identity table',
    filterCommand: 'buildby --electron',
    filterRuntime: 'ELECTRON',
    methodLabel: 'Method',
    methodTitle: 'No guesswork in the pipeline.',
    methodCopy: 'Every result moves through the same inspect, verify, and report sequence.',
    methodInput: 'Target',
    methodInputCopy: 'Resolve an app name, path, machine scan, or framework filter.',
    methodInspect: 'Inspect',
    methodInspectCopy: 'Read framework directories, resources, linked binaries, and metadata.',
    methodVerify: 'Verify',
    methodVerifyCopy: 'Check developer identity, signature, notarization, and hardened runtime.',
    methodReport: 'Report',
    methodReportCopy: 'Return the classification together with the evidence that produced it.',
    coverageLabel: 'Coverage',
    coverageTitle: 'A field guide to the modern desktop.',
    coverageLead: 'No admin privileges. No binary disassembly. Every scan stays on the machine.',
    webRuntimes: 'Web runtimes',
    webRuntimesEvidence: 'Bundle and resource signatures',
    crossPlatformUi: 'Cross-platform UI',
    crossPlatformEvidence: 'Framework and binary evidence',
    managedRuntimes: 'Managed runtimes',
    managedEvidence: 'Runtime directories and linked libraries',
    nativeFallback: 'Native fallback',
    nativeEvidence: 'Used when no cross-platform signature matches',
    platforms: 'Platforms',
    platformEvidence: 'Platform-native trust checks',
    footerKicker: 'Local. Verifiable. Open source.',
    footerStatement: 'Inspect the next app.',
    mitLicense: 'MIT license',
    stickyInstallAria: 'Install buildby',
    installWithNpm: 'Install with npm',
    commandSearchPlaceholder: 'Search commands…',
    pageCommands: 'Page commands',
    commands: 'Command index',
    commandInspect: 'Inspect one app',
    commandScan: 'Scan installed apps',
    commandFilter: 'Filter by framework',
    commandCoverage: 'View supported stacks',
    navigate: 'navigate',
    open: 'open',
    switchLanguage: 'Switch to Chinese',
  },
  zh: {
    pageTitle: 'buildby — 桌面应用取证',
    metaDescription: 'buildby 可识别桌面应用的构建技术，并展示判定依据、签名与公证信息。',
    ogDescription: '让 buildby 检查一个桌面应用，追踪它的框架、签名、身份与公证状态。',
    skipLink: '跳到正文',
    brandHome: 'buildby 首页',
    commandTrigger: '打开命令索引',
    primaryNavigation: '主导航',
    readme: '说明',
    heroSummary: '桌面应用取证系统 · macOS / Windows',
    heroTitle: '看穿技术栈，验证每条依据。',
    heroLede: '读取应用包、识别构建框架、验证签名身份——一个本地命令即可完成。',
    installAria: '通过 npm 安装 buildby',
    copyInstall: '复制安装命令',
    copy: '复制',
    copying: '正在复制…',
    copied: '已复制 ✓',
    copyFailed: '复制失败',
    commandNote: 'Node.js 18+ · MIT 许可 · 仅在本地运行',
    copySuccessStatus: '安装命令已复制到剪贴板。',
    copyErrorStatus: '浏览器阻止了剪贴板访问，请手动选择并复制命令。',
    terminalReplay: '重新执行',
    terminalReplayAria: '重新执行终端命令',
    heroTerminalAria: '终端动画：运行 buildby ChatGPT，并复现实际检测输出',
    terminalAnalysisComplete: '分析完成：ChatGPT',
    terminalCrossPlatform: '跨平台',
    terminalDescription: '使用 Web 技术（HTML/CSS/JS）构建的跨平台桌面应用',
    terminalEvidenceHeading: '检测依据：',
    terminalBundleId: 'Bundle ID：',
    terminalVersion: '版本：',
    terminalSize: '大小：',
    terminalSecurityHeading: '签名与公证',
    terminalDeveloper: '开发者：',
    terminalTeamId: '团队 ID：',
    terminalSignature: '签名：',
    terminalNotarization: '公证：',
    terminalHardenedRuntime: '强化运行时：',
    terminalYes: '是',
    signalVerified: '已公证',
    signalSigned: '已签名',
    heroCaption: '真实 CLI 输出 / 本地检测',
    heroFoot: '让每个结论都能追溯到源头',
    traceLabel: '追踪',
    tourTitle: '沿着文件，追溯每个结论。',
    tourLead: '先扫描全局，再锁定运行时，最后查看命中特征背后的依据。',
    scanTerminalAria: '终端动画：运行 buildby --all，并复现完整技术栈报告',
    terminalAllComplete: '已分析 68 个应用',
    terminalAllOutput: `  桌面应用技术栈报告
  已扫描 68 个应用 · 共 38.23 GB

  ◇ 跨平台应用  37 个 · 54.4% · 27.68 GB
  🖥️ 最大技术栈  Native · 10.55 GB

  按技术栈查看应用

  ⚡ Electron （19 个应用，27.9%） · 9.98 GB
    ChatGPT                               1.38 GB
    PilotDeck                             838.7 MB
    Pencil                                792.4 MB
    Multica                               723.1 MB
    AdsPower Global                       683.1 MB
    UGREEN NAS                            661.4 MB
    LM Studio                             599.4 MB
    Open Design                           553.5 MB
    … 还有 11 个，使用 buildby -e 查看全部

  🌐 Chromium （4 个应用，5.9%） · 4.58 GB
    Quark                                 1.41 GB
    Google Chrome                         1.37 GB
    calibre                               1004.2 MB
    Arc                                   836.1 MB

  🧩 wxWidgets （4 个应用，5.9%） · 4.65 GB
    Microsoft Word                        1.36 GB
    WeChat                                1.27 GB
    Microsoft Excel                       1.07 GB
    Microsoft PowerPoint                  971.5 MB

  🦀 Tauri （3 个应用，4.4%） · 215.7 MB
    Clash Verge                           155.7 MB
    CC Switch                             49.9 MB
    KeyRecall                             10.2 MB

  🐦 Flutter （3 个应用，4.4%） · 277.1 MB
    FlClash                               139.4 MB
    Reqable                               83.0 MB
    LocalSend                             54.7 MB

  ☕ JVM (Java/Kotlin/Scala) （2 个应用，2.9%） · 6.06 GB
    IntelliJ IDEA                         3.07 GB
    Android Studio                        2.99 GB

  🔷 Qt （2 个应用，2.9%） · 1.93 GB
    VideoFusion-macOS                     1.84 GB
    Snipaste                              88.1 MB

  🖥️ Native （31 个应用，45.6%） · 10.55 GB
    Xcode                           4.60 GB     Native
    VMware Fusion                   1.35 GB     Native
    ToDesk                          443.8 MB    Native
    Zed                             372.8 MB    Native
    Keynote                         333.4 MB    Native
    Thunder                         332.0 MB    Native
    Warp                            327.2 MB    Native
    Telegram                        294.3 MB    Native
    … 还有 23 个，使用 buildby -n 查看全部

  ────────────────────────────────────────────────────────────────────────

  共检测 68 个桌面应用，占用 38.23 GB，荣获 「Electron 收藏家」 称号

  ⚡ ████████░░░░░░░░░░░░░░░░░░░░  19  27.9%  9.98 GB  Electron
  🌐 ██░░░░░░░░░░░░░░░░░░░░░░░░░░   4   5.9%  4.58 GB  Chromium
  🧩 ██░░░░░░░░░░░░░░░░░░░░░░░░░░   4   5.9%  4.65 GB  wxWidgets
  🦀 █░░░░░░░░░░░░░░░░░░░░░░░░░░░   3   4.4%  215.7 MB  Tauri
  🐦 █░░░░░░░░░░░░░░░░░░░░░░░░░░░   3   4.4%  277.1 MB  Flutter
  ☕ █░░░░░░░░░░░░░░░░░░░░░░░░░░░   2   2.9%  6.06 GB  JVM (Java/Kotlin/Scala)
  🔷 █░░░░░░░░░░░░░░░░░░░░░░░░░░░   2   2.9%  1.93 GB  Qt
  🖥️ █████████████░░░░░░░░░░░░░░░  31  45.6%  10.55 GB  Native`,
    scanTitle: '绘制整台电脑。',
    scanCopy: '一次扫描全部已安装应用，呈现桌面环境中的运行时分布。',
    scanCaption: '应用清单 / 运行时分布',
    scanCount: '68 APPS',
    filterTerminalAria: '终端动画：运行 buildby --electron，并复现包含 19 个应用的筛选表格',
    terminalElectronComplete: '扫描完成',
    terminalElectronOutput: `  ⚡ Electron 应用 — 共 19 个

  应用                          版本          大小        Bundle ID / 路径
  ──────────────────────────────────────────────────────────────────────────────────────────────────
  aDrive                        6.8.7         422.3 MB    com.alicloud.smartdrive
  AdsPower Global               8.4.3         683.1 MB    com.adspower.global
  BaiduNetdisk_mac              4.14.8        392.7 MB    com.baidu.BaiduNetdisk-mac
  ChatGPT                       26.715.31925  1.38 GB     com.openai.codex
  Cherry Studio                 1.6.5         362.2 MB    com.kangfenmao.CherryStudio
  Discord                       0.0.335       375.4 MB    com.hnc.Discord
  Frame0                        1.5.0         351.0 MB    com.electron.frame0
  LM Studio                     0.4.12+1      599.4 MB    ai.elementlabs.lmstudio
  Multica                       0.4.4         723.1 MB    ai.multica.desktop
  Notion                        7.17.0        229.5 MB    notion.id
  O+Connect                     1.4.5         406.6 MB    com.oplus.devicespace
  Obsidian                      1.12.7        439.3 MB    md.obsidian
  Open Design                   0.11.0        553.5 MB    io.open-design.desktop
  Pencil                        1.1.67        792.4 MB    dev.pencil.desktop
  PilotDeck                     0.0.12        838.7 MB    cc.pilotdeck.desktop
  Postman                       11.31.4       365.4 MB    com.postmanlabs.mac
  Termius                       9.36.2        337.4 MB    com.termius-dmg.mac
  UGREEN NAS                    1.16.0        661.4 MB    com.ugreen.pro.client
  Z-Library                     2.1.2         271.4 MB    zlibrary`,
    filterTitle: '缩小取证范围。',
    filterCopy: '按框架筛选版本、包身份、体积与路径，排除无关噪音。',
    filterCaption: '框架筛选 / 身份列表',
    filterCommand: 'buildby --electron',
    filterRuntime: 'ELECTRON',
    methodLabel: '方法',
    methodTitle: '整条检测链路，不靠猜测。',
    methodCopy: '每项结果都经过相同的检查、验证和报告流程。',
    methodInput: '锁定目标',
    methodInputCopy: '解析应用名称、路径、整机扫描或框架筛选条件。',
    methodInspect: '读取结构',
    methodInspectCopy: '读取框架目录、资源文件、链接库与应用元数据。',
    methodVerify: '验证身份',
    methodVerifyCopy: '检查开发者身份、签名、公证状态与强化运行时。',
    methodReport: '生成报告',
    methodReportCopy: '输出技术分类，以及产生该结论的对应检测依据。',
    coverageLabel: '覆盖范围',
    coverageTitle: '一份现代桌面技术栈图谱。',
    coverageLead: '无需管理员权限，不进行二进制反汇编，每次扫描都留在本机。',
    webRuntimes: 'Web 运行时',
    webRuntimesEvidence: '应用包与资源文件特征',
    crossPlatformUi: '跨平台 UI',
    crossPlatformEvidence: '框架与二进制证据',
    managedRuntimes: '托管运行时',
    managedEvidence: '运行时目录与链接库',
    nativeFallback: '原生兜底',
    nativeEvidence: '未匹配跨平台特征时使用',
    platforms: '平台',
    platformEvidence: '平台原生可信状态检查',
    footerKicker: '本地。可验证。开源。',
    footerStatement: '检查下一个应用。',
    mitLicense: 'MIT 许可证',
    stickyInstallAria: '安装 buildby',
    installWithNpm: '通过 npm 安装',
    commandSearchPlaceholder: '搜索命令…',
    pageCommands: '页面命令',
    commands: '命令索引',
    commandInspect: '检查单个应用',
    commandScan: '扫描已安装应用',
    commandFilter: '按框架筛选',
    commandCoverage: '查看支持的技术栈',
    navigate: '导航',
    open: '打开',
    switchLanguage: '切换到英文',
  },
};

let currentLanguage = 'en';

function normalizeLanguage(value) {
  return String(value || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function getInitialLanguage() {
  const urlLanguage = new URLSearchParams(window.location.search).get('lang');
  if (urlLanguage) return normalizeLanguage(urlLanguage);

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) return normalizeLanguage(storedLanguage);
  } catch {
    // Language preference is optional when storage is unavailable.
  }

  return normalizeLanguage(navigator.language);
}

function translate(key) {
  return translations[currentLanguage][key] || translations.en[key] || key;
}

function formatCommandCount(count) {
  if (currentLanguage === 'zh') return `${count} 条命令`;
  return `${count} ${count === 1 ? 'command' : 'commands'}`;
}

function resetCopyButton(button) {
  const compact = button.classList.contains('copy-button-compact');
  button.dataset.state = 'default';
  button.disabled = false;
  button.removeAttribute('aria-disabled');
  button.querySelector('.copy-label').textContent = compact ? translate('copy') : translate('copyInstall');
}

function applyLanguage(language, persist = false) {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.language = currentLanguage;
  document.title = translate('pageTitle');

  const description = document.querySelector('meta[name="description"]');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (description) description.content = translate('metaDescription');
  if (ogTitle) ogTitle.content = translate('pageTitle');
  if (ogDescription) ogDescription.content = translate('ogDescription');

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', translate(element.dataset.i18nPlaceholder));
  });
  const languageToggle = document.querySelector('#language-toggle');
  if (languageToggle) {
    languageToggle.querySelector('span').textContent = currentLanguage === 'zh' ? 'EN' : '中';
    languageToggle.setAttribute('aria-label', translate('switchLanguage'));
    languageToggle.title = translate('switchLanguage');
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    if (!button.disabled) resetCopyButton(button);
  });
  const visibleCount = document.querySelectorAll('.command-item:not([hidden])').length;
  const commandCountElement = document.querySelector('#command-count');
  if (commandCountElement) commandCountElement.textContent = formatCommandCount(visibleCount);

  if (persist) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      // The page still works when storage is unavailable.
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = value;
  fallback.setAttribute('readonly', '');
  fallback.className = 'sr-only';
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand('copy');
  fallback.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

applyLanguage(getInitialLanguage());

document.querySelector('#language-toggle')?.addEventListener('click', () => {
  applyLanguage(currentLanguage === 'en' ? 'zh' : 'en', true);
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  let resetTimer;

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    window.clearTimeout(resetTimer);
    button.dataset.state = 'loading';
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.querySelector('.copy-label').textContent = translate('copying');

    try {
      await Promise.all([copyText(button.dataset.copy || INSTALL_COMMAND), wait(150)]);
      button.dataset.state = 'success';
      button.querySelector('.copy-label').textContent = translate('copied');
      document.querySelector('#copy-status').textContent = translate('copySuccessStatus');
    } catch {
      button.dataset.state = 'error';
      button.querySelector('.copy-label').textContent = translate('copyFailed');
      document.querySelector('#copy-status').textContent = translate('copyErrorStatus');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      resetTimer = window.setTimeout(() => resetCopyButton(button), 2500);
    }
  });
});

const typedCommand = document.querySelector('#typed-command');
if (typedCommand && !reducedMotion.matches) {
  const value = typedCommand.dataset.command || INSTALL_COMMAND;
  typedCommand.textContent = '';
  typedCommand.classList.add('is-typing');
  const startedAt = performance.now();
  const duration = 760;

  function typeFrame(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    typedCommand.textContent = value.slice(0, Math.floor(progress * value.length));
    if (progress < 1) {
      window.requestAnimationFrame(typeFrame);
    } else {
      typedCommand.textContent = value;
      window.setTimeout(() => typedCommand.classList.remove('is-typing'), 600);
    }
  }

  window.requestAnimationFrame(typeFrame);
}

const revealTargets = [...document.querySelectorAll('.reveal-once, [data-reveal]')];
if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealTargets.forEach((target) => target.classList.add('is-in'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.13, rootMargin: '0px 0px -5% 0px' });
  revealTargets.forEach((target) => revealObserver.observe(target));
}

const terminalScrollStates = new WeakMap();

function startTerminalAutoScroll(target) {
  const viewport = target.querySelector('.terminal-scroll-window');
  if (!viewport) return;

  terminalScrollStates.get(viewport)?.cancel();
  viewport.scrollTop = 0;
  if (reducedMotion.matches) return;

  const cancelEvents = ['pointerenter', 'wheel', 'touchstart', 'pointerdown', 'keydown', 'focus'];
  const state = { cancelled: false, frameId: 0, timerId: 0 };
  const cancel = () => {
    if (state.cancelled) return;
    state.cancelled = true;
    window.clearTimeout(state.timerId);
    window.cancelAnimationFrame(state.frameId);
    cancelEvents.forEach((eventName) => viewport.removeEventListener(eventName, cancel));
  };

  state.cancel = cancel;
  terminalScrollStates.set(viewport, state);
  cancelEvents.forEach((eventName) => {
    const passive = eventName !== 'keydown' && eventName !== 'focus';
    viewport.addEventListener(eventName, cancel, { once: true, passive });
  });

  const duration = target.classList.contains('terminal-all-frame') ? 19000 : 11000;
  state.timerId = window.setTimeout(() => {
    if (state.cancelled) return;
    const startedAt = performance.now();

    function scrollFrame(now) {
      if (state.cancelled) return;
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      viewport.scrollTop = maxScroll * eased;

      if (progress < 1) {
        state.frameId = window.requestAnimationFrame(scrollFrame);
      }
    }

    state.frameId = window.requestAnimationFrame(scrollFrame);
  }, 2400);
}

function activateTerminal(target) {
  target.classList.add('is-terminal-active');
  startTerminalAutoScroll(target);
}

const terminalTargets = [...document.querySelectorAll('[data-terminal]')];
if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  terminalTargets.forEach(activateTerminal);
} else {
  const terminalObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      activateTerminal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.24, rootMargin: '0px 0px -8% 0px' });
  terminalTargets.forEach((target) => terminalObserver.observe(target));
}

document.querySelectorAll('[data-terminal-replay]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.terminalReplay);
    if (!target) return;

    terminalScrollStates.get(target.querySelector('.terminal-scroll-window'))?.cancel();
    target.classList.remove('is-terminal-active');
    void target.offsetWidth;
    activateTerminal(target);
  });
});

const inspectionStage = document.querySelector('.inspection-stage');
const inspectionVisual = document.querySelector('#hero-inspection');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
if (inspectionStage && inspectionVisual && finePointer.matches && !reducedMotion.matches) {
  inspectionVisual.addEventListener('pointermove', (event) => {
    const bounds = inspectionVisual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    inspectionStage.style.setProperty('--stage-rotate-x', `${y * -2.4}deg`);
    inspectionStage.style.setProperty('--stage-rotate-y', `${x * 2.8}deg`);
  });
  inspectionVisual.addEventListener('pointerleave', () => {
    inspectionStage.style.removeProperty('--stage-rotate-x');
    inspectionStage.style.removeProperty('--stage-rotate-y');
  });
}

const stickyCta = document.querySelector('#sticky-cta');
const tourEnd = document.querySelector('#tour-end');
const footer = document.querySelector('#footer');
let reachedTourEnd = false;
let footerVisible = false;

function syncStickyCta() {
  stickyCta?.classList.toggle('is-visible', reachedTourEnd && !footerVisible);
}

if (stickyCta && tourEnd && footer) {
  const ctaObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target === tourEnd) {
        reachedTourEnd = entry.isIntersecting || entry.boundingClientRect.top < 0;
      }
      if (entry.target === footer) footerVisible = entry.isIntersecting;
    });
    syncStickyCta();
  }, { threshold: 0 });

  ctaObserver.observe(tourEnd);
  ctaObserver.observe(footer);
}

const commandDialog = document.querySelector('#command-dialog');
const commandTrigger = document.querySelector('#command-trigger');
const commandInput = document.querySelector('#command-input');
const commandCount = document.querySelector('#command-count');
const pageShell = document.querySelector('#page-shell');
const commandItems = [...document.querySelectorAll('.command-item')];
let activeIndex = 0;

function visibleCommandItems() {
  return commandItems.filter((item) => !item.hidden);
}

function setActiveItem(index) {
  const visibleItems = visibleCommandItems();
  if (!visibleItems.length) return;
  activeIndex = (index + visibleItems.length) % visibleItems.length;
  visibleItems.forEach((item, itemIndex) => {
    const active = itemIndex === activeIndex;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
  visibleItems[activeIndex].scrollIntoView({ block: 'nearest' });
}

function openCommandDialog() {
  if (!commandDialog || commandDialog.open) return;
  commandDialog.showModal();
  pageShell?.setAttribute('inert', '');
  commandInput.value = '';
  commandItems.forEach((item) => { item.hidden = false; });
  commandCount.textContent = formatCommandCount(commandItems.length);
  setActiveItem(0);
  commandInput.focus({ preventScroll: true });
}

function closeCommandDialog() {
  if (commandDialog?.open) commandDialog.close();
}

commandTrigger?.addEventListener('click', openCommandDialog);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && commandDialog?.open) {
    event.preventDefault();
    closeCommandDialog();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    commandDialog?.open ? closeCommandDialog() : openCommandDialog();
  }
});

commandDialog?.addEventListener('close', () => {
  pageShell?.removeAttribute('inert');
  commandTrigger?.focus({ preventScroll: true });
});

commandDialog?.addEventListener('click', (event) => {
  const bounds = commandDialog.getBoundingClientRect();
  const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (!inside) closeCommandDialog();
});

commandInput?.addEventListener('input', () => {
  const query = commandInput.value.trim().toLowerCase();
  commandItems.forEach((item) => {
    item.hidden = !`${item.textContent} ${item.dataset.search}`.toLowerCase().includes(query);
  });
  commandCount.textContent = formatCommandCount(visibleCommandItems().length);
  setActiveItem(0);
});

commandInput?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setActiveItem(activeIndex + 1);
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setActiveItem(activeIndex - 1);
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    visibleCommandItems()[activeIndex]?.click();
  }
});

commandItems.forEach((item) => {
  item.addEventListener('pointermove', () => {
    const visibleItems = visibleCommandItems();
    setActiveItem(visibleItems.indexOf(item));
  });
  item.addEventListener('click', closeCommandDialog);
});
