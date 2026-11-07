---
name: tauri
description: "Build, review and debug Tauri 2.x apps (desktop and iOS/Android, TypeScript frontend, Rust core). Covers project layout, commands and IPC (errors, state, events, channels), plugins, the v2 capability and permission system when a call is denied, windows, menus and tray, the mobile entry point and platform limits, sidecars, updater and signing basics, Vite setup, headless testing (cargo test, tauri::test, mocked IPC), debugging and v1 to v2 migration. Use whenever the repo has src-tauri/ or tauri.conf.json, a tauri::command, or @tauri-apps/api imports. Security review is in the security-audit skill."
---

# Tauri

Working practice for Tauri 2.x apps: a TypeScript frontend in the OS webview and a Rust core. Follow the project's own conventions first; this skill fills the gaps. Written for this plugin from the official Tauri v2 docs and sources and the most-starred community Tauri skills (see the credits in the README). Detail lives in `references/`:

- [patterns.md](references/patterns.md): code for commands, errors, state, channels, capabilities, plugins, sidecars, tests, Vite and Cargo config
- [versions.md](references/versions.md): current versions, what 2.x minors added, the Tauri 3 alpha, v1 to v2 changes
- [troubleshooting.md](references/troubleshooting.md): the errors you will actually hit
- [review-checklist.md](references/review-checklist.md): a checklist for reviewing Tauri changes

**Hard rule: never launch the app.** No `tauri dev`, `tauri android dev` or `tauri ios dev` (they open a window, an emulator, Xcode or Android Studio and take focus), and no WebDriver run against the real app. Verify as in section 13 and say what you could not verify.

## 1. Detect before you write

Read `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` before suggesting anything:
- **Version line.** v1 has `package`, `tauri` and `allowlist` in the config, no `capabilities/` folder, and imports from `@tauri-apps/api/tauri`. v2 has `app`, `bundle`, a top-level `identifier` and `src-tauri/capabilities/`. Stay on the project's line: Tauri 3 is only an alpha ([versions.md](references/versions.md)). `tauri` 2.12 needs Rust 1.90 or newer.
- **Migrating from v1:** follow the checklist in [versions.md](references/versions.md). The CLI's `migrate` command converts the config and the allowlist into a capability file but is not a substitute for it; the usual misses are the updater (the app must call `check()` itself now), the Windows origin change that resets local storage, and plugin npm/crate versions.
- **Layout and targets:** `src-tauri/src/lib.rs` plus `main.rs`, `build.rs`, `capabilities/`, optional `permissions/`. `gen/android` or `gen/apple` means mobile is set up. `tauri.<platform>.conf.json` files merge into the main config and replace arrays rather than merging them.
- **Frontend:** framework, bundler (Vite is the documented path), package manager from the lockfile, `build.devUrl`, `build.frontendDist`, `beforeDevCommand`, `beforeBuildCommand`. The frontend compiles to static files; there is no server runtime.
- **Plugins:** every `tauri-plugin-*` crate has a `@tauri-apps/plugin-*` twin at the same version, a `.plugin(...)` call in `lib.rs` and a permission in a capability.
- **Tests:** vitest or jest, `cargo test`, any e2e config. `tauri info` (the project-local CLI) prints versions and environment without opening anything.
- The nearest existing command module is the pattern to copy: layout, error type, state type, test style. `ctx where <command name>` finds a command's Rust definition and its frontend callers. A subagent cannot ask: when the project does not settle a choice, follow its conventions and state the assumption in the report.

## 2. Layout: what lives where

- **Rust core:** anything that touches the OS, files, processes, secrets or credentialed network calls, long-running work, state shared between windows, and any rule that must hold even if the frontend is compromised. The docs advise deferring as much business logic as possible to the core.
- **Frontend:** rendering and UI state. It reaches the core through one typed module (`src/lib/ipc.ts`), not `invoke('name')` strings scattered through components.
- `lib.rs` holds `run()` with `#[cfg_attr(mobile, tauri::mobile_entry_point)]`; `main.rs` only calls `app_lib::run()`, so put no code there. `[lib]` needs `crate-type = ["staticlib", "cdylib", "rlib"]` for mobile.
- Split `src-tauri/src/` by feature: `commands/` (thin wrappers), plain modules with the logic (no `tauri` imports), `state.rs`, `error.rs`. Commit `Cargo.lock`, never `src-tauri/target`. Rust language practice is the `rust` skill; TypeScript and React practice are the `typescript` and `react` skills.

