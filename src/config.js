import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_CONFIG = {
  cache: true,
  excludeApps: [],
};

export function getConfigPath() {
  if (process.env.BUILDBY_CONFIG) return process.env.BUILDBY_CONFIG;

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), '.buildby', 'config.json');
  }

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'buildby', 'config.json');
  }

  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'buildby', 'config.json');
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

export function loadConfig() {
  const configPath = getConfigPath();
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
