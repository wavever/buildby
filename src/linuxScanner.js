import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from './config.js';
import { LOCALE } from './i18n.js';

/**
 * Standard Linux desktop application directories in priority order:
 * user directories take precedence over system directories.
 */
export const DEFAULT_LINUX_APP_DIRS = [
  path.join(os.homedir(), '.local/share/applications'),
  path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
  '/usr/local/share/applications',
  '/usr/share/applications',
  '/var/lib/flatpak/exports/share/applications',
  '/var/lib/snapd/desktop/applications',
];

/**
 * Standard executable directories used to resolve bare command names on Linux.
 */
export const STANDARD_BIN_DIRS = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/local/sbin',
  '/usr/sbin',
  '/sbin',
  '/snap/bin',
  path.join(os.homedir(), '.local/bin'),
  path.join(os.homedir(), 'bin'),
];

/**
 * Get all candidate Linux application directories.
 * Honors XDG_DATA_HOME and XDG_DATA_DIRS if set.
 *
 * @param {{ customDirs?: string[], checkExists?: boolean }} [options]
 * @returns {string[]}
 */
export function getLinuxAppDirectories({ customDirs, checkExists = true } = {}) {
  if (customDirs && Array.isArray(customDirs)) {
    return checkExists
      ? customDirs.filter((d) => {
          try {
            return fs.existsSync(d);
          } catch {
            return false;
          }
        })
      : customDirs;
  }

  const dirs = [];

  // XDG_DATA_HOME overrides ~/.local/share
  if (process.env.XDG_DATA_HOME) {
    dirs.push(path.join(process.env.XDG_DATA_HOME, 'applications'));
  }

  // Include defaults
  dirs.push(...DEFAULT_LINUX_APP_DIRS);

  // XDG_DATA_DIRS overrides /usr/local/share:/usr/share
  if (process.env.XDG_DATA_DIRS) {
    for (const d of process.env.XDG_DATA_DIRS.split(':')) {
      if (d) dirs.push(path.join(d, 'applications'));
    }
  }

  const unique = [...new Set(dirs)];
  if (!checkExists) return unique;

  return unique.filter((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
}

/**
 * Strip field codes (%u, %U, %f, %F, %i, %c, %k, %v, etc.) and quoting
 * artifacts from an Exec command line string.
 * Preserves literal %% as %.
 *
 * @param {string} execStr
 * @returns {string}
 */
export function stripFieldCodes(execStr) {
  if (!execStr || typeof execStr !== 'string') return '';

  // Preserve literal %% with placeholder
  let result = execStr.replace(/%%/g, '\0PERCENT\0');

  // Strip Flatpak URL forwarding syntax (e.g. @@u %u @@ or @@ %F @@)
  result = result.replace(/@@[a-zA-Z0-9]*\b/g, '').replace(/@@/g, '');

  // Strip quoted field codes like "%u", "%U", "%f", "%F", "%i", "%c", "%k"
  result = result.replace(/["']%[fFuUdDnNickvm]["']/g, '');

  // Strip unquoted field codes like %u, %U, %f, %F, %i, %c, %k
  result = result.replace(/%[fFuUdDnNickvm]\b/g, '');

  // Restore literal %
  result = result.replace(/\0PERCENT\0/g, '%');

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a token is a Desktop Entry field code or argument marker.
 * @param {string} tok
 * @returns {boolean}
 */
function isFieldCodeToken(tok) {
  if (!tok) return false;
  return (
    /^%[fFuUdDnNickvm%]$/.test(tok) ||
    tok === '@@' ||
    /^@@[a-zA-Z0-9]*$/.test(tok)
  );
}

/**
 * Tokenize an Exec command line respecting quotes (single/double) and escapes.
 *
 * @param {string} execStr
 * @returns {string[]}
 */
export function tokenizeExec(execStr) {
  if (!execStr || typeof execStr !== 'string') return [];

  const tokens = [];
  let current = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escaping = false;

  for (let i = 0; i < execStr.length; i++) {
    const ch = execStr[i];

    if (escaping) {
      if (ch === 's') {
        current += ' ';
      } else if (ch === 'n') {
        current += '\n';
      } else if (ch === 't') {
        current += '\t';
      } else if (ch === 'r') {
        current += '\r';
      } else {
        current += ch;
      }
      escaping = false;
      continue;
    }

    if (ch === '\\' && !inSingleQuote) {
      escaping = true;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (/\s/.test(ch) && !inDoubleQuote && !inSingleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Extract the primary executable command from tokenized Exec arguments,
 * unwrapping standard wrappers like `env` or `sh -c`.
 *
 * @param {string[]} tokens
 * @returns {string | null}
 */
export function extractCommandFromTokens(tokens) {
  if (!tokens || tokens.length === 0) return null;

  const filtered = tokens.filter((tok) => !isFieldCodeToken(tok));
  if (filtered.length === 0) return null;

  const first = filtered[0];

  // Case 1: env wrapper, e.g. `env FOO=1 GDK_BACKEND=x11 /usr/bin/app`
  if (first === 'env' || first.endsWith('/env')) {
    let idx = 1;
    while (idx < filtered.length) {
      const tok = filtered[idx];
      // Skip flags like -u VAR or -i
      if (tok.startsWith('-')) {
        if (tok === '-u' || tok === '--unset') {
          idx += 2;
          continue;
        }
        idx++;
        continue;
      }
      // Skip environment assignments like KEY=value
      if (tok.includes('=')) {
        idx++;
        continue;
      }
      return tok;
    }
    return null;
  }

  // Case 2: shell wrapper: `sh -c "exec /opt/app/bin/app ..."`
  if (
    (first === 'sh' || first === 'bash' || first.endsWith('/sh') || first.endsWith('/bash')) &&
    filtered[1] === '-c' &&
    filtered[2]
  ) {
    const subTokens = tokenizeExec(filtered[2]);
    const subFiltered = subTokens.filter((tok) => tok !== 'exec' && !isFieldCodeToken(tok));
    if (subFiltered.length > 0) {
      return extractCommandFromTokens(subFiltered);
    }
  }

  return first;
}

/**
 * Resolve an executable command or relative binary name to an absolute file path.
 *
 * @param {string} command - Path or command name
 * @param {object} [options]
 * @param {string} [options.pathEnv] - Custom PATH variable string
 * @param {string[]} [options.searchDirs] - Additional directories to search
 * @param {string} [options.cwd] - Current working directory for relative paths
 * @param {boolean} [options.checkExists] - Whether to verify file existence (default true)
 * @returns {string | null} Absolute executable path, or null if not found/unresolvable
 */
export function resolveExecutablePath(command, options = {}) {
  if (!command || typeof command !== 'string') return null;

  const {
    pathEnv,
    searchDirs = [],
    cwd = process.cwd(),
    checkExists = true,
  } = options;

  const trimmed = command.trim();
  if (!trimmed) return null;

  const isExecutableFile = (filePath) => {
    if (!checkExists) return true;
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  };

  // Absolute path: check directly
  if (path.isAbsolute(trimmed)) {
    if (isExecutableFile(trimmed)) return trimmed;
    return checkExists ? null : trimmed;
  }

  // Relative path with separator: e.g. ./bin/app or sub/app
  if (trimmed.includes(path.sep) || trimmed.includes('/')) {
    const resolved = path.resolve(cwd, trimmed);
    if (isExecutableFile(resolved)) return resolved;
    return checkExists ? null : resolved;
  }

  // Bare command name: search in searchDirs, PATH, and STANDARD_BIN_DIRS
  const dirs = [];
  if (searchDirs && Array.isArray(searchDirs)) {
    dirs.push(...searchDirs);
  }

  const envPathStr = pathEnv !== undefined ? pathEnv : process.env.PATH;
  if (envPathStr) {
    dirs.push(...envPathStr.split(':').filter(Boolean));
  }

  dirs.push(...STANDARD_BIN_DIRS);

  const uniqueDirs = [...new Set(dirs)];
  for (const dir of uniqueDirs) {
    const candidate = path.join(dir, trimmed);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return checkExists ? null : path.join(uniqueDirs[0] || '/usr/bin', trimmed);
}

/**
 * Match the most suitable localized string from a map of localized entries.
 *
 * @param {Record<string, string>} map - e.g. { 'zh_CN': '...', 'zh': '...' }
 * @param {string} [locale] - requested locale, e.g. 'zh_CN' or 'zh'
 * @returns {string | null}
 */
function resolveLocalizedValue(map, locale) {
  if (!map || Object.keys(map).length === 0) return null;

  const targetLocale =
    locale ||
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    process.env.LANG ||
    (LOCALE === 'zh' ? 'zh_CN' : 'en');

  // Direct match: e.g. zh_CN
  const clean = targetLocale.split('.')[0].replace('@', '_');
  if (map[clean]) return map[clean];

  // Try underscore variation: zh-CN -> zh_CN
  const underscore = clean.replace('-', '_');
  if (map[underscore]) return map[underscore];

  // Language only: zh
  const lang = clean.split('_')[0];
  if (map[lang]) return map[lang];

  // If locale starts with zh, try common Chinese variants
  if (lang === 'zh') {
    if (map['zh_CN']) return map['zh_CN'];
    if (map['zh_TW']) return map['zh_TW'];
    if (map['zh_HK']) return map['zh_HK'];
  }

  // Any key prefix match
  for (const k of Object.keys(map)) {
    if (k.toLowerCase().startsWith(lang.toLowerCase())) {
      return map[k];
    }
  }

  return null;
}

/**
 * Parse `.desktop` file content (or a file path on disk) following the XDG Desktop Entry Specification.
 *
 * @param {string} contentOrPath - File contents or absolute path to a .desktop file
 * @param {{ locale?: string }} [options]
 * @returns {{
 *   type: string,
 *   name: string,
 *   localizedName: string | null,
 *   localizedNames: Record<string, string>,
 *   exec: string,
 *   tryExec: string | null,
 *   icon: string | null,
 *   categories: string[],
 *   comment: string,
 *   noDisplay: boolean,
 *   hidden: boolean,
 *   terminal: boolean,
 *   startupWMClass: string | null,
 *   rawEntries: Record<string, string>,
 * } | null}
 */
export function parseDesktopFile(contentOrPath, options = {}) {
  if (!contentOrPath || typeof contentOrPath !== 'string') return null;

  let content = contentOrPath;
  if (!contentOrPath.includes('\n') && !contentOrPath.includes('[Desktop Entry]')) {
    try {
      if (fs.existsSync(contentOrPath)) {
        content = fs.readFileSync(contentOrPath, 'utf8');
      }
    } catch {
      return null;
    }
  }

  return parseDesktopContent(content, options);
}

/**
 * Parse the raw content string of a `.desktop` file.
 *
 * @param {string} content
 * @param {{ locale?: string }} [options]
 * @returns {object | null}
 */
export function parseDesktopContent(content, options = {}) {
  if (!content || typeof content !== 'string') return null;

  const lines = content.split(/\r?\n/);
  let inDesktopEntry = false;
  const entries = {};
  const localizedNames = {};
  const localizedComments = {};

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // Detect section header: only process [Desktop Entry]
    if (line.startsWith('[') && line.endsWith(']')) {
      const section = line.slice(1, -1).trim();
      inDesktopEntry = section === 'Desktop Entry';
      continue;
    }

    if (!inDesktopEntry) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();

    entries[key] = val;

    const matchName = key.match(/^Name\[([^\]]+)\]$/);
    if (matchName) {
      localizedNames[matchName[1]] = val;
    }
    const matchComment = key.match(/^Comment\[([^\]]+)\]$/);
    if (matchComment) {
      localizedComments[matchComment[1]] = val;
    }
  }

  const type = entries['Type'] || '';
  const noDisplay = /^(true|1)$/i.test(entries['NoDisplay'] || '');
  const hidden = /^(true|1)$/i.test(entries['Hidden'] || '');
  const terminal = /^(true|1)$/i.test(entries['Terminal'] || '');

  const baseName = entries['Name'] || '';
  const localizedName = resolveLocalizedValue(localizedNames, options.locale);

  const categories = entries['Categories']
    ? entries['Categories'].split(';').map((c) => c.trim()).filter(Boolean)
    : [];

  return {
    type,
    name: baseName,
    localizedName,
    localizedNames,
    exec: entries['Exec'] || '',
    tryExec: entries['TryExec'] || null,
    icon: entries['Icon'] || null,
    categories,
    comment: entries['Comment'] || '',
    localizedComments,
    noDisplay,
    hidden,
    terminal,
    startupWMClass: entries['StartupWMClass'] || null,
    rawEntries: entries,
  };
}

/**
 * Validate whether a parsed desktop entry represents a runnable desktop application.
 *
 * @param {object} parsed
 * @returns {boolean}
 */
export function isValidDesktopApp(parsed) {
  if (!parsed) return false;
  if (parsed.type?.toLowerCase() !== 'application') return false;
  if (parsed.noDisplay || parsed.hidden) return false;
  if (!parsed.exec) return false;
  if (!parsed.name && !parsed.localizedName) return false;
  return true;
}

function normalizeMatchValue(value) {
  return value.toLowerCase().replace(/\.(app|desktop)$/i, '').trim();
}

/**
 * Check whether a Linux application matches any entry in excludeApps.
 *
 * @param {object} app
 * @param {string[]} excludeApps
 * @returns {boolean}
 */
export function isExcludedLinuxApp(app, excludeApps = []) {
  if (!excludeApps || excludeApps.length === 0) return false;

  const candidates = [
    app.name,
    app.localizedName,
    path.basename(app.path),
    app.path,
    app.desktopFile ? path.basename(app.desktopFile) : '',
    app.desktopFile ? path.basename(app.desktopFile, '.desktop') : '',
    app.desktopFile,
  ]
    .filter(Boolean)
    .map(normalizeMatchValue);

  return excludeApps.some((entry) => {
    const normalizedEntry = normalizeMatchValue(entry);
    return candidates.some((candidate) => candidate === normalizedEntry);
  });
}

/**
 * Scan all Linux desktop application directories and return discovered apps.
 *
 * @param {object} [options]
 * @param {string[]} [options.dirs] - Custom directories to scan
 * @param {boolean} [options.applyExclusions] - Whether to apply excludeApps from config
 * @param {string} [options.locale] - Target locale for localized name extraction
 * @param {string} [options.pathEnv] - Custom PATH variable for executable resolution
 * @param {string[]} [options.searchDirs] - Additional directories for executable resolution
 * @returns {{
 *   name: string,
 *   path: string,
 *   desktopFile: string,
 *   platform: 'linux',
 *   icon: string,
 *   categories: string[],
 *   comment: string,
 *   localizedName?: string | null,
 * }[]}
 */
export function scanLinuxApps({
  dirs,
  applyExclusions = true,
  locale,
  pathEnv,
  searchDirs,
} = {}) {
  const targetDirs = dirs && Array.isArray(dirs)
    ? dirs.filter((d) => {
        try {
          return fs.existsSync(d);
        } catch {
          return false;
        }
      })
    : getLinuxAppDirectories();

  const { excludeApps } = applyExclusions ? loadConfig() : { excludeApps: [] };
  const apps = [];
  const seenDesktopFiles = new Set();
  const seenAppPaths = new Set();

  for (const dir of targetDirs) {
    let fileNames = [];
    try {
      fileNames = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const fileName of fileNames) {
      if (!fileName.endsWith('.desktop')) continue;

      // Higher-priority directories (user dirs) override lower-priority (system dirs)
      if (seenDesktopFiles.has(fileName)) continue;
      seenDesktopFiles.add(fileName);

      const desktopFilePath = path.join(dir, fileName);
      let content = '';
      try {
        content = fs.readFileSync(desktopFilePath, 'utf8');
      } catch {
        continue;
      }

      const parsed = parseDesktopContent(content, { locale });
      if (!isValidDesktopApp(parsed)) continue;

      // Check TryExec if present
      if (parsed.tryExec) {
        const tryExecPath = resolveExecutablePath(parsed.tryExec, { pathEnv, searchDirs });
        if (!tryExecPath) continue;
      }

      // Extract command and resolve executable path
      const tokens = tokenizeExec(parsed.exec);
      const command = extractCommandFromTokens(tokens);
      if (!command) continue;

      let execPath = resolveExecutablePath(command, { pathEnv, searchDirs });

      // Fallback for unquoted paths with spaces
      if (!execPath && tokens.length > 1) {
        const nonOptionTokens = [];
        for (const tok of tokens) {
          if (tok.startsWith('-') || isFieldCodeToken(tok)) break;
          nonOptionTokens.push(tok);
          const joined = nonOptionTokens.join(' ');
          const maybePath = resolveExecutablePath(joined, { pathEnv, searchDirs });
          if (maybePath) {
            execPath = maybePath;
            break;
          }
        }
      }

      // Verify executable existence
      if (!execPath) continue;

      // Deduplicate by executable path
      if (seenAppPaths.has(execPath)) continue;
      seenAppPaths.add(execPath);

      const app = {
        name: (parsed.name || parsed.localizedName || '').trim(),
        path: execPath,
        desktopFile: desktopFilePath,
        platform: 'linux',
        icon: parsed.icon || '',
        categories: parsed.categories || [],
        comment: parsed.comment || '',
      };

      if (parsed.localizedName) {
        app.localizedName = parsed.localizedName;
      }

      if (applyExclusions && isExcludedLinuxApp(app, excludeApps)) {
        continue;
      }

      apps.push(app);
    }
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Find Linux desktop applications matching query (case-insensitive fuzzy match).
 *
 * @param {string} query
 * @param {object} [options]
 * @returns {{ name: string, path: string, desktopFile: string, platform: 'linux' }[]}
 */
export function findLinuxAppsByName(query, options = {}) {
  if (!query || typeof query !== 'string') return [];

  const all = scanLinuxApps({ applyExclusions: false, ...options });
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase().replace(/\s+/g, '');

  if (!lower) return [];

  // 1. Exact match first
  const exact = all.filter((app) => {
    const desktopBase = app.desktopFile ? path.basename(app.desktopFile, '.desktop') : '';
    const binaryBase = path.basename(app.path);
    return (
      app.name.toLowerCase() === trimmed.toLowerCase() ||
      (app.localizedName && app.localizedName.toLowerCase() === trimmed.toLowerCase()) ||
      desktopBase.toLowerCase() === trimmed.toLowerCase() ||
      binaryBase.toLowerCase() === trimmed.toLowerCase()
    );
  });

  if (exact.length > 0) return exact;

  // 2. Fuzzy match
  return all.filter((app) => {
    const desktopBase = app.desktopFile ? path.basename(app.desktopFile, '.desktop') : '';
    const binaryBase = path.basename(app.path);
    const candidates = [
      app.name,
      app.localizedName,
      desktopBase,
      binaryBase,
    ]
      .filter(Boolean)
      .map((str) => str.toLowerCase().replace(/\s+/g, ''));

    return candidates.some((candidate) => {
      return (
        candidate.includes(lower) ||
        lower.includes(candidate) ||
        levenshtein(candidate, lower) <= 2
      );
    });
  });
}

/**
 * Check if a directory is structured like an application directory (e.g. AppDir or portable app).
 *
 * @param {string} dirPath
 * @returns {boolean}
 */
export function isLinuxAppDirectory(dirPath) {
  if (!dirPath || typeof dirPath !== 'string') return false;

  try {
    if (!fs.statSync(dirPath).isDirectory()) return false;

    // AppDir layout: AppRun executable
    if (fs.existsSync(path.join(dirPath, 'AppRun'))) return true;

    // Contains any .desktop file
    const entries = fs.readdirSync(dirPath);
    if (entries.some((e) => e.endsWith('.desktop'))) return true;

    // Contains binary matching the directory name
    const dirName = path.basename(dirPath);
    if (entries.includes(dirName)) {
      const full = path.join(dirPath, dirName);
      if (fs.statSync(full).isFile()) return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Search desktop application directories to find which .desktop file points to an executable.
 *
 * @param {string} executablePath
 * @param {object} [options]
 * @returns {string | null}
 */
export function findDesktopFileForExecutable(executablePath, options = {}) {
  if (!executablePath || typeof executablePath !== 'string') return null;

  const targetDirs = options.dirs || getLinuxAppDirectories(options);
  const normalizedTarget = path.resolve(executablePath);

  for (const dir of targetDirs) {
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.desktop')) continue;
      const fullPath = path.join(dir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseDesktopContent(content);
        if (!parsed || !parsed.exec) continue;

        const tokens = tokenizeExec(parsed.exec);
        const command = extractCommandFromTokens(tokens);
        if (!command) continue;

        const resolved = resolveExecutablePath(command, options);
        if (resolved && path.resolve(resolved) === normalizedTarget) {
          return fullPath;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Probe an application directory (such as an AppDir, unpacked portable app, or /opt directory).
 *
 * @param {string} dirPath
 * @param {object} [options]
 * @returns {{
 *   name: string,
 *   path: string,
 *   desktopFile: string | null,
 *   appDir: string,
 *   platform: 'linux',
 *   icon?: string,
 *   categories?: string[],
 *   comment?: string,
 * } | null}
 */
export function probeLinuxAppDirectory(dirPath, options = {}) {
  if (!dirPath || typeof dirPath !== 'string') return null;

  const resolvedDir = path.resolve(dirPath);
  try {
    if (!fs.statSync(resolvedDir).isDirectory()) return null;
  } catch {
    return null;
  }

  const dirName = path.basename(resolvedDir);
  let files = [];
  try {
    files = fs.readdirSync(resolvedDir);
  } catch {
    files = [];
  }

  // 1. Check for .desktop file inside directory
  const desktopFileName = files.find((f) => f.endsWith('.desktop'));
  let desktopPath = desktopFileName ? path.join(resolvedDir, desktopFileName) : null;
  let parsed = null;
  if (desktopPath) {
    try {
      parsed = parseDesktopFile(desktopPath, options);
    } catch {
      parsed = null;
    }
  }

  // 2. Check for AppRun (standard AppDir entry point)
  const appRunPath = path.join(resolvedDir, 'AppRun');
  if (fs.existsSync(appRunPath)) {
    return {
      name: parsed?.name || dirName,
      path: appRunPath,
      desktopFile: desktopPath,
      appDir: resolvedDir,
      platform: 'linux',
      icon: parsed?.icon || '',
      categories: parsed?.categories || [],
      comment: parsed?.comment || '',
      localizedName: parsed?.localizedName || null,
    };
  }

  // 3. If .desktop file exists and specifies an Exec path inside the directory
  if (parsed && parsed.exec) {
    const tokens = tokenizeExec(parsed.exec);
    const command = extractCommandFromTokens(tokens);
    if (command) {
      const candidateInDir = path.resolve(resolvedDir, command);
      if (fs.existsSync(candidateInDir) && fs.statSync(candidateInDir).isFile()) {
        return {
          name: parsed.name || dirName,
          path: candidateInDir,
          desktopFile: desktopPath,
          appDir: resolvedDir,
          platform: 'linux',
          icon: parsed.icon || '',
          categories: parsed.categories || [],
          comment: parsed.comment || '',
          localizedName: parsed.localizedName || null,
        };
      }
    }
  }

  // 4. Check for binary matching directory name (e.g. dir/foo or dir/bin/foo)
  const candidateSelf = path.join(resolvedDir, dirName);
  try {
    if (fs.existsSync(candidateSelf) && fs.statSync(candidateSelf).isFile()) {
      return {
        name: parsed?.name || dirName,
        path: candidateSelf,
        desktopFile: desktopPath,
        appDir: resolvedDir,
        platform: 'linux',
        icon: parsed?.icon || '',
        categories: parsed?.categories || [],
        comment: parsed?.comment || '',
        localizedName: parsed?.localizedName || null,
      };
    }
  } catch {
    // continue
  }

  const candidateBin = path.join(resolvedDir, 'bin', dirName);
  try {
    if (fs.existsSync(candidateBin) && fs.statSync(candidateBin).isFile()) {
      return {
        name: parsed?.name || dirName,
        path: candidateBin,
        desktopFile: desktopPath,
        appDir: resolvedDir,
        platform: 'linux',
        icon: parsed?.icon || '',
        categories: parsed?.categories || [],
        comment: parsed?.comment || '',
        localizedName: parsed?.localizedName || null,
      };
    }
  } catch {
    // continue
  }

  // 5. Fallback: return the directory itself so detectors can inspect internal files
  return {
    name: parsed?.name || dirName,
    path: resolvedDir,
    desktopFile: desktopPath,
    appDir: resolvedDir,
    platform: 'linux',
    icon: parsed?.icon || '',
    categories: parsed?.categories || [],
    comment: parsed?.comment || '',
    localizedName: parsed?.localizedName || null,
  };
}

/**
 * Probe a single Linux executable binary file.
 *
 * @param {string} binaryPath
 * @param {object} [options]
 * @returns {{
 *   name: string,
 *   path: string,
 *   desktopFile: string | null,
 *   platform: 'linux',
 *   icon?: string,
 *   categories?: string[],
 *   comment?: string,
 * } | null}
 */
export function probeLinuxBinary(binaryPath, options = {}) {
  if (!binaryPath || typeof binaryPath !== 'string') return null;

  const resolved = path.resolve(binaryPath);
  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  } catch {
    return null;
  }

  const binaryName = path.basename(resolved);
  const desktopFile = findDesktopFileForExecutable(resolved, options);

  if (desktopFile) {
    try {
      const parsed = parseDesktopFile(desktopFile, options);
      if (parsed) {
        return {
          name: parsed.name || binaryName,
          path: resolved,
          desktopFile,
          platform: 'linux',
          icon: parsed.icon || '',
          categories: parsed.categories || [],
          comment: parsed.comment || '',
          localizedName: parsed.localizedName || null,
        };
      }
    } catch {
      // continue to fallback
    }
  }

  return {
    name: binaryName,
    path: resolved,
    desktopFile: null,
    platform: 'linux',
    icon: '',
    categories: [],
    comment: '',
    localizedName: null,
  };
}

/**
 * Probe any Linux application target (directory, .desktop file, or binary).
 *
 * @param {string} targetPath
 * @param {object} [options]
 * @returns {object | null}
 */
export function probeLinuxApp(targetPath, options = {}) {
  if (!targetPath || typeof targetPath !== 'string') return null;

  const resolved = path.resolve(targetPath);
  try {
    if (!fs.existsSync(resolved)) return null;

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return probeLinuxAppDirectory(resolved, options);
    }

    if (stat.isFile()) {
      if (resolved.endsWith('.desktop')) {
        const parsed = parseDesktopFile(resolved, options);
        if (!isValidDesktopApp(parsed)) return null;

        const tokens = tokenizeExec(parsed.exec);
        const command = extractCommandFromTokens(tokens);
        const execPath = command ? resolveExecutablePath(command, options) : null;
        if (!execPath) return null;

        return {
          name: (parsed.name || parsed.localizedName || '').trim(),
          path: execPath,
          desktopFile: resolved,
          platform: 'linux',
          icon: parsed.icon || '',
          categories: parsed.categories || [],
          comment: parsed.comment || '',
          localizedName: parsed.localizedName || null,
        };
      }

      return probeLinuxBinary(resolved, options);
    }
  } catch {
    return null;
  }

  return null;
}