## 3. Commands (rules)

- **A command is a thin wrapper:** take owned, deserializable arguments, call a plain function, map its error. The logic stays testable with `cargo test` and no runtime ([patterns.md](references/patterns.md)).
- Register every command in **one** `tauri::generate_handler![...]`. A second `invoke_handler` call replaces the first, and an unlisted command rejects with `Command X not found`. Names are global, so unique across modules. In `lib.rs` a command cannot be `pub` (macro glue); in a submodule it must be, and the list uses the path (`commands::save_note`). `#[tauri::command(rename = "...")]` (2.11) renames one.
- **Arguments:** Rust `snake_case` arrives as JS `camelCase` keys (`invoke('save', { noteId })`); `rename_all = "snake_case"` flips that. A mismatch fails at runtime, not compile time, so the typed frontend wrapper is where it gets checked.
- **Errors:** return `Result<T, E>` with `E: Serialize`: a `thiserror` enum with a manual `Serialize` that emits `{ kind, message }`, so the frontend can switch on `kind`. `Result<T, String>` is acceptable in a small app. Never `unwrap`/`expect` on input-dependent paths. The message reaches the user's screen: no paths, secrets or SQL.
- **Async:** a command without `async` runs on the main thread (a slow one freezes the UI) unless declared `#[tauri::command(async)]`; `async` commands run on the async runtime and are the default for I/O. An async command cannot borrow its arguments (`&str`, `State<'_, T>`) unless it returns `Result`: use `String`, or return `Result`.
- **Payloads:** large or binary results return `tauri::ipc::Response` (`Vec<u8>` through serde becomes a JSON array and is slow); progress and streams use a `Channel<T>`; raw request bodies use `tauri::ipc::Request`.
- A command can take `AppHandle`, `WebviewWindow` (the caller), `State<T>` and `Channel<T>`. A command that must run under the mock runtime is generic over `R: Runtime` ([patterns.md](references/patterns.md)).
- Keep commands narrow and purpose-specific; never a generic `read_file(path)` or `run(cmd)`. Argument validation, path checks and scope enforcement are the `security-audit` skill's Tauri and Rust checklists.

## 4. State and concurrency

- Register with `.manage(value)` on the builder or in `setup`. Read it with `State<'_, T>` in a command, or `app.state::<T>()` on any `Manager` (`AppHandle`, `Window`). No `Arc` needed (Tauri adds it). Move an `AppHandle` clone, not a `State`, into a thread or task.
- Mutable state: `std::sync::Mutex<T>` is the default, in async code too (the docs call it fine and often preferred). Use `tokio::sync::Mutex` only when the guard must be held across an `.await` (a database connection, a writer). `RwLock` only when reads dominate and the lock never spans an `.await`.
- **Never hold a std guard across `.await`:** copy what you need out, drop the guard, then await. Keep critical sections short and call nothing slow or re-entrant while locked.
- **The type must match exactly.** `State<'_, AppState>` when `Mutex<AppState>` was managed compiles, then every call rejects with `state not managed for field ...`, and `app.state::<T>()` panics. Use a type alias (`type AppState = Mutex<Inner>`) and use it as is.
- Do not `unwrap()` a lock in a command: a panic while locked poisons it and every later call fails. Map the `PoisonError` to your error type.

## 5. Events and channels

| Need | Use | Why |
|---|---|---|
| Ask Rust, get one answer | command | typed, permission-checked |
| Notify of a state change, small JSON | event (`emit`, `listen`) | fire and forget, either direction, many listeners |
| Progress, logs, child output, many ordered messages | `Channel<T>` argument of a command | ordered and fast; used internally for downloads, process output and WebSockets |
| Large binary result | `tauri::ipc::Response` | skips JSON |

- Events are untyped, JSON only, return nothing, and are not meant for high throughput. Payloads must be `Serialize + Clone`. A global `emit` reaches every listener in every window, so no secrets in payloads.
- `emit_to(label, ...)` targets one webview; those events skip global listeners unless the listener is `listen_any` (Rust) or `{ target: { kind: 'Any' } }` (JS).
- `listen()` resolves to an unlisten function. Call it on teardown, chained on the promise when teardown can run first. A listener added per mount and never removed is the usual duplicate-handler bug.
- Channel messages: one tagged enum (`#[serde(tag = "event", content = "data")]`) mirrored by a TypeScript union. `send` fails once the page is gone: stop the work, do not `unwrap`. Stay on `tauri` 2.12 or newer, which fixed queued channel payloads being readable by other webviews ([versions.md](references/versions.md)).

