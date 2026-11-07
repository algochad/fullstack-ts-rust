# Tauri patterns

Rewritten for this plugin from the official Tauri v2 docs (v2.tauri.app) and the tauri-apps/tauri 2.12 sources, with ideas from the community Tauri skills credited in the README (julien-blanchon/Montelimar, travisjneuman/.claude, mukiwu/tempo-term, j4flmao/agent-skills). Names (`notes`, `app_lib`) are examples; use the project's own.

## Skeleton: lib.rs, main.rs, Cargo.toml

```rust
// src-tauri/src/lib.rs
mod commands;
mod error;
mod notes; // plain logic, no tauri imports
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::notes::save_note, // one list; a second invoke_handler call replaces it
        ])
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```rust
// src-tauri/src/main.rs: leave as is; app_lib is [lib] name
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run();
}
```

```toml
# src-tauri/Cargo.toml (excerpt)
[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = "2"

[dependencies]
tauri = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"

[dev-dependencies]
tauri = { version = "2", features = ["test"] } # enables tauri::test for cargo test only
```

## Command, plain logic, typed error

The rule is: logic in a plain function you can test with `cargo test`, the command only translates.

```rust
// src-tauri/src/notes.rs: no tauri imports
pub fn normalize_title(raw: &str) -> Option<String> {
    let t = raw.trim();
    (!t.is_empty() && t.chars().count() <= 120).then(|| t.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_blank_titles() {
        assert_eq!(normalize_title("   "), None);
    }

    #[test]
    fn trims_titles() {
        assert_eq!(normalize_title("  plan ").as_deref(), Some("plan"));
    }
}
```

```rust
// src-tauri/src/error.rs
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("the title must not be empty or longer than 120 characters")]
    InvalidTitle,
    #[error("state is unavailable")]
    Poisoned,
}

#[derive(serde::Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
enum ErrorKind {
    InvalidTitle(String),
    Poisoned(String),
}

// Errors must be Serialize to reach the frontend; this emits { kind, message }.
impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let message = self.to_string();
        let kind = match self {
            Self::InvalidTitle => ErrorKind::InvalidTitle(message),
            Self::Poisoned => ErrorKind::Poisoned(message),
        };
        kind.serialize(serializer)
    }
}
```

```rust
// src-tauri/src/state.rs
use std::{collections::HashMap, sync::Mutex};
pub type AppState = Mutex<HashMap<String, String>>; // use this alias everywhere, never Mutex<AppState>

// src-tauri/src/commands/notes.rs
use tauri::State;
use crate::{error::Error, notes, state::AppState};

// async + State<'_, T> is only allowed because the return type is a Result
#[tauri::command]
pub async fn save_note(state: State<'_, AppState>, title: String, body: String) -> Result<usize, Error> {
    let title = notes::normalize_title(&title).ok_or(Error::InvalidTitle)?;
    let mut notes = state.lock().map_err(|_| Error::Poisoned)?; // no .await while this guard lives
    notes.insert(title, body);
    Ok(notes.len())
}
```

Frontend side, one module that owns the command names and argument shapes:

```ts
// src/lib/ipc.ts
import { invoke } from '@tauri-apps/api/core';

export type IpcError = { kind: 'invalidTitle' | 'poisoned'; message: string };

export const isIpcError = (e: unknown): e is IpcError =>
  typeof e === 'object' && e !== null && 'kind' in e && 'message' in e;

// Rust `title`, `body` arrive as the same camelCase keys
export function saveNote(title: string, body: string): Promise<number> {
  return invoke<number>('save_note', { title, body });
}
```

## State beyond the basics

```rust
// Hold a guard across .await: tokio's mutex (add tokio to Cargo.toml)
pub type Db = tokio::sync::Mutex<Connection>;

#[tauri::command]
async fn find(db: tauri::State<'_, Db>, id: i64) -> Result<Row, Error> {
    let conn = db.lock().await;
    conn.fetch(id).await // fine: the tokio guard may span the await
}
```

```rust
// Outside a command: move an AppHandle (cheap to clone), read the state from it
use tauri::{AppHandle, Emitter, Manager};

fn start_ticker(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let state = app.state::<std::sync::Mutex<u32>>();
        let n = match state.lock() {
            Ok(mut c) => { *c += 1; *c } // guard dropped at the end of this block
            Err(_) => break,
        };
        let _ = app.emit("tick", n);
    });
}
```

## Streaming with a channel, events with cleanup

```rust
use tauri::ipc::Channel;

