import fs from 'fs';
import path from 'path';
import { listFrameworksDeep } from './shared.js';

export const meta = {
  id: 'qt',
  name: 'Qt',
  category: 'cross-platform',
  color: 'green',
  description: 'C++ cross-platform framework with native look and feel',
  website: 'https://www.qt.io',
};

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const frameworksDir = path.join(appPath, 'Contents', 'Frameworks');

    // Qt frameworks on macOS are bundled as .framework
    const qtFrameworks = [
      'QtCore.framework',
      'QtWidgets.framework',
      'QtGui.framework',
      'QtNetwork.framework',
      'QtQml.framework',
      'QtQuick.framework',
      'Qt5Core.framework',
      'Qt6Core.framework',
    ];

    // Scan one level deep: vendors sometimes group Qt in a subdirectory
    // (WPS Office ships QtCoreKso.framework under Frameworks/office6/).
    const items = listFrameworksDeep(frameworksDir).map((entry) => entry.name);

    // Qt frameworks (e.g. QtCore.framework, Qt6Core.framework, QtCoreKso.framework)
    for (const item of items) {
      if (item.startsWith('Qt') && item.endsWith('.framework')) {
        evidence.push(item);
        if (evidence.length >= 3) break;
      }
    }

    // Some Qt apps ship Qt as dylib instead of framework
    if (evidence.length === 0) {
      const qtLibs = items.filter((item) => item.startsWith('libQt') && item.endsWith('.dylib'));
      if (qtLibs.length > 0) {
        evidence.push(...qtLibs.slice(0, 2));
      }
    }

    if (fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'qt.conf'))) {
      evidence.push('qt.conf');
    }
  } else if (platform === 'win32') {
    const qtDlls = [
      'Qt5Core.dll',
      'Qt6Core.dll',
      'Qt5Widgets.dll',
      'Qt6Widgets.dll',
      'Qt5Gui.dll',
      'Qt6Gui.dll',
    ];

    for (const dll of qtDlls) {
      if (fs.existsSync(path.join(appPath, dll))) {
        evidence.push(dll);
        if (evidence.length >= 3) break;
      }
    }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