## 6. Capabilities and permissions (when a call is denied)

- The frontend may call a plugin or core API only if a **capability** (a file in `src-tauri/capabilities/`, JSON or TOML) whose `windows` or `webviews` match the caller's **label** lists a **permission** for it. Your own commands are open to every window unless `build.rs` narrows them with `AppManifest::commands`.
- In a debug build the rejection names the fix: `plugin.cmd not allowed. Permissions associated with this command: plugin:allow-cmd`. A release build only says `Command X not allowed by ACL`. Add the narrowest permission to the capability for that window. `tauri permission ls <plugin>` lists what exists (it reads `gen/schemas/acl-manifests.json`, written by the build).
- Prefer `plugin:allow-<command>` with a scope over `plugin:default` with a wide scope. Core permissions are `core:`-prefixed (`core:default`, `core:window:allow-set-title`). A scope sits in the same entry: `{ "identifier": "fs:allow-write-text-file", "allow": [{ "path": "$APPDATA/notes/*" }] }`; deny beats allow.
- **Capabilities are validated at compile time.** `tauri-build` fails on a typo or a plugin that is not a dependency (`unknown permission X for Y`, `unknown ACL for X, expected one of ...`), so `cargo check` verifies a capability edit without a window. Mocked IPC skips the ACL entirely: a green frontend test says nothing about permissions.
- Labels, not titles. A window named in several capabilities gets the union. `platforms` keeps desktop-only permissions out of mobile files and the reverse. Every file in `capabilities/` is active unless `app.security.capabilities` lists some.
- Do not widen a capability to make a call work: add the one permission it needs. Scopes, `remote.urls`, CSP, isolation and least-privilege review are the `security-audit` skill's Tauri checklist.

## 7. Plugins

- Official plugins are `tauri-plugin-<name>` (crate) plus `@tauri-apps/plugin-<name>` (npm): fs, shell, dialog, store, log, http, opener, notification, process, os, deep-link, single-instance, window-state, global-shortcut, autostart, updater, sql, stronghold, and the mobile ones (biometric, nfc, barcode-scanner, haptics, geolocation). Many v1 core APIs moved into them.
- `tauri add <name>` adds the crate and the npm package, registers the plugin in `lib.rs` and adds its default permission: read the diff. By hand: `cargo add`, `.plugin(tauri_plugin_x::init())`, the npm package, a permission.
- `single-instance` must be registered first. Desktop-only plugins (updater, global-shortcut) are added under `#[cfg(desktop)]` with a target-gated Cargo dependency. `shell.open` moved to the `opener` plugin; use `shell` only to spawn processes.
- Write a plugin only for reuse or native mobile code; a module in the app is simpler. `tauri plugin new <name>` scaffolds one (`--no-api`, `--android`, `--ios`). Commands get `allow-<cmd>`/`deny-<cmd>` permissions from `COMMANDS` in its `build.rs`, plus a `permissions/default.toml` set; JS calls `invoke('plugin:<name>|<cmd>')`; config lives under `plugins` in `tauri.conf.json`. A plugin name uses lowercase ASCII, digits and hyphens only (no underscore), or the build fails.
- Mobile plugins: a Kotlin class (`@TauriPlugin`, `@Command`) and a Swift class (`@objc` functions taking `Invoke`). Android commands run on the main thread, so blocking work goes in a coroutine or the app hits an ANR.

## 8. Windows, menus, tray

- Windows come from `app.windows` or `WebviewWindowBuilder` (v2 renamed `Window` to `WebviewWindow`, `get_window` to `get_webview_window`). The label is what capabilities match. Creating windows from the frontend needs `core:webview:allow-create-webview-window`: give it only to trusted windows.
- Menus (`tauri::menu`) and the tray (`tauri::tray::TrayIconBuilder`, needs the `tray-icon` Cargo feature) are built in Rust or with `@tauri-apps/api/menu`; clicks return through `on_menu_event` and `on_tray_icon_event`. Permissions: `core:menu:default`, `core:tray:default`. On macOS every menu item must sit in a submenu, and the first submenu becomes the app menu.
- A tray app handles `RunEvent::ExitRequested` and calls `api.prevent_exit()`; otherwise closing the last window exits. `window-state` restores size and position.
- Custom title bar: `decorations: false`, `data-tauri-drag-region` on the bar, and the `core:window:allow-*` permissions its buttons call. Desktop UI conventions: the `frontend-design` skill.