#[derive(Clone, serde::Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase", rename_all_fields = "camelCase")]
enum DownloadEvent {
    Progress { downloaded: u64, total: u64 },
    Finished,
}

#[tauri::command]
async fn download(url: String, on_event: Channel<DownloadEvent>) -> Result<(), Error> {
    // validate `url` (allowlist) before fetching; then, per chunk:
    if on_event.send(DownloadEvent::Progress { downloaded: 1024, total: 4096 }).is_err() {
        return Ok(()); // the page is gone: stop working
    }
    let _ = on_event.send(DownloadEvent::Finished);
    Ok(())
}
```

```ts
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type DownloadEvent =
  | { event: 'progress'; data: { downloaded: number; total: number } }
  | { event: 'finished' };

const onEvent = new Channel<DownloadEvent>();
onEvent.onmessage = (m) => {
  if (m.event === 'progress') setProgress(m.data.downloaded / m.data.total);
};
await invoke('download', { url, onEvent }); // argument key is the Rust name in camelCase

// Events: keep the unlisten function and call it on teardown, even if teardown runs first
const unlisten = listen<number>('tick', (e) => render(e.payload));
export const stop = () => void unlisten.then((fn) => fn());
```

## Capabilities

`src-tauri/capabilities/main.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main",
  "description": "Permissions for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open",
    { "identifier": "fs:allow-write-text-file", "allow": [{ "path": "$APPDATA/notes/*" }] }
  ]
}
```

`src-tauri/capabilities/mobile.json` keeps mobile-only plugin permissions out of the desktop file:

```json
{
  "$schema": "../gen/schemas/mobile-schema.json",
  "identifier": "mobile",
  "windows": ["main"],
  "platforms": ["iOS", "android"],
  "permissions": ["biometric:allow-authenticate"]
}
```

Restricting your own commands to the windows that list them (without this every window may call every command):

```rust
// src-tauri/build.rs
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["save_note"])),
    )
    .expect("failed to run tauri-build");
}
```

Each listed command now has `allow-save-note` and `deny-save-note` permissions; reference `allow-save-note` (no plugin prefix) in the capability of the windows that may call it. After any capability or manifest edit run `cargo check` in `src-tauri`: a wrong identifier fails the build script.

## A plugin

`tauri plugin new <name>` scaffolds this (add `--no-api` to skip the npm package, `--android` or `--ios` for native code).

```rust
// build.rs: every name in COMMANDS gets allow-<name> and deny-<name> permissions
const COMMANDS: &[&str] = &["upload"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
```

```rust
// src/lib.rs
use tauri::{plugin::{Builder, TauriPlugin}, Runtime};

mod commands;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("uploader") // lowercase ASCII, digits, hyphens; no underscore
        .invoke_handler(tauri::generate_handler![commands::upload])
        .build()
}
```

```toml
# permissions/default.toml: what `uploader:default` grants
"$schema" = "schemas/schema.json"
[default]
description = "Allows uploading files"
permissions = ["allow-upload"]
```

The JS binding calls `invoke('plugin:uploader|upload', { url, onProgress })`. A command that reads a scope takes `CommandScope<'_, Entry>` or `GlobalScope<'_, Entry>`; check both. Commands that need `AppHandle` or `Window` in a plugin are generic: `AppHandle<R>` with `R: Runtime`. For a plugin that lives inside the app crate use `tauri_build::InlinedPlugin` with `Attributes::plugin(name, ...)` in `build.rs`.

## A sidecar run from Rust

```rust
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};
use tauri::{Emitter, Manager};
use std::sync::Mutex;

type Sidecar = Mutex<Option<CommandChild>>; // managed, so the exit hook can kill it

#[tauri::command]
async fn start_tool(app: tauri::AppHandle, input: String) -> Result<(), Error> {
    // validate `input` against what the tool accepts before it reaches args()
    let (mut rx, child) = app.shell().sidecar("my-sidecar")?.args(["--input", &input]).spawn()?;
    *app.state::<Sidecar>().lock().map_err(|_| Error::Poisoned)? = Some(child);
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(line) = event {
                let _ = app.emit("tool-output", String::from_utf8_lossy(&line).into_owned());
            }
        }
    });
    Ok(())
}

