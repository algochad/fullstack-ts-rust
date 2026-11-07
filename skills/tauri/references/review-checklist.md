# Tauri review checklist

Rewritten for this plugin from the official Tauri v2 docs and sources and the pitfall lists in the community Tauri skills credited in the README. Use it with `/agents-kit:code-review`: flag only what you can show is wrong, not preferences. Security findings follow the `security-audit` skill's Tauri and Rust checklists; Rust language review is the `rust` skill, TypeScript and React review the `typescript` and `react` skills.

## Commands and IPC
- [ ] Every new command is in the single `generate_handler![...]` list, has a unique name, and has a typed frontend wrapper (one module owns names and argument shapes). A rename or removal updated every caller.
- [ ] Commands are thin: logic sits in a plain function with a unit test; no `unwrap`/`expect` on input-dependent paths.
- [ ] Errors are a typed `Serialize` enum (or a deliberate `String`), with no paths, secrets or SQL in the message. The frontend handles the rejection.
- [ ] Argument names match across the boundary (`camelCase` in JS unless `rename_all` says otherwise).
- [ ] Slow or blocking work is `async` (or offloaded); no blocking call in a sync command; async commands do not borrow arguments without returning `Result`.
- [ ] Large or binary results use `tauri::ipc::Response`; streams and progress use a `Channel`; events carry small JSON only.
- [ ] No generic power commands (`read_file(path)`, `run(cmd)`, `eval`); each command does one named job.

## State and concurrency
- [ ] The managed type and the `State<'_, T>` type are identical (a type alias is used); nothing is wrapped in `Arc` for `State`.
- [ ] No `std::sync` guard is held across `.await`; `tokio::sync::Mutex` is used only where the guard spans awaits; no `unwrap()` on a lock in a command.
- [ ] Threads and tasks get an `AppHandle` clone, not a `State`; spawned work stops when the page or app goes away (`Channel::send` error handled, children killed on `RunEvent::Exit`).

## Events and channels
- [ ] Each `listen` has an unlisten on teardown; no listener added per render or mount without cleanup.
- [ ] Global `emit` payloads hold no secrets; `emit_to` is used when only one window should hear it; payloads are `Serialize + Clone`.

## Capabilities and permissions
- [ ] A new plugin call or core API use has the narrowest permission (`allow-<command>` plus a scope) in a capability for the right window label; no `:default` plus a wide scope added only to make a call work.
- [ ] `cargo check` passes after the capability change (typos and unknown plugins fail the build script).
- [ ] New windows have a label a capability covers and are not covered by a wildcard that grants more than they need; `platforms` keeps desktop-only permissions out of mobile files.
- [ ] Own commands that only some windows may call are restricted with `AppManifest::commands`.

## Plugins and sidecars
- [ ] A plugin has its crate registered, its npm twin at the exact same version, and a permission; `single-instance` is registered first; desktop-only plugins sit behind `#[cfg(desktop)]`.
- [ ] A new plugin was justified (reuse or native mobile code); otherwise the code is a module in the app.
- [ ] Sidecars: `externalBin` entry, one binary per target triple, spawned from a Rust command with validated arguments, killed on exit; no frontend strings reach a shell; capability `args` are fixed or validated, not `true`.

## Frontend
- [ ] Imports come from `@tauri-apps/api/core`, `/event`, `/webviewWindow`, `/path` and `@tauri-apps/plugin-*`; no v1 paths; `withGlobalTauri` stays off.
- [ ] Code that can run outside the app (tests, a browser build) guards with `isTauri()` or runs behind mocked IPC.
- [ ] Vite keeps the fixed port equal to `devUrl`, `TAURI_DEV_HOST`, the platform `build.target` and `frontendDist`; the frontend emits static files.
- [ ] No secrets in the bundle or `tauri.conf.json`; CSP unchanged or tightened (see the `security-audit` skill).

## Mobile and platforms
- [ ] `lib.rs` keeps `#[cfg_attr(mobile, tauri::mobile_entry_point)]`; `main.rs` only calls `run()`; `[lib]` has all three crate types.
- [ ] Desktop-only code (updater, tray, menus, global shortcuts, window management) is behind `cfg(desktop)` or a platform-scoped capability; paths come from `app.path()`.
- [ ] Native mobile commands do not block the main thread; Android/iOS permission strings and manifest entries are present for any new device capability.

## Updater, bundling, config
- [ ] No private signing key, password or certificate in the repo; the key comes from CI secrets; `pubkey` is the key content; endpoints are HTTPS; `createUpdaterArtifacts` is set.
- [ ] Release profile unchanged or justified; no `devtools` feature in a release build meant for the macOS App Store.
- [ ] `tauri` and `@tauri-apps/api` are on the same minor; plugin crates and npm packages match exactly; `Cargo.lock` is committed and `target/` is not.
- [ ] Platform config files and `--config` overlays replace arrays whole: any array overridden there repeats everything it must keep.

## Tests and verification
- [ ] New behavior has a Rust unit test or a frontend test that fails without the change; wiring that matters has a `tauri::test` case; frontend tests clear mocks.
- [ ] The report lists what could not be verified headlessly (real webview behavior, native dialogs, tray and menus, deep links, updater, sidecars, signing, devices and emulators) instead of implying it ran.
- [ ] `cargo check`, `cargo clippy -- -D warnings`, `cargo test`, `tsc --noEmit` and the frontend tests ran, with output from this change.

## Versions
- [ ] The code fits the project's Tauri line (2.x APIs, `core:` permission ids, no v1 imports, nothing from the 3.0 alpha). See versions.md.