## 9. Mobile

- The entry point is `run()` with `#[cfg_attr(mobile, tauri::mobile_entry_point)]` in the library crate. `tauri-build` defines the `desktop` and `mobile` cfg aliases; use them for desktop-only code.
- Webviews differ (WebView2 on Windows, WKWebView on macOS and iOS, WebKitGTK on Linux, the system WebView on Android), which is why the Vite `build.target` is set per platform. Never hard-code paths; use `app.path()`. On Android a dialog can return a `content://` URI (the path helpers accept it since 2.4). Android 16 KB page alignment needs NDK 28 or newer, else the linker flag in [patterns.md](references/patterns.md).
- The dev server must listen on `TAURI_DEV_HOST` when set (iOS devices). Multi-window on mobile (2.11) needs Android 12L or iOS 13 and extra native setup; back-button and exit events come from the mobile app plugin (2.9).
- **Build requirements:** Android needs Android Studio (SDK Platform, Platform-Tools, NDK side by side, Build-Tools, Command-line Tools), `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME` and the four rustup Android targets. iOS is macOS only, with full Xcode (not just the command line tools), the iOS rustup targets and CocoaPods. Desktop: Linux needs the webkit2gtk-4.1 dev packages, Windows the MSVC build tools and WebView2 (plus VBSCRIPT for MSI), macOS Xcode or its command line tools. These are system installs: report what is missing instead of installing.
- No device or emulator runs here. `cargo check`/`cargo test` on the host, frontend tests and the headless browser run cover the shared code; say that native plugin code, platform builds and device behavior were not verified.

## 10. Sidecars, shell and process

- A sidecar is an executable listed in `bundle.externalBin` (`"binaries/my-sidecar"`) with a copy named `my-sidecar-<target-triple>[.exe]` per target (`rustc --print host-tuple`, Rust 1.84+). From Rust: `app.shell().sidecar("my-sidecar")` (file name only), then `spawn()` gives an event receiver and a child. Read events in an async task and kill the child on `RunEvent::Exit`.
- Run processes from a Rust command that validates its arguments, rather than granting the frontend `shell:allow-execute` or `allow-spawn`. If the frontend must run one, the capability names the exact command, `sidecar: true` and an `args` list of fixed strings and `{ "validator": ... }` entries; `args: true` allows anything, so avoid it. Never pass frontend strings to `sh -c`.
- `process` provides `relaunch` (after an update); `exit` is also in `@tauri-apps/api/app` since 2.12. Bundled files go in `bundle.resources` and are resolved with `app.path().resolve(..., BaseDirectory::Resource)`.

## 11. Updater, bundling, signing

- The updater plugin is desktop only and always verifies a signature. `tauri signer generate -w <path>` makes the key pair. The private key reaches the build through `TAURI_SIGNING_PRIVATE_KEY` (and `_PASSWORD`) from CI secrets, never the repo, and **losing it means installed apps can never update**. `pubkey` in the config is the key's content, not a path; endpoints are HTTPS; `bundle.createUpdaterArtifacts` is `true` (`"v1Compatible"` while v1 installs exist). The v1 built-in dialog is gone: the app must call `check()` itself.
- `tauri build` compiles and bundles; `--no-bundle` then `tauri bundle --bundles ...` splits the steps. Installers need each platform's toolchain, and distribution needs code signing (macOS sign and notarize, Windows, Android keystore, iOS provisioning). Those need secrets and platform tools: do not attempt them, list them as unverified.
- App version: `tauri.conf.json > version`, else the Cargo package version. `--config <file>` merges a JSON patch for flavors such as a beta identifier.

## 12. Frontend integration

