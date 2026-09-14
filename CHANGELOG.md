# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] — 2026-09-15

### Added

- Added `buildby update`, which checks for a newer published release and
  installs it. `buildby update --check` reports without installing.
- `update` queries npm for the latest version, so registry mirrors, proxies and
  auth settings configured for npm are respected.
- `update` refuses to install over a git checkout or an `npm link`ed build,
  reporting the path instead of silently detaching it from the working copy.

### Notes

- `update` is a subcommand, so an app literally named "update" can no longer be
  inspected by name. Use `buildby --path` for that case.
- `update` is an action rather than a query and has no `--json` form.

## [1.3.0] — 2026-09-14

### Added

- Added `--json` for machine-readable output in every mode. All modes return one
  envelope shape carrying a versioned `schema` field, so consumers never branch
  on the payload. Progress and errors stay on stderr, leaving stdout safe to pipe.
- Added `--json` exit codes: `0` when apps matched, `1` when none did, `2` on
  error. Scoped to `--json` only, so existing interactive usage is unaffected.
- Added detection for Python (py2app, PyInstaller, Nuitka, or a vendored CPython),
  GTK, Wails, JUCE, Godot, Unreal Engine, and Compose Multiplatform.
- Added Avalonia as its own stack, split out of the .NET detector so the UI
  framework is named instead of folding into WPF/WinForms/MAUI.
- Added a `variant` field that carries the sub-technology — Python's UI toolkit
  (`Python (PyQt)`) and the native language/UI pair (`Native (Rust · AppKit)`) —
  as structured data rather than only inside the display name.
- Added `-p` / `--python` and `-g` / `--gtk` filter flags, plus long-form flags
  for every other new stack.
- Added the project's first test suite: 31 cases over detector fixtures, the JSON
  payload, and binary-probe edge cases, with CI across macOS, Windows and Ubuntu.

### Changed

- Detection now covers 21 stacks, up from 13.
- The progress spinner no longer freezes during analysis. App sizing is measured
  asynchronously, and single-app inspection runs on a worker thread, so the event
  loop stays free while `du` and `spctl` work.
- `--all --json` collects the full native breakdown so `variant` does not depend
  on which output mode was requested. This makes it slower than plain `--all`.
- Bumped the analysis cache schema. Cache entries key on app version and
  executable fingerprint, neither of which changes when detection logic does, so
  upgrading otherwise kept serving the previous classification.

### Fixed

- Fixed Qt detection missing frameworks nested one level below
  `Contents/Frameworks`, which made apps such as WPS Office fall through to the
  native fallback.
- Fixed JVM detection missing the legacy Apple `Contents/Java/` bundle layout
  used by apps that ship jars there and rely on the system JRE.
- Fixed QtWebEngine apps being reported as Chromium. QtWebEngine embeds Chromium,
  so its resource packs and V8 snapshot were outranking the Qt detector.
- Fixed native apps written in Rust or Go being reported as Objective-C.
- Fixed Tauri detection never matching on Windows: the crate-signature probe ran
  only on macOS, so the check that required it could never pass on Windows.

## [1.2.0] — 2026-05-30

### Added

- Added `buildby --all` / `buildby -a` as the primary full-scan command, with `--scan` kept as a legacy alias.
- Added short filter flags for all supported stacks, including `-e`, `-f`, `-t`, and `-n`.
- Added a persistent analysis cache that reuses results when app versions and executable fingerprints are unchanged.
- Added `--no-cache` to force a fresh batch analysis.
- Added automatic config file creation on first run with `cache: true` and `excludeApps: []`.
- Added `excludeApps` config support to skip apps from `--all` and per-stack scans by app name, Bundle ID, or full path.
- Added English README screenshots.

### Changed

- Redesigned the full-scan output with a more shareable desktop app stack profile and compact distribution chart.
- Improved table rendering for CJK, emoji, and ANSI-colored output.
- Improved batch-scan speed with worker-based analysis, batched size reads, and reduced expensive command calls.
- Batch scans skip signature and localized-name lookups to keep scans fast.

### Fixed

- Fixed locale handling so neutral terminal locales such as `C.UTF-8` fall back correctly while explicit English overrides still work.

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
