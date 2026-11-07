# Tauri versions: what changed

Rewritten for this plugin from the official Tauri v2 docs (the v1 to v2 migration guide, "Updating Dependencies", the plugin and size pages), the tauri-apps/tauri release notes and sources, crates.io and npm.

Verified on 2026-11-07: versions from the crates.io API and `npm view`, release dates and notes from the GitHub releases of tauri-apps/tauri (tags `tauri-vX.Y.Z`), error strings and features from the sources at tag `tauri-v2.12.5`. Re-check with `cargo search tauri` and `npm view @tauri-apps/api version` before quoting a number; when the project's version is older than the code you are about to write, read this first.

## Current versions (2026-11-07)

| Package | Latest stable | Note |
|---|---|---|
| `tauri` (crate) | 2.12.5 (2026-10-21) | `rust-version` 1.90 |
| `tauri-build` | 2.7.4 | |
| `tauri-cli` | 2.12.4 | `rust-version` 1.90 |
| `tauri-plugin`, `tauri-utils` | 2.7.2, 2.10.2 | |
| `tauri-runtime-wry`, `wry`, `tao` | 2.12.3, 0.57.1, 0.37.2 | the webview runtime in 2.x |
| `@tauri-apps/api`, `@tauri-apps/cli` | 2.12.4 | |
| `create-tauri-app` | 4.7.5 | |
| Plugins (npm; each crate has the same version) | fs 2.7.1, shell 2.6.0, dialog 2.8.4, updater 2.14.1, log 2.10.1, store 2.5.0, opener 2.7.2, process 2.4.0, os 2.4.0, http 2.8.3, deep-link 2.6.3, notification 2.8.0 | |

**Keep them in step** (docs, "Updating Dependencies"): `@tauri-apps/api` and the `tauri` crate on the same minor, because the JS API relies on the Rust side. A plugin's npm package and its crate must be the exact same version (for example 2.2.1 for both `@tauri-apps/plugin-fs` and `tauri-plugin-fs`), since plugin changes can land in patch releases. `tauri-build` and `tauri` should be on the latest minor of the CLI, though that is not strictly required.

## Tauri 3 is an alpha

`tauri` 3.0.0-alpha.0 appeared on 2026-09-13 and 3.0.0-alpha.6 on 2026-11-06 (crates.io lists it as the newest version, stable stays 2.12.5). Do not move a project to it unless asked. What the alpha release notes say, which may change before a release:
- MSRV is Rust 1.95. The webview runtime is chosen at build time, not through Cargo features: `tauri::Builder::default().runtime(tauri_runtime_wry::Wry::default())`, or `tauri_runtime_cef::Cef::default()` for the new CEF runtime. The `wry` and `cef` features, and `x11`, `dbus`, `macos-proxy`, are removed from `tauri`.
- The `devtools` and `unstable` features must be enabled on the runtime crate, not on `tauri` alone; Linux GTK bindings are chosen by `gtk3` or `gtk4` features; the Linux tray uses the ksni backend by default.
- The `macos-private-api` feature and `app > macOSPrivateApi` option are removed (alpha.4). `tauri::test::MockRuntime` uses `tauri://localhost` on every platform, so mock IPC requests that used `http://tauri.localhost` must change.
- Plugin API renames: `plugin::Builder::js_init_script` becomes `initialization_script`, `Plugin::extend_api` becomes `run_invoke_handler`, plugin hooks take `Fn + Send + Sync` closures. `Manager::run_on_main_thread` replaces the per-type methods. The updater's `createUpdaterArtifacts` setting "will be removed in v3" (updater docs).

## 2.x: what each minor added

Release dates are the `tauri-vX.Y.0` GitHub releases. Only changes that matter when building apps are listed.

