import fs from 'fs';
import path from 'path';
import { listDir } from './shared.js';

export const meta = {
  id: 'python',
  name: 'Python',
  category: 'cross-platform',
  color: 'blue',
  description: 'Python apps bundled with py2app, PyInstaller, Nuitka or a vendored CPython',
  website: 'https://www.python.org',
};

/**
 * Identify the GUI toolkit a Python app draws with, so the single stack label
 * can still carry both layers (e.g. "Python (PyQt)").
 */
function detectUiToolkit(appPath, platform) {
  const dirs = platform === 'darwin'
    ? [path.join(appPath, 'Contents', 'Frameworks'), path.join(appPath, 'Contents', 'Resources')]
    : [appPath, path.join(appPath, '_internal')];

  for (const dir of dirs) {
    const items = listDir(dir);
    if (items.some((i) => /^(Qt|libQt|PyQt|PySide)/i.test(i))) return 'PyQt';
    if (items.some((i) => /^libgtk-[34]/.test(i))) return 'PyGObject';
    if (items.some((i) => /^(libwx|wx\.)/i.test(i))) return 'wxPython';
    if (items.some((i) => /^(libtk|libtcl|_tkinter)/i.test(i))) return 'Tkinter';
    if (items.some((i) => /^kivy/i.test(i))) return 'Kivy';
  }

  return null;
}

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const contentsDir = path.join(appPath, 'Contents');
    const frameworksDir = path.join(contentsDir, 'Frameworks');
    const resourcesDir = path.join(contentsDir, 'Resources');
    const macosDir = path.join(contentsDir, 'MacOS');

    // py2app stub loader
    if (fs.existsSync(path.join(resourcesDir, '__boot__.py'))) {
      evidence.push('__boot__.py (py2app)');
    }

    // PyInstaller frozen stdlib archive — onedir layouts moved it into
    // _internal/ in PyInstaller 6.
    for (const dir of [macosDir, frameworksDir, resourcesDir, path.join(macosDir, '_internal')]) {
      if (fs.existsSync(path.join(dir, 'base_library.zip'))) {
        evidence.push('base_library.zip (PyInstaller)');
        break;
      }
    }

    // Vendored CPython
    if (fs.existsSync(path.join(frameworksDir, 'Python.framework'))) {
      evidence.push('Python.framework');
    }
    const pyDylib = listDir(frameworksDir).find((i) => /^libpython3\.\d+/.test(i));
    if (pyDylib) evidence.push(pyDylib);

    // Bundled standard library
    if (fs.existsSync(path.join(resourcesDir, 'Python', 'lib'))) {
      evidence.push('Resources/Python/lib (bundled stdlib)');
    }
    const resourceLib = listDir(path.join(resourcesDir, 'lib')).find((i) => /^python3\.\d+$/.test(i));
    if (resourceLib) evidence.push(`Resources/lib/${resourceLib}`);
  } else if (platform === 'win32') {
    const internalDir = path.join(appPath, '_internal');

    const pyDll = listDir(appPath).find((i) => /^python3\d*\.dll$/i.test(i))
      || listDir(internalDir).find((i) => /^python3\d*\.dll$/i.test(i));
    if (pyDll) evidence.push(pyDll);

    for (const dir of [appPath, internalDir]) {
      if (fs.existsSync(path.join(dir, 'base_library.zip'))) {
        evidence.push('base_library.zip (PyInstaller)');
        break;
      }
    }

    if (fs.existsSync(path.join(appPath, 'pythonw.exe'))) {
      evidence.push('pythonw.exe');
    }
    if (fs.existsSync(path.join(appPath, 'Lib', 'site-packages'))) {
      evidence.push('Lib/site-packages');
    }
  }

  if (evidence.length === 0) return null;

  const toolkit = detectUiToolkit(appPath, platform);
  if (toolkit) evidence.push(`${toolkit} UI toolkit`);

  return {
    ...meta,
    name: toolkit ? `Python (${toolkit})` : meta.name,
    // Structured alongside the display name so machine-readable output does
    // not have to parse the parenthetical back out.
    variant: toolkit,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
