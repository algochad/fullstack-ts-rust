# Tauri troubleshooting

Rewritten for this plugin from the official Tauri v2 docs (debug, prerequisites, develop and plugin pages), the error strings in the tauri 2.12 sources, and the pitfall lists in the community Tauri skills credited in the README. Reproduce first (the `systematic-debugging` skill), then use this to find where to look. Nothing here needs the app window: where the usual fix is to look at the running app, ask the user to do that and paste the output.

## `invoke` rejects with `Command X not found`

The command is not in the handler. Check, in order:
1. It is listed in `tauri::generate_handler![...]`, and there is **one** `invoke_handler` call (a second one replaces the first).
2. The JS name equals the Rust function name (or the `rename` given in `#[tauri::command(rename = "...")]`), `snake_case` as written in Rust, not camelCase.
3. For a plugin command the call is `plugin:<name>|<command>` and the plugin is registered with `.plugin(...)`.
4. The npm package and the crate of a plugin are the same version (a newer JS binding can call a command an older crate lacks).

## `... not allowed` (permission errors)

The command exists but the capability does not allow it.
- `plugin.cmd not allowed. Permissions associated with this command: plugin:allow-cmd`: add that permission (or a set containing it) to a capability that targets the calling window.
- `... not allowed on window "x", webview "y", URL: ... allowed on: [windows: "main-*", URL: local] ... referenced by: capability: ...`: the permission is granted, to a different label or origin. Windows match by **label**, not title; a window created at runtime needs a label a capability lists (`"windows": ["*"]` is broad, so prefer a prefix such as `"doc-*"` for dynamic windows). A remote URL needs a capability with `remote.urls`.
- `... not allowed. Plugin not found`: the plugin is not registered or not a dependency of the app. `... not allowed. Command not found`: the plugin has no such command (version mismatch, or a typo).
- Only a debug build prints those details; a release build says `Command X not allowed by ACL`. Reproduce in a debug build or a test.
- `tauri permission ls <plugin>` lists permission ids after a build has written `gen/schemas/acl-manifests.json`.

## `cargo check` or the build fails on a capability

`tauri-build` validates capabilities and plugin permissions at compile time.
- `unknown permission X for Y`: the id is misspelled or that plugin has no such permission. Core ids need the `core:` prefix.
- `unknown ACL for X, expected one of ...`: the permission names a plugin that is not a dependency of the app. Add the plugin crate to `Cargo.toml`; the build script reads plugin permissions from the dependencies.
- `identifiers can only include lowercase ASCII, hyphens which are not leading or trailing, and a single colon if using a prefix`: a plugin name or permission id has an underscore, an uppercase letter or a stray colon.
- The app panics at compile time with ``The `frontendDist` configuration is set to ... but this path doesn't exist``: a release-style build (the `custom-protocol` feature) or a config without `devUrl` needs the built frontend. Build it once (`npm run build`) or check the path in `tauri.conf.json`.
- `error[E0255]: the name __cmd__command_name is defined multiple times`: a `#[tauri::command]` in `lib.rs` is `pub`. Remove `pub` there (commands in submodules do need it).

## `state not managed for field ... on command ...`

The `State<'_, T>` type differs from what `.manage()` registered, or nothing was managed. `State<'_, AppState>` does not match `Mutex<AppState>`. Use a type alias for the managed type and name the alias in every command. `Manager::state::<T>()` panics with `state not found for type ...` for the same reason.

## Arguments arrive missing, or a deserialization error names a key

Rust `snake_case` parameters are `camelCase` keys from JS (`invoke('f', { noteId })`); add `rename_all = "snake_case"` to the command to use snake_case keys. The error appears at runtime, not at compile time. Optional values need `Option<T>` on the Rust side; a missing key for a non-optional parameter rejects. Types must implement `Deserialize` (and `Serialize` for returns and errors).

## An async command will not compile

An async command cannot borrow its arguments: `&str`, and `State<'_, T>` unless the command returns `Result`. Take `String`, or return `Result<_, _>`. Holding a `std::sync::MutexGuard` across `.await` also fails (the future is not `Send`) or risks a deadlock: drop the guard before awaiting, or use `tokio::sync::Mutex` for a guard that must span awaits.

## The UI freezes while a command runs

A command without `async` runs on the main thread. Make it `async` (with async I/O, or `tauri::async_runtime::spawn_blocking` for blocking calls), or mark it `#[tauri::command(async)]`. On Android a plugin's native command runs on the main thread too: use a coroutine (`Dispatchers.IO`) or the app can hit an ANR.

## Events fire twice, or a handler keeps running after navigation