- **2.0** (2024-10-02): stable. Core permissions need the `core:` prefix (`core:default`, `core:window:default`); bare ids such as `path:default` are from the 2.0 betas.
- **2.1** (2024-11-09): `app > windows > useHttpsScheme` (custom protocol as `https://<scheme>.localhost`); `app > security > headers`; per-webview `devtools` option; `WebviewWindow::resolve_command_scope`; `SERIALIZE_TO_IPC_FN` so custom types (dpi `Size`, `Position`) pass through `invoke`.
- **2.2** (2025-01-02): badge APIs (`set_badge_count`, `set_overlay_icon`, `set_badge_label`); `Builder::on_tray_icon_event`; `TrayIconBuilder::show_menu_on_left_click` (old `menu_on_left_click` deprecated); `Scope::is_forbidden`.
- **2.3** (2025-02-26): `Emitter::emit_str*` to emit already-serialized JSON.
- **2.4** (2025-03-20): `build > removeUnusedCommands` (needs `tauri` 2.4, `tauri-build` 2.1, `tauri-plugin` 2.1, `tauri-cli` 2.4); `App::run_return` (and `run_iteration` deprecated); `AppHandle::request_restart`; `getIdentifier()` in the JS API; webview cookie APIs; path helpers accept Android content URIs.
- **2.5** (2025-04-15): macOS `set_dock_visibility`; `initialization_script_on_all_frames`; `preventOverflow` window option.
- **2.6** (2025-06-24): `x11` Cargo feature (default on; turning it off shrinks Wayland-only apps, and anyone who disables default features must re-enable it for X11 support); `Monitor::work_area`; `setAutoResize` in the JS API.
- **2.7** (2025-07-20): `mockIPC` can mock events with `{ shouldMockEvents: true }` (docs: "since 2.7.0"); plugins can add init scripts to all frames.
- **2.8** (2025-08-18): `PluginHandle::run_mobile_plugin_async`; webview `on_new_window` and `on_document_title_changed`; cookie set and delete; window `focusable`.
- **2.9** (2025-10-20): mobile app plugin for exit and back-button events; Android plugin hooks `onStop`, `onDestroy`, `onRestart`, `onConfigurationChanged`; async Swift plugin methods.
- **2.10** (2026-02-02): small (`WebviewWindow::set_simple_fullscreen`).
- **2.11** (2026-04-30): `#[tauri::command(rename = "...")]`; file associations on Android and iOS (and `RunEvent::Opened` on Android); multiple windows on Android (activity embedding) and iOS (scenes); `data-tauri-drag-region="deep"`; `dbus` Cargo feature (default on, needed for theme detection on Linux); `eval_with_callback`; web-content-process termination handler on macOS and iOS.
- **2.12** (2026-09-26): `app > appDirectoriesOverride` (portable apps); `exit` in `@tauri-apps/api/app` with `core:app:allow-exit`; `Webview::convert_file_src`; `limitNavigationsToAppBoundDomains`; webview permission-handler API. **Security fix:** queued channel payloads and large invoke responses were readable by other webviews (GHSA-w28w-mhc8-qvjv); stay on 2.12 or newer. **Breaking on Android:** `$VIDEO` and `video_dir()` now resolve to the app-specific Movies directory, so files written to the old location are not found. 2.12.5 is the latest patch (2026-10-21).

## v1 to v2

From the official migration guide. Read the whole guide even if you use the CLI's automated `migrate` command (documented as not a substitute); it converts the config and the v1 allowlist into a capability file.

- **Mobile prerequisite:** the crate must also build as a library. `[lib]` with `crate-type = ["staticlib", "cdylib", "rlib"]`, rename `main.rs` to `lib.rs`, make `main` a `pub fn run()` marked `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, and recreate `main.rs` as a call to it.
- **Config:** `package > productName` and `version` move to the top level; `tauri` becomes `app`; `tauri > allowlist` is gone (capabilities replace it); `tauri > bundle` moves to the top level and `identifier` too; `build > devPath` becomes `devUrl`, `distDir` becomes `frontendDist`; `withGlobalTauri` moves to `app`; `tauri > systemTray` becomes `app > trayIcon`; `fileDropEnabled` becomes `dragDropEnabled`; `tauri > updater` moves to `plugins > updater` and `bundle > createUpdaterArtifacts` must be set. Add `mainBinaryName` if the binary must keep matching `productName`.
- **JS API:** `@tauri-apps/api` keeps only `core` (was `tauri`), `path`, `event` and `window`/`webviewWindow`; `@tauri-apps/api/tauri` becomes `@tauri-apps/api/core`; `fs`, `dialog`, `shell`, `http`, `os`, `notification`, `process`, `updater`, `global-shortcut`, `cli` and `clipboard` modules moved to `@tauri-apps/plugin-*` packages. `WebviewWindow` is exported from `@tauri-apps/api/webviewWindow`.
- **Rust:** `tauri::api::*` is removed (dialog, fs, http, shell, process, path, version moved to plugins, `std`, `Manager::path`); `Window` became `WebviewWindow`, `WindowBuilder` `WebviewWindowBuilder`, `WindowUrl` `WebviewUrl`, `get_window` `get_webview_window`; `SystemTray*` became `tauri::tray::TrayIconBuilder`; `Menu`/`CustomMenuItem` became `tauri::menu::*`; Cargo features `system-tray` became `tray-icon`, `updater`, `shell-open-api` and `process-command-api` were removed.
- **Events:** `emit` now reaches every listener; `emit_to`/`emitTo` targets one; `emit_filter` filters on `EventTarget`; `listen_global` became `listen_any`; JS `event.listen()` hears everything unless a target is set.
- **Updater:** the built-in dialog and automatic check are gone; call the plugin's `check()` yourself or users stop getting updates. Use `createUpdaterArtifacts: "v1Compatible"` while v1 installs exist.
- **Windows origin:** production frontend files moved from `https://tauri.localhost` to `http://tauri.localhost`, so IndexedDB, localStorage and cookies reset unless `useHttpsScheme` is `true` (or `dangerousUseHttpScheme` was used in v1).
- **Environment variables renamed:** `TAURI_PRIVATE_KEY` to `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_KEY_PASSWORD` to `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `TAURI_PLATFORM`/`TAURI_ARCH`/`TAURI_DEBUG` to `TAURI_ENV_PLATFORM`/`TAURI_ENV_ARCH`/`TAURI_ENV_DEBUG`, `TAURI_DEV_SERVER_PORT` to `TAURI_CLI_PORT`.
- **Dev server for mobile:** since the 2.0 release candidate the server host comes from `TAURI_DEV_HOST`; the `internal-ip` package and a `TAURI_ENV_PLATFORM` mobile check are no longer needed.
