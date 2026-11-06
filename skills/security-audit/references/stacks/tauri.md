# Tauri (v2, desktop and mobile)

Audit checklist from the Tauri v2 security docs (capabilities, permissions, scopes, CSP). Trust model: Rust core and plugins have full system access; the WebView frontend is constrained to what the IPC layer exposes. The IPC boundary is where most findings live.

## Capabilities and permissions (`src-tauri/capabilities/*.json|toml`)
- Every file in `capabilities/` is enabled by default. Check that sample or dev capabilities aren't shipped, or restrict with `app.security.capabilities` in `tauri.conf.json`.
- Least privilege per window: flag broad grants (`fs:default` plus write scopes, `shell:allow-execute`, `shell:allow-open` with permissive patterns, `core:window:*`, `http:default` with `**`, `opener`, `process:allow-exit`, `os`, `dialog`) the window doesn't need. Each permission is `<plugin>:<permission>`.
- Window scoping uses `windows` labels, not titles. A window listed in several capabilities gets the union. Window creation should only be exposed to higher-privileged windows.
- `remote.urls`: lets remote origins call IPC. Flag wildcards, `http://`, user-controllable domains, and any use on Linux/Android where an embedded iframe can't be told apart from the window.
- `platforms`: keep desktop-only permissions out of mobile capabilities and vice versa.
- By default every registered command is callable from every window. Check `AppManifest::commands` in `build.rs` where windows differ in trust.

## Custom commands (`#[tauri::command]`)
- Treat every argument as untrusted input from the WebView. A compromised frontend (XSS, malicious dependency, remote content) can call any exposed command with any arguments.
- Path arguments: canonicalize and verify the result is inside an allowed base directory; reject `..`, absolute paths, and symlink escapes. Don't `fs::read`/`write`/`remove` a frontend-supplied path directly. Enforce the plugin scope in your own command; scopes are not applied to your code automatically ("command developers need to ensure no scope bypasses").
- Process execution: `std::process::Command` with frontend-built strings, shell invocation (`sh -c`, `cmd /C`, `powershell`), or arbitrary program name. Use a fixed program and an argument allowlist; never go through a shell.
- URL fetching from the backend with a frontend-supplied URL: SSRF to host and protocol; restrict to an allowlist.
- SQL and file-format parsing inside commands: parameterize queries; bound input size.
- Don't expose generic power commands (`run(cmd)`, `read_file(path)`, `eval(js)`, `get_env()`); expose narrow, purpose-specific ones.
- Errors returned to the frontend must not contain secrets, full paths, or stack traces. Serialize a safe error type.
- Long-lived state behind `Mutex`: check lock ordering and that no `unwrap()` on user-influenced data can panic and poison it.

## Scopes
- Deny beats allow. Check that the webview data directory is denied (on Windows `$APPLOCALDATA/EBWebView/**`; on Linux the whole `$APPLOCALDATA` tree), and that broad allow globs (`$HOME/**`, `**`) aren't granted.
- http scope should list exact hosts; shell scope exact commands and argument validators.

## CSP and frontend
- `csp` must be set in `tauri.conf.json` (`app.security.csp`); without it there is no CSP protection. Tauri adds nonces and hashes for bundled code. Flag `'unsafe-eval'`, `'unsafe-inline'` in `script-src`, remote script hosts or CDNs, `*`, and `connect-src` to anything untrusted. `'wasm-unsafe-eval'` is acceptable for WebAssembly frontends.
- `dangerousDisableAssetCspModification`, `dangerousRemoteDomainIpcAccess`-style options, `withGlobalTauri: true` (exposes the API to every script on the page), and `freezePrototype` off.
- Isolation pattern for apps that load third-party or user content: consider enabling it so every IPC message passes through a sandboxed layer.
- The frontend is still a web app: XSS (`innerHTML`, `dangerouslySetInnerHTML`, rendering untrusted Markdown or HTML), `window.open`, navigation to remote URLs, `target=_blank` links without `rel`, and `<webview>`/iframe content. XSS in a Tauri app can become native code execution through permissive commands.
- Deep links (`tauri-plugin-deep-link`) and single-instance forwarding: treat the URL and args as untrusted; validate before acting. The updater: signed updates with `pubkey` configured, HTTPS endpoints, private signing key kept out of the repo.

## Secrets and storage
- No secrets in the frontend bundle or `tauri.conf.json`. Store credentials in the OS keychain (`keyring`, `tauri-plugin-stronghold`, or Keychain/Keystore on mobile), not plain files or `tauri-plugin-store` JSON.
- Check what the app writes to disk and logs (paths, tokens, PII), and file permissions on created files.
- Mobile (Android/iOS): same checks as expo-react-native.md for backups, cleartext traffic, exported components, and deep links.

## Out of the framework's scope
Tauri's model doesn't protect against insecure Rust code, overly lax scopes, wrong scope checks in custom commands, or deliberate bypasses from Rust. Review those by hand. See rust.md.
