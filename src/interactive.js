import readline from 'readline';
import chalk from 'chalk';
import { t, LOCALE } from './i18n.js';

/**
 * Score relevance of an application against a search query.
 * @param {{ name: string, path: string }} app
 * @param {string} query
 * @returns {number} Score > 0 if matched, 0 otherwise
 */
function scoreAppMatch(app, query) {
  const q = query.toLowerCase();
  const name = (app.name || '').toLowerCase();
  const p = (app.path || '').toLowerCase();

  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  const nameIndex = name.indexOf(q);
  if (nameIndex !== -1) return 60 - Math.min(nameIndex, 20);
  if (p.includes(q)) return 20;

  // Word boundary match: e.g. "vs code" matching "Visual Studio Code"
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => name.includes(w) || p.includes(w))) {
    return 40;
  }

  return 0;
}

/**
 * Filter and sort applications matching the query.
 * If query is empty, returns all applications (up to limit).
 * @param {Array<{ name: string, path: string }>} apps
 * @param {string} query
 * @param {number} [limit=Infinity]
 * @returns {Array<{ name: string, path: string }>}
 */
export function findMatchingApps(apps, query, limit = Infinity) {
  const trimmed = (query || '').trim();
  let results = [];

  if (!trimmed) {
    results = apps.slice();
  } else {
    const scored = [];
    for (const app of apps) {
      const score = scoreAppMatch(app, trimmed);
      if (score > 0) {
        scored.push({ app, score });
      }
    }
    scored.sort((a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name));
    results = scored.map((s) => s.app);
  }

  return Number.isFinite(limit) && limit > 0 ? results.slice(0, limit) : results;
}

/**
 * Set up terminal keypress and raw mode, with fallback for non-TTY streams.
 */
export function setupInputListener(input, output, onKeypress, onLine) {
  readline.emitKeypressEvents(input);
  const isTTY = !!input.isTTY && typeof input.setRawMode === 'function';

  // Hide terminal cursor in TTY to avoid cursor jump flickering
  if (output && output.isTTY) {
    output.write('\x1b[?25l');
  }

  if (isTTY) {
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
  }

  // Also support line input for non-TTY / automated tests
  let rl = null;
  if (!isTTY && typeof onLine === 'function') {
    rl = readline.createInterface({ input, terminal: false });
    rl.on('line', onLine);
  }

  const restoreCursor = () => {
    if (output && output.isTTY) {
      output.write('\x1b[?25h');
    }
  };

  process.once('exit', restoreCursor);

  return () => {
    process.removeListener('exit', restoreCursor);
    restoreCursor();

    if (isTTY) {
      input.removeListener('keypress', onKeypress);
      try {
        input.setRawMode(false);
      } catch {
        // ignore
      }
      input.pause();
    }
    if (rl) {
      try {
        rl.close();
      } catch {
        // ignore
      }
    }
  };
}

/**
 * Determine comfortable visible page size based on terminal height.
 */
function getPageSize(output, defaultSize = 10) {
  if (output && output.rows && Number.isFinite(output.rows)) {
    return Math.min(15, Math.max(5, output.rows - 8));
  }
  return defaultSize;
}

/**
 * Run interactive single application search and selection.
 * Full app list is scrollable with zero terminal flickering.
 *
 * @param {Array<{ name: string, path: string, platform?: string }>} [apps] - List of installed apps
 * @param {(selectedApp: object) => Promise<void> | void} [onSelect] - Callback when an app is selected
 * @param {object} [options]
 * @param {NodeJS.ReadableStream} [options.input=process.stdin]
 * @param {NodeJS.WritableStream} [options.output=process.stdout]
 * @param {number} [options.limit=Infinity]
 * @param {number} [options.pageSize]
 * @returns {Promise<object | null>} Selected app or null if cancelled
 */