`listen()` was called on every mount without calling the returned unlisten function (React strict mode mounts twice in development). Keep the promise and call it on teardown: `p.then((fn) => fn())`. A listener registered with `emit_to`'s label only hears events sent to that webview; to hear everything use `listen_any` (Rust) or `{ target: { kind: 'Any' } }` (JS).

## In a plain browser or a unit test, `invoke` throws a TypeError

`window.__TAURI_INTERNALS__` is undefined outside the app webview. Mock IPC before the code runs (`mockIPC`, `mockWindows` from `@tauri-apps/api/mocks`), guard with `isTauri()`, or inject the mock in a dev-only entry ([patterns.md](patterns.md)). Under jsdom `mockIPC` also needs a `crypto.getRandomValues` shim, and `clearMocks()` after each test. Calls to the real backend are not available in a browser; the docs point to `tauri-invoke-http` for bridging them, which is not needed for mocked checks.

## `tauri::test` is not found

It sits behind the `test` Cargo feature: add `tauri = { version = "2", features = ["test"] }` under `[dev-dependencies]`. A command that names `AppHandle` or `WebviewWindow` without a generic runtime parameter does not type-check against `MockRuntime`; make it generic over `R: Runtime`. The module is documented as unstable.

## Frontend looks wrong only inside the app

The webview engine differs from your dev browser (WebView2, WKWebView, WebKitGTK, Android System WebView). Check the Vite `build.target` (`chrome105` on Windows, `safari13` elsewhere in the docs), CSS and JS features against that engine, and the CSP (a CSP that blocks a script or `connect-src` shows as a console error, see the `security-audit` skill). You cannot see this headless: report it as unverified, or ask the user for a console excerpt.

## Dev server problems (report from the user's run)

- Blank window or "could not connect": `build.devUrl` must equal the dev server's host and port; Vite needs a fixed port with `strictPort: true`; `beforeDevCommand` must start the server.
- Rebuild loops: Vite watches `src-tauri` unless `server.watch.ignored` has `**/src-tauri/**`; Tauri's own watcher honors `.taurignore`.
- iOS device cannot reach the server: the dev server must listen on `TAURI_DEV_HOST` (`host: host || false`, and `hmr` on that host). The first iOS run prompts for local-network access: allow it and restart the app.
- Xcode build script cannot find node: Xcode runs the CLI without your shell additions, so version managers on `PATH` may be missing.

## Build and prerequisites

- Linux `pkg-config` or linker errors about `webkit2gtk-4.1`, `gtk`, `libsoup`, `ayatana-appindicator`: the dev packages are missing (the prerequisites page lists them per distribution). That is a system install: report it.
- Windows MSI `failed to run light.exe`: enable the VBSCRIPT optional feature. Rust must use the MSVC toolchain (`rustup default stable-msvc`); WebView2 must be present.
- Android: `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME` must be set, the SDK components installed, and the four Android rustup targets added (`aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`). For the 16 KB page-size requirement on new Android submissions use NDK 28 or newer, or the linker flag in [patterns.md](patterns.md).
- iOS: macOS only; needs full Xcode (not just the command line tools), the iOS rustup targets (`aarch64-apple-ios`, `x86_64-apple-ios`, `aarch64-apple-ios-sim`) and CocoaPods.
- Sidecar missing at bundle time: the file `binaries/name-<target-triple>[.exe]` must exist for the target being built (`rustc --print host-tuple`).

## Updater

- Users stop getting updates after a release: the private key changed or was lost (installed apps only trust the old public key), `pubkey` was set to a path instead of the key's content, the endpoint is not HTTPS in a production build, or the app never calls `check()` (v1's automatic dialog is gone).
- No `.sig` or updater bundle produced: `bundle.createUpdaterArtifacts` is unset, or `TAURI_SIGNING_PRIVATE_KEY` was not available to the build.
- The updater moves to the next entry in `endpoints` only after a non-2xx status.

## After upgrading or migrating

- `Cannot find module '@tauri-apps/api/tauri'` (and `fs`, `dialog`, `shell`, `window`): v1 imports; see versions.md for the module map. `Window` became `WebviewWindow`.
- Capabilities with bare ids like `path:default`: pre-RC ids; use `core:path:default` or `core:default`.
- Windows users lost their local storage after moving from v1: the production origin changed to `http://tauri.localhost`; set `app > windows > useHttpsScheme` to `true` to keep `https`.
- Android files written to the video directory vanished after 2.12: `$VIDEO` and `video_dir()` moved to the app-specific Movies directory.
- Feature missing at runtime after a partial upgrade: `@tauri-apps/api` and `tauri` are on different minors, or a plugin's npm and crate versions differ.
