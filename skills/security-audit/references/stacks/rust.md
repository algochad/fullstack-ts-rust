# Rust

Audit checklist for Rust code (Tauri cores, backends, native modules). Memory-safe Rust removes whole bug classes, so don't report buffer overflows or use-after-free in safe code. Look at what the compiler doesn't check.

## `unsafe` and FFI
- Every `unsafe` block should have a `// SAFETY:` comment stating the invariant. Missing or hand-wavy reasoning is a finding. `unsafe` must be minimal and wrapped in a safe API that can't be misused.
- Common unsound patterns: `transmute` between unrelated types, `from_raw_parts` with unchecked length, `get_unchecked`, `Send`/`Sync` implemented manually on types holding raw pointers or `Rc`, `static mut`, `mem::uninitialized`/`zeroed` on types with invalid zero values, pointers outliving their allocation, aliasing `&mut`.
- FFI boundary: null and length checks on pointers received from C, ownership and `free` pairing (don't free Rust memory with `free`), `CStr`/`CString` NUL handling, no panics unwinding across `extern "C"` (use `catch_unwind` or `extern "C-unwind"`), consistent `repr(C)` layouts. Prefer established binding crates to hand-written FFI. Miri and sanitizers for unsafe-heavy modules.

## Panics as denial of service or worse
- `unwrap()`, `expect()`, indexing `v[i]`, slicing `&s[a..b]` (also panics on non-char boundaries), `RefCell` double borrow, division by zero, and `as` conversions that assume ranges, applied to attacker-controlled data. In a server or Tauri command, a panic can kill the task or poison a `Mutex`. Use `get()`, `checked_*`, `?`, and typed errors. Report only when input is attacker-reachable.

## Integer and conversion bugs
- Arithmetic overflow panics in debug builds but **wraps silently in release** unless `overflow-checks = true`. For sizes, offsets, prices, balances, and allocations from untrusted input use `checked_`, `saturating_`, or `try_from`.
- `as` casts truncate and change sign silently (`u64 as usize`, `i64 as u32`, `usize as i32`). Flag in length, index, and money calculations.
- Unbounded allocation from an untrusted length (`Vec::with_capacity(n)`, `vec![0; n]`, reading a body into memory without a limit).

## Injection and traversal
- `std::process::Command`: argument injection (a user value beginning with `-`), shell invocation via `sh -c` or `cmd /C`, user-chosen program, and `PATH` search on Windows (current directory lookup).
- Paths: `Path::join` with an absolute user path **replaces** the base; `..` components; symlinks; check with `canonicalize` and `starts_with` (and mind TOCTOU). Windows reserved names and UNC paths.
- SQL: use bound parameters (`sqlx::query!`, `?`/`$1` binds). `format!` into a query string is injection.
- Deserialization: `serde` input needs size limits and `#[serde(deny_unknown_fields)]` where strictness matters. Deeply nested input can exhaust the stack. Avoid `bincode`/`rmp` on untrusted data without limits.
- Regex: the `regex` crate is linear time, so regex DoS is not a concern there (it is in other engines).
- Templates and HTML built with `format!` need escaping.

## Crypto, randomness, secrets
- Use audited crates (`ring`, `rustls`, RustCrypto, `argon2`, `subtle`). No custom crypto or hand-rolled constant-time compares: compare secrets with `subtle::ConstantTimeEq`, not `==`.
- Randomness for tokens and keys: `OsRng` or `rand::rngs::ThreadRng` (CSPRNG), not `SmallRng`, seeded-from-time, or `fastrand`.
- `rustls` with `dangerous_configuration` / `danger_accept_invalid_certs(true)` / `native-tls` verification disabled.
- Secrets in memory: `zeroize`/`secrecy` where it matters; secrets must not derive `Debug` or be logged via `{:?}`; don't put secrets in error messages.
- Hardcoded keys and tokens, `const` credentials.

## Concurrency and async
- Data races are impossible in safe code, but logic races remain: check-then-act on files or the database (TOCTOU), lock-order deadlocks, holding a `std::sync::Mutex` guard across `.await`, unbounded channels and task spawning from untrusted input.
- Mutex poisoning after a panic leaves state half-updated; check recovery logic.

## Dependencies and supply chain
- `cargo audit` (RustSec advisories), `cargo deny check` (advisories, licenses, banned and duplicate crates, source restrictions). `Cargo.lock` committed for binaries. Flag git dependencies on moving branches, `build.rs` and proc macros from unvetted crates, and yanked versions. `cargo geiger` shows unsafe in the dependency tree.
- `cargo clippy -- -D warnings` plus the lints `clippy::unwrap_used`, `clippy::indexing_slicing`, `clippy::arithmetic_side_effects`, `clippy::cast_possible_truncation` enabled for code handling untrusted input. `#![forbid(unsafe_code)]` for crates that don't need it.
