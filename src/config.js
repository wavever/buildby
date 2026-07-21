import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_CONFIG = {
  cache: true,
  excludeApps: [],
};

const CONFIG_DIR_NAME = 'buildby';
const CONFIG_FILE_NAME = 'config.json';

function getXdgConfigPath() {
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    CONFIG_DIR_NAME,
    CONFIG_FILE_NAME,
  );
}

function getLegacyConfigPath() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), '.buildby', CONFIG_FILE_NAME);
  }

  return null;
}

export function getConfigPath() {
  if (process.env.BUILDBY_CONFIG) return process.env.BUILDBY_CONFIG;

  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      CONFIG_DIR_NAME,
      CONFIG_FILE_NAME,
    );
  }

  return getXdgConfigPath();
}

function createDefaultConfigIfMissing(configPath) {
  if (fs.existsSync(configPath)) return;

  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  } catch {
    // Config creation is best-effort; commands should still run with defaults.
  }
}

function migrateLegacyConfigIfNeeded(configPath) {
  if (process.env.BUILDBY_CONFIG || fs.existsSync(configPath)) return configPath;

  const legacyConfigPath = getLegacyConfigPath();
  if (!legacyConfigPath || !fs.existsSync(legacyConfigPath)) return configPath;

  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.copyFileSync(legacyConfigPath, configPath);
    return configPath;
  } catch {
    // Keep existing users' settings available even when migration is blocked.
    return legacyConfigPath;
  }
}

export function loadConfig() {
  const configPath = migrateLegacyConfigIfNeeded(getConfigPath());
  createDefaultConfigIfMissing(configPath);

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      cache: parsed.cache !== false,
      excludeApps: Array.isArray(parsed.excludeApps)
        ? parsed.excludeApps.filter((item) => typeof item === 'string' && item.trim())
        : [],
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
