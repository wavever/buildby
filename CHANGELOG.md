# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-05-30

### Added

- Added `buildby --all` / `buildby -a` as the primary full-scan command.
  `--scan` remains available as a legacy alias.
- Added short filter flags for all supported stacks, including `-e`
  for Electron, `-f` for Flutter, `-t` for Tauri, and `-n` for Native.
- Added a persistent analysis cache for batch scans. Apps whose version and
  main executable fingerprint have not changed reuse previous analysis results.
- Added `--no-cache` to force a fresh batch analysis.
- Added automatic config file creation on first run:

  ```json
  {
    "cache": true,
    "excludeApps": []
  }
  ```

  On macOS the default path is `~/.buildby/config.json`.
- Added `excludeApps` config support to skip apps from `--all` and per-stack
  scans by app name, Bundle ID, or full path.
- Added English README screenshots.

### Changed

- Redesigned the full-scan output with a more shareable desktop app stack
  profile, including a title line and compact distribution chart.
- Improved table rendering for CJK, emoji, and ANSI-colored output.
- Improved batch-scan speed with worker-based analysis, batched size reads, and
  reduced expensive command calls.
- Batch scans skip signature and localized-name lookups to keep scans fast.

### Fixed

- Fixed locale handling so neutral terminal locales such as `C.UTF-8` can still
  fall back to the macOS system language, while explicit English locale
  overrides work as expected.

## [1.1.0] — 2026-05-21

### Renamed

- **The npm package has been renamed from `desktop-app-build-by` to
  `@wavever/buildby`** (a scoped package). Future installs should use:

  ```bash
  npm i -g @wavever/buildby
  ```

  npm's name-similarity check rejected the unscoped name `buildby` (too close
  to the existing `build` package), so the scoped form is the long-term home.
  The old package (`desktop-app-build-by`) is now deprecated on npm. Users who
  installed it will see a deprecation notice pointing to this new package. The
  CLI command remains `buildby`, so no usage changes are needed after switching.
- The GitHub repository has been renamed from `wavever/desktop-app-build-by` to
  `wavever/buildby`. GitHub auto-redirects all old URLs, but you may want to
  update any local clones:

  ```bash
  git remote set-url origin https://github.com/wavever/buildby.git
  ```

### Added (inherited from 1.0.2)

- **Signature & notarization detection.** Single-app inspection
  (`buildby <name>` and `--path`) now shows a new section listing:
  - Developer name (parsed from the codesign authority) and Team ID
  - Signature status — Signed / Ad-hoc / Unsigned
  - Notarization status — Notarized / Apple System / Mac App Store /
    Not notarized / Rejected
  - Hardened Runtime flag
- **Windows Authenticode support.** On Windows, `buildby` invokes PowerShell
  `Get-AuthenticodeSignature` to extract the publisher (from the certificate
  CN/O) and the signature status (Valid, NotSigned, etc.).
- Bilingual (en / zh) labels for the new section.

### Notes

- Signature extraction is opt-in (`analyzeApp(app, { includeSignature: true })`)
  and only runs in the detail-view code paths. `--scan` and `--<stack>` filter
  performance is unchanged.
- The detail view falls back to `codesign`'s `Notarization Ticket=stapled`
  marker if `spctl` is unavailable or times out.

## [1.0.2] — 2026-05-20

### Added

- Code signature, developer/team, and notarization detection scaffolding
  (released to npm but feature was introduced one version early; see 1.1.0).

### Fixed

- Dropped leading `./` from the `bin` entry in `package.json` to silence
  an `npm publish` warning under npm 11.

## [1.0.1] — 2026-03-11

### Changed

- Enhanced tech-stack detection and display formatting.
- Improved macOS native app detection (Swift / SwiftUI sub-tech surfacing).
- Added localized app display name support on macOS via `InfoPlist.strings`.
- Added Tauri signature detection via binary string scanning.

## [1.0.0] — 2026-03-10

### Added

- Initial release. Detection for Electron, Flutter, CEF, Chromium, Tauri, Qt,
  wxWidgets, JVM (Java/Kotlin/Scala), .NET, NW.js, React Native, Unity, and
  Native (Swift/Objective-C, Win32/WinUI) apps.
- `buildby <name>` — fuzzy-match single-app inspection.
- `buildby --scan` — scan all installed apps, grouped by tech stack with a
  distribution chart.
- `buildby --<stack>` — filter by tech stack (e.g. `--electron`, `--flutter`).
- `buildby --path <dir>` — inspect a custom path.
- Bilingual (en / zh) output.