export async function runInteractiveSelect(apps, onSelect, {
  input = process.stdin,
  output = process.stdout,
  limit = Infinity,
  pageSize: customPageSize,
} = {}) {
  let appList = apps;
  if (!appList || appList.length === 0) {
    try {
      const { scanAllApps } = await import('./scanner.js');
      appList = scanAllApps();
    } catch {
      appList = [];
    }
  }

  if (appList.length === 0) {
    output.write(chalk.yellow(`\n${t('spinner_no_apps') || 'No applications found.'}\n\n`));
    return null;
  }

  const isZh = LOCALE === 'zh';
  const pageSize = customPageSize || getPageSize(output, 10);
  let query = '';
  let candidates = findMatchingApps(appList, query, limit);
  let selectedIndex = 0;
  let scrollOffset = 0;
  let lastRenderedLineCount = 0;
  let isDone = false;

  const updateScroll = () => {
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + pageSize) {
      scrollOffset = selectedIndex - pageSize + 1;
    }
    const maxOffset = Math.max(0, candidates.length - pageSize);
    scrollOffset = Math.max(0, Math.min(scrollOffset, maxOffset));
  };

  const render = () => {
    if (isDone) return;
    updateScroll();

    const lines = [];
    const title = isZh ? '🔍 buildby 应用检测' : '🔍 buildby App Inspector';
    const totalCount = candidates.length;
    const posText = totalCount > 0 ? `(${selectedIndex + 1}/${totalCount})` : '(0/0)';
    const prompt = isZh ? '搜索应用' : 'Search apps';
    const queryDisplay = query ? chalk.bold.white(query) : chalk.dim(isZh ? '(输入关键词模糊过滤)' : '(type to search)');

    lines.push(`${chalk.bold.cyan(title)}  ${chalk.dim(posText)}`);
    lines.push(`${chalk.bold.cyan('?')} ${chalk.bold(prompt)}: ${queryDisplay}`);
    lines.push('');

    if (candidates.length === 0) {
      lines.push(chalk.yellow(`  ${isZh ? `未找到匹配 "${query}" 的应用` : `No applications found matching "${query}"`}`));
    } else {
      // Top scroll indicator
      if (scrollOffset > 0) {
        lines.push(chalk.dim(`  ▲ 向上还有 ${scrollOffset} 个应用…`));
      }

      const visible = candidates.slice(scrollOffset, scrollOffset + pageSize);
      visible.forEach((app, idx) => {
        const realIdx = scrollOffset + idx;
        const isCurrent = realIdx === selectedIndex;
        const pointer = isCurrent ? chalk.cyan.bold('❯') : ' ';
        const num = chalk.dim(`[${realIdx + 1}]`);
        const name = isCurrent ? chalk.cyan.bold.underline(app.name) : chalk.bold(app.name);
        const appPath = chalk.dim(`(${app.path})`);
        lines.push(`  ${pointer} ${num} ${name} ${appPath}`);
      });

      // Bottom scroll indicator
      const remainingBelow = totalCount - (scrollOffset + visible.length);
      if (remainingBelow > 0) {
        lines.push(chalk.dim(`  ▼ 向下还有 ${remainingBelow} 个应用…`));
      }
    }

    lines.push('');
    const hint = isZh
      ? '↑/↓ 移动光标 · Enter 确认选择 · q 退出'
      : '↑/↓ navigate · Enter to select · q to quit';
    lines.push(chalk.dim(`  ${hint}`));

    // Atomic flicker-free write
    let buf = '';
    if (lastRenderedLineCount > 0 && output.isTTY) {
      buf += `\x1b[${lastRenderedLineCount}A\r`;
    }
    for (const line of lines) {
      buf += `\x1b[2K${line}\n`;
    }
    if (lastRenderedLineCount > lines.length && output.isTTY) {
      buf += '\x1b[0J';
    }

    output.write(buf);
    lastRenderedLineCount = lines.length;
  };

  return new Promise((resolve) => {
    let cleanup = null;

    const finish = async (selected) => {
      if (isDone) return;
      isDone = true;
      if (cleanup) cleanup();

      if (output.isTTY && lastRenderedLineCount > 0) {
        output.write(`\x1b[${lastRenderedLineCount}A\r\x1b[0J`);
      }

      if (selected) {
        output.write(chalk.green(`\n✓ ${isZh ? '已选择' : 'Selected'}: ${chalk.bold(selected.name)}\n\n`));
        try {
          if (typeof onSelect === 'function') {
            await onSelect(selected);
          }
        } finally {
          resolve(selected);
        }
      } else {
        output.write(chalk.dim(`\n${isZh ? '已退出。' : 'Exited.'}\n\n`));
        resolve(null);
      }
    };

    const handleKeypress = (str, key = {}) => {
      if (isDone) return;

      // Exit controls
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        finish(null);
        return;
      }
      if ((str === 'q' || str === 'Q') && !query) {
        finish(null);
        return;
      }

      // Up arrow
      if (key.name === 'up') {
        if (candidates.length > 0) {
          selectedIndex = (selectedIndex - 1 + candidates.length) % candidates.length;
        }
        render();
        return;
      }

      // Down arrow
      if (key.name === 'down') {
        if (candidates.length > 0) {
          selectedIndex = (selectedIndex + 1) % candidates.length;
        }
        render();
        return;
      }

      // PageUp / PageDown
      if (key.name === 'pageup') {
        selectedIndex = Math.max(0, selectedIndex - pageSize);
        render();
        return;
      }
      if (key.name === 'pagedown') {
        selectedIndex = Math.min(candidates.length - 1, selectedIndex + pageSize);
        render();
        return;
      }

      // Enter
      if (key.name === 'return' || key.name === 'enter') {
        if (candidates.length > 0 && selectedIndex >= 0 && selectedIndex < candidates.length) {
          finish(candidates[selectedIndex]);
        }
        return;
      }

      // Backspace
      if (key.name === 'backspace') {
        if (query.length > 0) {
          query = query.slice(0, -1);
          candidates = findMatchingApps(appList, query, limit);
          selectedIndex = 0;
          scrollOffset = 0;
          render();
        }
        return;
      }

      // Regular character input
      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        query += str;
        candidates = findMatchingApps(appList, query, limit);
        selectedIndex = 0;
        scrollOffset = 0;
        render();
      }
    };

    // Non-TTY line fallback for tests
    const handleLine = (line) => {
      if (isDone) return;
      const str = line.trim();

      if (str.toLowerCase() === 'q' || str.toLowerCase() === 'exit') {
        finish(null);
        return;
      }

      // Numeric selection
      if (/^\d+$/.test(str)) {
        const choice = parseInt(str, 10);
        if (choice >= 1 && choice <= candidates.length) {
          finish(candidates[choice - 1]);
          return;
        }
      }

      // Empty line: select current
      if (str === '') {
        if (candidates.length > 0) {
          finish(candidates[selectedIndex]);
        }
        return;
      }

      // Search query
      query = str;
      candidates = findMatchingApps(appList, query, limit);
      selectedIndex = 0;
      scrollOffset = 0;
      render();
    };

    cleanup = setupInputListener(input, output, handleKeypress, handleLine);
    render();
  });
}