// in run(): .manage(Sidecar::default()), then build and run with an exit hook
//   tauri::Builder::default()...build(tauri::generate_context!())?.run(|app, event| {
//       if let tauri::RunEvent::Exit = event {
//           if let Some(child) = app.state::<Sidecar>().lock().ok().and_then(|mut c| c.take()) {
//               let _ = child.kill();
//           }
//       }
//   });
```

`Error` needs a `Shell(#[from] tauri_plugin_shell::Error)` variant for the `?`s. The binary and its `-<target-triple>` copies sit next to the path in `bundle.externalBin`.

## Tests

Rust wiring test with the mock runtime (no native webview). The commands under test must not name `AppHandle` or `WebviewWindow` without `<R: Runtime>`; `State` and plain arguments need nothing special.

```rust
#[cfg(test)]
mod tests {
    use tauri::{ipc::{CallbackFn, InvokeBody}, test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY}, webview::InvokeRequest, WebviewWindowBuilder};

    #[test]
    fn save_note_rejects_a_blank_title() {
        let app = mock_builder()
            .manage(crate::state::AppState::default())
            .invoke_handler(tauri::generate_handler![crate::commands::notes::save_note])
            .build(mock_context(noop_assets()))
            .expect("failed to build app");
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();

        let res = get_ipc_response(&webview, InvokeRequest {
            cmd: "save_note".into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(), // "tauri://localhost" also works
            body: InvokeBody::Json(serde_json::json!({ "title": "  ", "body": "x" })),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        });
        assert!(res.is_err()); // the command rejected: it returned Error::InvalidTitle
    }
}
```

Frontend unit test with mocked IPC (vitest; jest is the same). `mockIPC` replaces `invoke` entirely, so it checks your frontend and the command name and arguments, not the Rust side or any permission.

```ts
import { afterEach, beforeAll, expect, test } from 'vitest';
import { randomFillSync } from 'node:crypto';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { saveNote } from './ipc';

beforeAll(() => {
  // jsdom has no WebCrypto, and mockIPC needs getRandomValues
  Object.defineProperty(window, 'crypto', { value: { getRandomValues: (b: any) => randomFillSync(b) } });
});
afterEach(() => clearMocks()); // otherwise mocks leak between tests

test('saveNote sends both fields to save_note', async () => {
  const calls: unknown[] = [];
  mockIPC((cmd, args) => { calls.push([cmd, args]); return 1; });
  await expect(saveNote('plan', 'text')).resolves.toBe(1);
  expect(calls).toEqual([['save_note', { title: 'plan', body: 'text' }]]);
});
```

For events, `mockIPC(handler, { shouldMockEvents: true })` (2.7+) lets `emit` reach `listen` in the same test; `emitTo` is not supported.

Running the real UI in a headless browser: install the mock before the app mounts, in a dev-only switch. Avoid top-level await (the documented Vite targets, `safari13` among them, reject it).

```ts
// src/main.ts
async function bootstrap() {
  if (import.meta.env.VITE_MOCK_IPC === '1') {
    const { mockIPC, mockWindows } = await import('@tauri-apps/api/mocks');
    mockWindows('main');
    mockIPC((cmd, args) => fakeBackend(cmd, args)); // canned answers for the screens under test
  }
  await import('./app'); // the module that mounts the UI
}
void bootstrap();
```

Start the dev server on a free port (`VITE_MOCK_IPC=1 npx vite --port 5199 --strictPort`), point the headless Playwright server at `http://localhost:5199`, and stop the server when done. This proves the UI against canned data; it does not prove the Rust side.

## Vite and Cargo config

```ts
// vite.config.ts (from the Tauri docs)
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false, // keep Rust errors visible
  server: {
    port: 5173, // must match build.devUrl in tauri.conf.json
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

The matching `build` section of `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  }
}
```

```toml
# src-tauri/Cargo.toml: release size profile from the Tauri docs
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"   # "3" if speed matters more than size
panic = "abort"   # any panic then ends the process
strip = true
```

```toml
# .cargo/config.toml: Android 16 KB page alignment when NDK 28+ is not used
[target.aarch64-linux-android]
rustflags = ["-C", "link-arg=-Wl,-z,max-page-size=16384"]
```
