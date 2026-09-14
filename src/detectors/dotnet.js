import fs from 'fs';
import path from 'path';

export const meta = {
  id: 'dotnet',
  name: '.NET / MAUI / WPF',
  category: 'cross-platform',
  color: 'magenta',
  description: 'Microsoft .NET framework apps (WPF, WinForms, MAUI, Avalonia, etc.)',
  website: 'https://dotnet.microsoft.com',
};

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const contentsDir = path.join(appPath, 'Contents');
    const resourcesDir = path.join(contentsDir, 'Resources');
    const monoDir = path.join(contentsDir, 'MonoBundle');

    // Xamarin / MAUI on macOS
    if (fs.existsSync(monoDir)) {
      evidence.push('MonoBundle/');
      try {
        const items = fs.readdirSync(monoDir);
        const xamarinDlls = items.filter((item) =>
          item.startsWith('Xamarin') || item.startsWith('Microsoft.Maui') || item.endsWith('.dll')
        );
        if (xamarinDlls.length > 0) {
          evidence.push(`${xamarinDlls.length} .dll files in MonoBundle`);
        }
      } catch {
        // ignore
      }
    }

    // Avalonia is a .NET stack too, but it has its own detector ahead of this
    // one so the UI framework gets named instead of folding into WPF/MAUI.

    // .NET runtime bundled
    if (fs.existsSync(path.join(contentsDir, 'MacOS', 'libcoreclr.dylib'))) {
      evidence.push('libcoreclr.dylib (.NET runtime)');
    }
    if (fs.existsSync(path.join(contentsDir, 'MacOS', 'libmono-2.0.dylib'))) {
      evidence.push('libmono-2.0.dylib (Mono runtime)');
    }

    // Check Resources for .dll files (Mono pattern)
    try {
      const items = fs.readdirSync(resourcesDir);
      const dlls = items.filter((item) => item.endsWith('.dll'));
      if (dlls.length >= 3) {
        evidence.push(`${dlls.length} .dll files in Resources/`);
      }
    } catch {
      // ignore
    }
  } else if (platform === 'win32') {
    // .NET Core / .NET 5+ runtime
    if (fs.existsSync(path.join(appPath, 'dotnet.exe'))) {
      evidence.push('dotnet.exe');
    }
    if (fs.existsSync(path.join(appPath, 'coreclr.dll'))) {
      evidence.push('coreclr.dll');
    }
    if (fs.existsSync(path.join(appPath, 'clrjit.dll'))) {
      evidence.push('clrjit.dll');
    }

    // WPF / WinForms indicators
    const dotnetDlls = [
      'PresentationFramework.dll',
      'WindowsBase.dll',
      'System.Windows.Forms.dll',
      'Microsoft.Maui.dll',
    ];
    for (const dll of dotnetDlls) {
      if (fs.existsSync(path.join(appPath, dll))) {
        evidence.push(dll);
      }
    }

    // Check for .exe.config (classic .NET Framework apps)
    try {
      const files = fs.readdirSync(appPath);
      const configs = files.filter((f) => f.endsWith('.exe.config'));
      if (configs.length > 0) {
        evidence.push(configs[0]);
      }
    } catch {
      // ignore
    }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}