- Imports: `invoke`, `Channel`, `convertFileSrc`, `isTauri` from `@tauri-apps/api/core`; `listen`, `emit` from `/event`; `getCurrentWebviewWindow` from `/webviewWindow`; also `/path`, `/window`, `/menu`, `/tray`, `/app`. Everything else is `@tauri-apps/plugin-*`. Never `@tauri-apps/api/tauri` (v1). Keep `app.withGlobalTauri` off and use the npm package: the global exposes `window.__TAURI__` to every script on the page.
- Vite: a fixed port with `strictPort` matching `devUrl`, `clearScreen: false`, `server.host` from `TAURI_DEV_HOST`, ignore `src-tauri` in the watcher, `envPrefix` including `TAURI_ENV_*`, `build.target` per platform, minify and sourcemaps from `TAURI_ENV_DEBUG`, and `frontendDist` pointing at the build output ([patterns.md](references/patterns.md)). Other bundlers need the same; SSR frameworks must emit static files.
- Tauri APIs exist only inside the app webview. In shared code guard with `isTauri()`. In a plain browser `invoke` throws a TypeError (`window.__TAURI_INTERNALS__` is undefined) unless IPC is mocked first.
- Rust is the source of truth; the frontend caches. Do not mirror large Rust state in a JS store without a change event.

## 13. Verify without launching the app

- **Rust, in `src-tauri/`:** `cargo check`, `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt --check`. `cargo check` also runs `tauri-build`, which validates capabilities and permission identifiers. A dev build with `devUrl` set does not need the built frontend; if it panics that `frontendDist` "doesn't exist", build the frontend once. On Linux these need the WebKitGTK dev packages: if they are missing say so, do not install system packages.
- **Logic:** unit-test the plain functions behind commands (the `test-driven-development` skill). **Wiring:** `tauri::test` (Cargo feature `test`; the crate docs mark it unstable) with `mock_builder` and `get_ipc_response`, no native webview ([patterns.md](references/patterns.md)).
- **Frontend:** `tsc --noEmit`, the linter, unit tests with `mockIPC` from `@tauri-apps/api/mocks` (`mockWindows` for labels, `clearMocks()` after each test, a `crypto.getRandomValues` shim under jsdom).
- **Browser run:** serve the frontend over http (dev server, or a build behind `vite preview`) with mocked IPC installed by a dev-only entry, and drive it with the bundled headless Playwright server (`mcp__plugin_agents-kit_playwright__*`, http(s) only) or the project's own headless e2e. Follow the smoke-test rules of the `agents-kit:developer` agent and stop the server afterwards.
- **CI only:** WebDriver e2e against the real app (`tauri-driver`, WebdriverIO's `@wdio/tauri-service`) needs a display (xvfb on Linux). Do not run it from an agent. The service's browser mode (frontend in Chrome with intercepted `invoke`) is fine if the project already uses it headless.
- **Cannot be verified this way, so say so:** real webview rendering differences, native dialogs, windows, tray and menus, deep links, single-instance, the updater, sidecars, signing and notarization, anything on a device or emulator.
- **Debugging** (`systematic-debugging` skill): read the compiler error first; `RUST_BACKTRACE=1 cargo test`; the log plugin (`LogDir` file target, `attachConsole()` to see Rust logs in the webview console); Playwright console and network messages for the browser run. Inspect Element and devtools need a window: ask the user to open them and paste the output. The `devtools` Cargo feature in a release build uses a private macOS API and blocks App Store review.

## 14. Performance and size

- Do not block the main thread; send big data with `Response` or a `Channel`; bound the rate of progress events.
- Release profile (docs): `lto = true`, `codegen-units = 1`, `opt-level = "s"`, `panic = "abort"`, `strip = true`. With `panic = "abort"` any panic ends the process, which makes `unwrap()` in a command costlier. `build.removeUnusedCommands: true` (tauri 2.4+) drops commands no capability allows, so list the permissions you use instead of `:default` sets. Every plugin adds code and a permission surface.

## 15. Before you say it is done

`cargo check`, `cargo clippy` and `cargo test` in `src-tauri`, `tsc --noEmit` and the frontend tests; a clean `cargo check` after any capability edit. Run `ctx impact` on a renamed or removed command and update the typed wrapper. Then the `verification-before-completion` skill, with the unverified list from section 13. For a review use [references/review-checklist.md](references/review-checklist.md) with `/agents-kit:code-review`; for anything security-sensitive, the `security-audit` skill's Tauri and Rust checklists.
