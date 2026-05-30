import { execFileSync } from 'child_process';

const commandCache = new Map();

/**
 * Run a command once per unique argv and cache its stdout.
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').ExecFileSyncOptions} [options]
 * @returns {string}
 */
export function execCached(command, args, options = {}) {
  const key = JSON.stringify([command, args]);
  if (commandCache.has(key)) return commandCache.get(key);

  let output = '';
  try {
    output = execFileSync(command, args, options).toString();
  } catch {
    output = '';
  }

  commandCache.set(key, output);
  return output;
}
