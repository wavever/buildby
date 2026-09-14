import fs from 'fs';
import path from 'path';
import { listDir, listFrameworksDeep } from './shared.js';

export const meta = {
  id: 'gtk',
  name: 'GTK',
  category: 'cross-platform',
  color: 'green',
  description: 'GNOME cross-platform widget toolkit (GIMP, Inkscape, Pidgin, etc.)',
  website: 'https://www.gtk.org',
};

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');
    const resourcesDir = path.join(appPath, 'Contents', 'Resources');

    // GTK ships as plain dylibs; some bundles nest them under Resources/lib.
    const names = listFrameworksDeep(frameworksDir)
      .map((entry) => entry.name)
      .concat(listDir(path.join(resourcesDir, 'lib')));

    const gtkLib = names.find((n) => /^libgtk-[34]\./.test(n));
    if (gtkLib) evidence.push(gtkLib);

    const gdkLib = names.find((n) => /^libgdk-[34]\./.test(n));
    if (gdkLib) evidence.push(gdkLib);

    // GLib alone is not GTK (many non-GUI projects link it), so it only
    // reinforces an existing GTK hit.
    if (evidence.length > 0) {
      const glib = names.find((n) => /^libglib-2\.0\./.test(n));
      if (glib) evidence.push(glib);
    }

    // GTK's compiled resource/theme payload
    if (evidence.length > 0 && fs.existsSync(path.join(resourcesDir, 'share', 'glib-2.0', 'schemas'))) {
      evidence.push('share/glib-2.0/schemas');
    }
  } else if (platform === 'win32') {
    const names = listDir(appPath).concat(listDir(path.join(appPath, 'bin')));

    const gtkDll = names.find((n) => /^libgtk-[34]-\d+\.dll$/i.test(n));
    if (gtkDll) evidence.push(gtkDll);

    const gdkDll = names.find((n) => /^libgdk-[34]-\d+\.dll$/i.test(n));
    if (gdkDll) evidence.push(gdkDll);

    if (evidence.length > 0) {
      const glibDll = names.find((n) => /^libglib-2\.0-\d+\.dll$/i.test(n));
      if (glibDll) evidence.push(glibDll);
    }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