/**
 * Run interactive two-application comparison selection.
 * Full app list is scrollable with zero terminal flickering.
 * Allows using Up/Down arrow keys, Space to check/uncheck, and Enter to compare.
 *
 * @param {Array<{ name: string, path: string, platform?: string }>} [apps] - List of installed apps
 * @param {(selectedApps: object[]) => Promise<void> | void} [onCompare] - Callback with 2 selected apps
 * @param {object} [options]
 * @param {NodeJS.ReadableStream} [options.input=process.stdin]
 * @param {NodeJS.WritableStream} [options.output=process.stdout]
 * @param {number} [options.limit=Infinity]
 * @param {number} [options.pageSize]
 * @param {string[]} [options.preselected=[]] - App names/paths to pre-check
 * @returns {Promise<object[] | null>} 2 selected apps or null if cancelled
 */
export async function runInteractiveCompare(apps, onCompare, {
  input = process.stdin,
  output = process.stdout,
  limit = Infinity,
  pageSize: customPageSize,
  preselected = [],
} = {}) {
  let appList = apps;
  if (!appList || appList.length === 0) {
    try {
      const { scanAllApps } = await import('./scanner.js');
      appList = scanAllApps();
    } catch {
      appList = [];
    }
  }

  if (appList.length === 0) {
    output.write(chalk.yellow(`\n${t('spinner_no_apps') || 'No applications found.'}\n\n`));
    return null;
  }

  const isZh = LOCALE === 'zh';
  const pageSize = customPageSize || getPageSize(output, 10);
  const selectedMap = new Map(); // key: app.path, value: app

  // Handle preselected items
  if (Array.isArray(preselected)) {
    for (const pre of preselected) {
      if (!pre) continue;
      const match = appList.find(
        (a) => a.name.toLowerCase() === pre.toLowerCase() || a.path.toLowerCase() === pre.toLowerCase()
      );
      if (match && selectedMap.size < 2) {
        selectedMap.set(match.path, match);
      }
    }
  }

  let query = '';
  let candidates = findMatchingApps(appList, query, limit);
  let selectedIndex = 0;
  let scrollOffset = 0;
  let lastRenderedLineCount = 0;
  let isDone = false;

  const updateScroll = () => {
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + pageSize) {
      scrollOffset = selectedIndex - pageSize + 1;
    }
    const maxOffset = Math.max(0, candidates.length - pageSize);
    scrollOffset = Math.max(0, Math.min(scrollOffset, maxOffset));
  };

  const render = () => {
    if (isDone) return;
    updateScroll();

    const lines = [];
    const title = isZh ? '⚖️  buildby 应用对比' : '⚖️  buildby App Comparison';
    const totalCount = candidates.length;
    const posText = totalCount > 0 ? `(${selectedIndex + 1}/${totalCount})` : '(0/0)';
    const countBadge = selectedMap.size === 2
      ? chalk.bgGreen.black(` ${isZh ? '已选满' : 'Ready'} [2/2] `)
      : chalk.bgYellow.black(` ${isZh ? '已选择' : 'Selected'} [${selectedMap.size}/2] `);

    const prompt = isZh ? '搜索应用' : 'Search apps';
    const queryDisplay = query ? chalk.bold.white(query) : chalk.dim(isZh ? '(输入关键词模糊过滤)' : '(type to search)');

    lines.push(`${chalk.bold.magenta(title)}  ${countBadge}  ${chalk.dim(posText)}`);
    lines.push(`${chalk.bold.magenta('?')} ${chalk.bold(prompt)}: ${queryDisplay}`);
    lines.push('');

    if (candidates.length === 0) {
      lines.push(chalk.yellow(`  ${isZh ? `未找到匹配 "${query}" 的应用` : `No applications found matching "${query}"`}`));
    } else {
      // Top scroll indicator
      if (scrollOffset > 0) {
        lines.push(chalk.dim(`  ▲ 向上还有 ${scrollOffset} 个应用…`));
      }

      const visible = candidates.slice(scrollOffset, scrollOffset + pageSize);
      visible.forEach((app, idx) => {
        const realIdx = scrollOffset + idx;
        const isCurrent = realIdx === selectedIndex;
        const isChecked = selectedMap.has(app.path);
        const pointer = isCurrent ? chalk.magenta.bold('❯') : ' ';
        const checkMark = isChecked
          ? chalk.green.bold('◉ [已选]')
          : chalk.dim('◯ [    ]');
        const name = isCurrent
          ? chalk.magenta.bold.underline(app.name)
          : (isChecked ? chalk.green.bold(app.name) : chalk.bold(app.name));
        const appPath = chalk.dim(`(${app.path})`);
        lines.push(`  ${pointer} ${checkMark} ${name} ${appPath}`);
      });

      // Bottom scroll indicator
      const remainingBelow = totalCount - (scrollOffset + visible.length);
      if (remainingBelow > 0) {
        lines.push(chalk.dim(`  ▼ 向下还有 ${remainingBelow} 个应用…`));
      }
    }

    lines.push('');
    let hint;
    if (selectedMap.size >= 2) {
      hint = isZh
        ? chalk.green.bold('✓ 已选择 2 个应用！按 Enter 立即开始对比，按 Space 取消勾选')
        : chalk.green.bold('✓ 2 apps selected! Press Enter to compare, Space to uncheck');
    } else {
      hint = isZh
        ? `↑/↓ 移动光标 · Space 勾选/取消 (已选 ${selectedMap.size}/2) · Enter 开始对比 · q 退出`
        : `↑/↓ navigate · Space check/uncheck (${selectedMap.size}/2) · Enter compare · q quit`;
    }
    lines.push(`  ${hint}`);

    // Atomic flicker-free write
    let buf = '';
    if (lastRenderedLineCount > 0 && output.isTTY) {
      buf += `\x1b[${lastRenderedLineCount}A\r`;
    }
    for (const line of lines) {
      buf += `\x1b[2K${line}\n`;
    }
    if (lastRenderedLineCount > lines.length && output.isTTY) {
      buf += '\x1b[0J';
    }

    output.write(buf);
    lastRenderedLineCount = lines.length;
  };

  return new Promise((resolve) => {
    let cleanup = null;

    const finish = async (selectedList) => {
      if (isDone) return;
      isDone = true;
      if (cleanup) cleanup();

      if (output.isTTY && lastRenderedLineCount > 0) {
        output.write(`\x1b[${lastRenderedLineCount}A\r\x1b[0J`);
      }

      if (selectedList && selectedList.length === 2) {
        output.write(chalk.green(`\n✓ ${isZh ? '对比应用' : 'Comparing'}: ${chalk.bold(selectedList[0].name)}  vs  ${chalk.bold(selectedList[1].name)}\n\n`));
        try {
          if (typeof onCompare === 'function') {
            await onCompare(selectedList);
          }
        } finally {
          resolve(selectedList);
        }
      } else {
        output.write(chalk.dim(`\n${isZh ? '已退出。' : 'Exited.'}\n\n`));
        resolve(null);
      }
    };

    const toggleCurrent = () => {
      if (candidates.length === 0 || selectedIndex < 0 || selectedIndex >= candidates.length) return;
      const current = candidates[selectedIndex];
      if (selectedMap.has(current.path)) {
        selectedMap.delete(current.path);
      } else {
        if (selectedMap.size < 2) {
          selectedMap.set(current.path, current);
        }
      }
    };

    const handleKeypress = (str, key = {}) => {
      if (isDone) return;

      // Exit controls
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        finish(null);
        return;
      }
      if ((str === 'q' || str === 'Q') && !query) {
        finish(null);
        return;
      }

      // Up arrow
      if (key.name === 'up') {
        if (candidates.length > 0) {
          selectedIndex = (selectedIndex - 1 + candidates.length) % candidates.length;
        }
        render();
        return;
      }

      // Down arrow
      if (key.name === 'down') {
        if (candidates.length > 0) {
          selectedIndex = (selectedIndex + 1) % candidates.length;
        }
        render();
        return;
      }

      // PageUp / PageDown
      if (key.name === 'pageup') {
        selectedIndex = Math.max(0, selectedIndex - pageSize);
        render();
        return;
      }
      if (key.name === 'pagedown') {
        selectedIndex = Math.min(candidates.length - 1, selectedIndex + pageSize);
        render();
        return;
      }

      // Space: toggle checkbox
      if (key.name === 'space' || str === ' ') {
        toggleCurrent();
        render();
        return;
      }

      // Enter
      if (key.name === 'return' || key.name === 'enter') {
        if (selectedMap.size === 2) {
          finish([...selectedMap.values()]);
          return;
        }

        // If 1 selected and cursor is on an unselected app, auto-select it as the 2nd app and compare!
        if (selectedMap.size === 1 && candidates.length > 0) {
          const current = candidates[selectedIndex];
          if (!selectedMap.has(current.path)) {
            selectedMap.set(current.path, current);
            finish([...selectedMap.values()]);
            return;
          }
        }

        // If 0 selected and cursor on an app, select it
        if (selectedMap.size === 0 && candidates.length > 0) {
          toggleCurrent();
          render();
          return;
        }
        return;
      }

      // Backspace
      if (key.name === 'backspace') {
        if (query.length > 0) {
          query = query.slice(0, -1);
          candidates = findMatchingApps(appList, query, limit);
          selectedIndex = 0;
          scrollOffset = 0;
          render();
        }
        return;
      }

      // Regular character input
      if (str && str.length === 1 && !key.ctrl && !key.meta && str !== ' ') {
        query += str;
        candidates = findMatchingApps(appList, query, limit);
        selectedIndex = 0;
        scrollOffset = 0;
        render();
      }
    };

    // Non-TTY line fallback for tests
    const handleLine = (line) => {
      if (isDone) return;
      const str = line.trim();

      if (str.toLowerCase() === 'q' || str.toLowerCase() === 'exit') {
        finish(null);
        return;
      }

      // Space or number to toggle
      if (/^\d+$/.test(str)) {
        const choice = parseInt(str, 10);
        if (choice >= 1 && choice <= candidates.length) {
          const target = candidates[choice - 1];
          if (selectedMap.has(target.path)) {
            selectedMap.delete(target.path);
          } else if (selectedMap.size < 2) {
            selectedMap.set(target.path, target);
          }
        }
        render();
        return;
      }

      if (str === 'enter' || str === 'compare' || str === '') {
        if (selectedMap.size === 2) {
          finish([...selectedMap.values()]);
          return;
        }
      }

      query = str;
      candidates = findMatchingApps(appList, query, limit);
      selectedIndex = 0;
      scrollOffset = 0;
      render();
    };

    cleanup = setupInputListener(input, output, handleKeypress, handleLine);
    render();
  });
}
