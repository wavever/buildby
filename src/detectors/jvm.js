import fs from 'fs';
import path from 'path';
import { listDir } from './shared.js';

export const meta = {
  id: 'jvm',
  name: 'JVM (Java/Kotlin/Scala)',
  category: 'cross-platform',
  color: 'red',
  description: 'Java Virtual Machine based apps (Swing, JavaFX, JetBrains IDEs, etc.)',
  website: 'https://www.java.com',
};

export function detect(appPath, platform) {
  const evidence = [];

  if (platform === 'darwin') {
    const contentsDir = path.join(appPath, 'Contents');

    // JetBrains Runtime (jbr) - IntelliJ, Android Studio, etc.
    if (fs.existsSync(path.join(contentsDir, 'jbr'))) {
      evidence.push('jbr/ (JetBrains Runtime)');
    }
    // Bundled JRE/JDK
    if (fs.existsSync(path.join(contentsDir, 'jre'))) {
      evidence.push('jre/');
    }
    if (fs.existsSync(path.join(contentsDir, 'jdk'))) {
      evidence.push('jdk/');
    }
    // Java runtime lib (legacy layout)
    if (fs.existsSync(path.join(contentsDir, 'runtime', 'jre'))) {
      evidence.push('runtime/jre/');
    }
    // jpackage layout: Contents/runtime/Contents/Home/ (JDK 14+)
    if (fs.existsSync(path.join(contentsDir, 'runtime', 'Contents', 'Home'))) {
      evidence.push('runtime/ (jpackage JDK)');
    }

    // libjvm.dylib in nested paths
    const jvmLocations = [
      path.join(contentsDir, 'jbr', 'Contents', 'Home', 'lib', 'server', 'libjvm.dylib'),
      path.join(contentsDir, 'jre', 'lib', 'server', 'libjvm.dylib'),
      path.join(contentsDir, 'runtime', 'jre', 'lib', 'server', 'libjvm.dylib'),
      path.join(contentsDir, 'runtime', 'Contents', 'Home', 'lib', 'server', 'libjvm.dylib'),
    ];
    for (const loc of jvmLocations) {
      if (fs.existsSync(loc)) {
        evidence.push('libjvm.dylib');
        break;
      }
    }

    // Legacy Apple Java bundle layout: Contents/Java/ holds the app's jars and
    // the JRE comes from the system, so none of the runtime checks above fire.
    // (Nutstore ships exactly this way.)
    const javaDir = path.join(contentsDir, 'Java');
    const javaJars = listDir(javaDir).filter((item) => item.endsWith('.jar'));
    if (javaJars.length > 0) {
      evidence.push(`${javaJars.length} .jar files in Java/ (Apple Java bundle)`);
    }

    // Check for .jar files in lib/
    const libDir = path.join(contentsDir, 'lib');
    if (fs.existsSync(libDir)) {
      try {
        const items = fs.readdirSync(libDir);
        const jars = items.filter((item) => item.endsWith('.jar'));
        if (jars.length > 0) {
          evidence.push(`${jars.length} .jar files in lib/`);
        }
      } catch {
        // ignore
      }
    }

    // jpackage layout: Contents/app/ contains .jar files and .cfg config
    const appDir = path.join(contentsDir, 'app');
    if (fs.existsSync(appDir)) {
      try {
        const items = fs.readdirSync(appDir);
        const jars = items.filter((item) => item.endsWith('.jar'));
        const cfgs = items.filter((item) => item.endsWith('.cfg'));
        if (jars.length > 0) {
          evidence.push(`${jars.length} .jar files in app/ (jpackage)`);
        }
        if (cfgs.length > 0) {
          evidence.push(`${cfgs[0]} (jpackage config)`);
        }
      } catch {
        // ignore
      }
    }

    // Check plugins directory (JetBrains IDEs store .jar plugins here)
    // Must contain actual .jar files to avoid false positives (e.g. macOS PlugIns/ with .appex)
    const pluginsDir = path.join(contentsDir, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      try {
        const pluginItems = fs.readdirSync(pluginsDir);
        const hasJarPlugins = pluginItems.some((item) => {
          const libPath = path.join(pluginsDir, item, 'lib');
          if (fs.existsSync(libPath)) {
            try {
              return fs.readdirSync(libPath).some((f) => f.endsWith('.jar'));
            } catch { return false; }
          }
          return false;
        });
        if (hasJarPlugins) evidence.push('plugins/ with .jar files (JetBrains pattern)');
      } catch {
        // ignore
      }
    }
  } else if (platform === 'win32') {
    // Bundled JRE
    if (fs.existsSync(path.join(appPath, 'jre'))) {
      evidence.push('jre/');
    }
    if (fs.existsSync(path.join(appPath, 'jbr'))) {
      evidence.push('jbr/');
    }
    if (fs.existsSync(path.join(appPath, 'runtime'))) {
      evidence.push('runtime/');
    }

    // jvm.dll
    const jvmDllLocations = [
      path.join(appPath, 'jre', 'bin', 'server', 'jvm.dll'),
      path.join(appPath, 'jbr', 'bin', 'server', 'jvm.dll'),
      path.join(appPath, 'runtime', 'bin', 'server', 'jvm.dll'),
    ];
    for (const loc of jvmDllLocations) {
      if (fs.existsSync(loc)) {
        evidence.push('jvm.dll');
        break;
      }
    }

    // .jar files in lib/ or app/ (jpackage)
    for (const dir of ['lib', 'app']) {
      try {
        const items = fs.readdirSync(path.join(appPath, dir));
        const jars = items.filter((item) => item.endsWith('.jar'));
        if (jars.length > 0) {
          evidence.push(`${jars.length} .jar files in ${dir}/`);
        }
      } catch {
        // ignore
      }
    }
  }

  if (evidence.length === 0) return null;

  return {
    ...meta,
    confidence: evidence.some((e) => e.includes('libjvm') || e.includes('jvm.dll') || e.includes('.jar')) ? 'high' : 'medium',
    evidence,
  };
}
