# Rust versions: what changed

Rewritten for this plugin from the Rust release notes (RELEASES.md), the Edition Guide, the Cargo book, the Rust Reference, the Rust API Guidelines, the Tokio and tracing docs, the clippy lint list and crates.io.

Verified on 2026-11-07. Current stable is **Rust 1.99.1** (released 2026-10-15; 1.99.0 came out 2026-10-01). The verifying machine ran rustc 1.99.1 (58cf8f9c3 2026-10-13), cargo 1.99.1 and clippy 0.1.99. Beta is 1.100.0-beta.12; the six-week release train (epoch 1.5.0 on 2015-12-10, from the Rust forge schedule script) puts 1.100.0 on 2026-11-12. The newest edition is **2024**, stable since 1.85.0; the Edition Guide lists nothing later. When the project's toolchain, edition or MSRV is older than the code you are about to write, check here first.

Sources: [RELEASES.md](https://github.com/rust-lang/rust/blob/master/RELEASES.md), [stable manifest](https://static.rust-lang.org/dist/channel-rust-stable.toml) and [beta manifest](https://static.rust-lang.org/dist/channel-rust-beta.toml), [Edition Guide](https://doc.rust-lang.org/edition-guide/), [Cargo book](https://doc.rust-lang.org/stable/cargo/), [Reference](https://doc.rust-lang.org/reference/), [API Guidelines checklist](https://rust-lang.github.io/api-guidelines/checklist.html) (repo last updated 2025-07-08), [crates.io](https://crates.io).

## Point releases matter

Recent patch releases fixed miscompilations and CVEs, so stay on the latest patch of the current stable: 1.99.1 (miscompilation of FFI `bool` return values on x86_64), 1.98.1 (miscompilation when generating vtables), 1.97.1 (an LLVM miscompilation), 1.96.1 (a MIR-optimization miscompilation, plus libssh2 CVE patches in Cargo).

## Editions

Editions so far: 2015, 2018, 2021, 2024. Crates on different editions interoperate; each crate migrates on its own with `cargo fix --edition`. `cargo new` picks the newest stable edition.

**Edition 2024** (Rust 1.85.0, 2025-02-20), as listed in the Edition Guide:
- **Language:** return-position `impl Trait` captures all in-scope generic parameters, lifetimes included, unless a `use<..>` bound says otherwise (the `Captures` and outlives tricks can go). `if let` temporaries drop before the `else` branch. Tail-expression temporaries drop before locals. Let chains in `if` and `while` (stabilized in 1.88.0, edition 2024 only). Match ergonomics reservations: no `mut`, `ref`, `ref mut` or `&` inside a pattern that relies on default binding modes. `gen` is a reserved keyword; `#"foo"#` and two or more `#` are reserved syntax. The `expr` macro fragment also matches `const { }` and `_` (`expr_2021` keeps the old meaning).
- **Unsafe:** `unsafe extern` blocks are required (items may be marked `safe` or `unsafe`); `#[unsafe(no_mangle)]`, `#[unsafe(export_name)]` and `#[unsafe(link_section)]` are required; `unsafe_op_in_unsafe_fn` warns by default; `static_mut_refs` is deny by default; `std::env::set_var`, `std::env::remove_var` and `CommandExt::before_exec` are `unsafe` functions.
- **Never type:** fallback to `!` instead of `()`. The Edition Guide now says this is no longer edition-specific as of Rust 1.100, which is still in beta.
- **Standard library:** `Future` and `IntoFuture` join the prelude (a method named `poll` from your own trait can become ambiguous); `Box<[T]>` `.into_iter()` yields values.
- **Cargo:** `edition = "2024"` implies `resolver = "3"`. These spellings are errors now: `[project]`, `default_features`, `crate_type`, `proc_macro`, `dev_dependencies`, `build_dependencies` (use `[package]` and the hyphenated names). `default-features` on an inherited workspace dependency is ignored (editions before 2024) or was rejected (Rust 1.85 through 1.98); from Rust 1.99 it overrides the workspace value.
- **Tools:** rustdoc combines doctests into one binary; rustfmt has `style_edition`, version sorting and raw-identifier sorting.

## Language and standard library since 1.80

| Version | Date | What changed |
|---|---|---|
| 1.80 | 2024-07-25 | `LazyCell` and `LazyLock` stable; exclusive range patterns; Cargo checks `cfg` names always |
| 1.81 | 2024-09-05 | `#[expect]` lint level; uncaught panics in `extern "C"` functions abort |
| 1.82 | 2024-10-17 | `unsafe extern` blocks; `&raw const` and `&raw mut`; `#[unsafe(..)]` attributes; `use<..>` precise capturing; `Option::is_none_or`; `cargo info` |
| 1.83 | 2024-11-28 | `&mut` and `&Cell` allowed in `const`; references to statics in const initializers |
| 1.84 | 2025-01-09 | Cargo resolver version 3 and the MSRV-aware resolver config |
| 1.85 | 2025-02-20 | Edition 2024; async closures (`AsyncFn`, `AsyncFnMut`, `AsyncFnOnce` in the prelude of every edition); `#[diagnostic::do_not_recommend]` |
| 1.86 | 2025-04-03 | trait upcasting (`&dyn Sub` to `&dyn Super`); safe functions may carry `#[target_feature]`; `cargo login <token>` argument deprecated |
| 1.87 | 2025-05-15 | `use<..>` bounds on return-position `impl Trait` in traits |
| 1.88 | 2025-06-26 | let chains (edition 2024); naked functions; `cfg(true)` and `cfg(false)`; `#[bench]` is a hard error; Cargo automatic cache garbage collection |
| 1.89 | 2025-08-07 | explicit inferred const arguments (`_`); `mismatched_lifetime_syntaxes` warns; `dangerous_implicit_autorefs` deny; doctests run when cross-compiling |
| 1.90 | 2025-09-18 | lld is the default linker on `x86_64-unknown-linux-gnu`; Cargo multi-package publishing |
| 1.91 | 2025-10-30 | `build.build-dir`; `--target host-tuple`; `dangling_pointers_from_locals` and `integer_to_ptr_transmutes` lints |
| 1.92 | 2025-12-11 | Cargo book chapter "Optimizing Build Performance"; `RwLockWriteGuard::downgrade`; two never-type lints deny by default |
| 1.93 | 2026-01-22 | `deref_nullptr` deny by default; `#[test]` on a non-function is an error; `cargo clean --workspace`; `std::fmt::from_fn` |
| 1.94 | 2026-03-05 | Cargo config `include`; TOML v1.1 accepted in manifests (using it raises your development MSRV); `pubtime` in the registry index; `LazyCell::get` and `LazyLock::get`; `<[T]>::array_windows`; closure captures around patterns changed |
| 1.95 | 2026-04-16 | `if let` guards on match arms; `cfg_select!`; `core::range` types; `Vec::push_mut`; `irrefutable_let_patterns` no longer fires on let chains |
| 1.96 | 2026-05-28 | `assert_matches!` and `debug_assert_matches!`; a dependency may name both a git repository and a registry |
| 1.97 | 2026-07-09 | Cargo `build.warnings` (replaces `-Dwarnings`), `resolver.lockfile-path`, `-m` for `--manifest-path`; v0 symbol mangling by default; `std::char` constants and functions deprecated |
| 1.98 | 2026-08-20 | `bool::ok_or`, `bool::ok_or_else`, `Option::map_or_default`, `Result::map_or_default`, `Path::is_empty`; deny-by-default `invalid_runtime_symbol_definitions`; `repr(transparent)` stricter |
| 1.99 | 2026-10-01 | Cargo `debug` profile; edition-2024 `default-features` override on inherited dependencies; incremental compilation off by default when `CI` is set; legacy integer modules (`std::i32::MAX`) fully deprecated; C-variadic function definitions; LLVM 23 |

Older features the code above relies on: `let ... else` (1.65.0), `OnceCell` and `OnceLock` (1.70.0), Cargo `[lints]` (1.74.0), `async fn` and return-position `impl Trait` in traits (1.75.0), workspace inheritance (`[workspace.package]`, `[workspace.dependencies]`; Cargo book says 1.64+).

## Cargo

- **Resolver versions** (Cargo book): `"1"` is the default without an edition hint; `"2"` is the edition 2021 default and stops unifying features of build-dependencies, proc-macros and (unless a target needs them) dev-dependencies with normal dependencies; `"3"` is the edition 2024 default, needs Rust 1.84+, and changes `resolver.incompatible-rust-versions` from `allow` to `fallback` so Cargo prefers dependency versions compatible with your `rust-version`. A virtual workspace has no edition to infer from and must set `resolver` in `[workspace]`.
- **Features** are unified: Cargo builds a dependency once with the union of all requested features, also across workspace members built together (`--workspace`, repeated `-p`). Features must be additive.
- **Workspace inheritance:** `[workspace.package]` keys (authors, edition, license, rust-version, version and others) via `key.workspace = true`; `[workspace.dependencies]` (not optional; features add up); `[workspace.lints]` via `[lints] workspace = true` (1.74+).
- **Profile defaults:** dev is opt-level 0, debug on, incremental on, 256 codegen units; release is opt-level 3, debug off, `lto = false` (thin local LTO), 16 codegen units, `panic = "unwind"`, overflow checks off, `strip = "none"`. `lto` accepts `false`, `"off"`, `"thin"`, `true` or `"fat"`. Tests, benches, build scripts and proc macros ignore the `panic` setting. Profiles in workspace members are ignored. 1.99 adds a built-in `debug` profile (identical to `dev` for now).
- **Config:** `build.warnings` (1.97) controls how lint warnings from local packages are treated, replacing `-Dwarnings` in CI; `include` (1.94); `build.build-dir` (1.91); `resolver.lockfile-path` (1.97).
- **Still nightly-only** in the 1.98 Cargo changelog, so not for project code: `-Zscript` (cargo script), `-Zcargo-lints`, `-Zmin-publish-age`. `-Zminimal-versions` and `-Zdirect-minimal-versions` are also unstable. JSON target specs were destabilized in 1.95.

## Crates

From the crates.io API on 2026-11-07, plus the Tokio repository.

| Crate | Current | Updated | Notes |
|---|---|---|---|
| tokio | 1.54.1 | 2026-10-21 | MSRV 1.85 (rolling policy, at least 6 months old); LTS lines 1.51.x (until March 2027) and 1.53.x (until September 2027), both MSRV 1.71 |
| serde | 1.0.229 | 2026-07-18 | no 2.0 |
| thiserror | 2.0.21 | 2026-09-23 | 2.0 (2024-11-06): `{r#type}` in messages becomes `{type}`; a direct `thiserror` dependency is required wherever `derive(Error)` is used; `default-features = false` disables `std` |
| anyhow | 1.0.104 | 2026-07-18 | |
| tracing | 0.1.44 | 2025-12-18 | with tracing-subscriber 0.3.23 (2026-03-13); `EnvFilter` needs its `env-filter` feature |
| clap | 4.6.7 | 2026-09-14 | |

Other tools and crates checked as current on crates.io: rayon 1.12.0, proptest 1.12.0, insta 1.49.0, criterion 0.8.2, divan 0.1.21, cargo-nextest 0.9.151, cargo-deny 0.20.2, cargo-audit 0.22.2, cargo-llvm-cov 0.9.1, cargo-fuzz 0.13.2, cargo-semver-checks 0.51.0, cargo-hack 0.6.46, cargo-expand 1.0.127, mockall 0.15.0, rstest 0.28.0, tokio-util 0.7.20.

## Facts from the docs that the skill leans on

- **Dyn compatibility** (the Reference's new name for object safety): a trait with an `async fn` method or a return-position `impl Trait` method is not dyn compatible unless the method has `where Self: Sized`; `AsyncFn`, `AsyncFnMut` and `AsyncFnOnce` are not dyn compatible.
- **Tokio docs:** `Receiver::recv`, `watch::Receiver::changed`, `TcpListener::accept`, `AsyncReadExt::read` and `AsyncWriteExt::write` are cancel safe in `select!`; `read_exact`, `read_to_end`, `read_to_string`, `write_all`, `Mutex::lock`, `RwLock::read` and `write`, `Semaphore::acquire` and `Notify::notified` are not. The std `Mutex` is fine, and often preferred, in async code when the guard is not held across `.await`. `spawn_blocking` is for bounded work; a started blocking task cannot be aborted and runtime shutdown waits for it. Graceful shutdown: detect, tell with `CancellationToken`, wait with `TaskTracker`.
- **tracing docs:** holding the guard from `Span::enter` or `Span::entered` across `.await` produces incorrect traces.
- **Clippy 0.1.99 defaults:** `await_holding_lock`, `await_holding_refcell_ref`, `incompatible_msrv` warn; `lint_groups_priority` denies; allow by default: `unwrap_used`, `expect_used`, `panic`, `todo`, `dbg_macro`, `indexing_slicing`, `arithmetic_side_effects`, `undocumented_unsafe_blocks` (restriction), `redundant_clone`, `needless_collect` (nursery), `cast_possible_truncation`, `manual_let_else`, `unused_async`, `large_futures`, `missing_errors_doc`, `non_std_lazy_statics` (pedantic).

## Deprecated or removed patterns

| Pattern | Use instead | Since |
|---|---|---|
| `std::i32::MAX`, `std::u8::MAX` (legacy integer modules) | `i32::MAX`, `u8::MAX` | fully deprecated in 1.99 |
| `std::char` constants and functions | the associated items on `char` | deprecated in 1.97 |
| `lazy_static!`, `once_cell::sync::Lazy` | `std::sync::LazyLock` (`LazyCell` single-threaded); `OnceLock` for set-once | 1.80 (clippy `non_std_lazy_statics`) |
| `#[bench]` and the libtest bench harness | criterion or divan | hard error since 1.88 |
| `extern "C" { }` without `unsafe` | `unsafe extern "C" { }` | allowed 1.82, required in edition 2024 |
| bare `#[no_mangle]`, `#[export_name]`, `#[link_section]` | `#[unsafe(no_mangle)]` and friends | required in edition 2024 |
| references to `static mut` | `Mutex`, atomics, `UnsafeCell` wrappers, or `&raw` | `static_mut_refs` denies in edition 2024 |
| safe call to `std::env::set_var` | an `unsafe` block with a proof, or no mutation of the environment | edition 2024 |
| unsafe operations directly in an `unsafe fn` body | an explicit `unsafe { }` block | warns in edition 2024 |
| `[dev_dependencies]`, `default_features`, `crate_type`, `proc_macro`, `[project]` | hyphenated names, `[package]` | errors in edition 2024 |
| `#[allow(lint)]` for a lint you expect to fix | `#[expect(lint, reason = "..")]` | 1.81 |
| `Captures<'a>` and outlives tricks in `impl Trait` returns | `use<..>` (any edition), or nothing in edition 2024 | 1.82 |
| `async-trait` for traits used only generically | native `async fn` in traits | 1.75 (`dyn` use still needs boxing) |
| `cargo login <token>` | token from stdin or a credential provider | deprecated in 1.86 |
| `#![deny(warnings)]` in source | `[lints]` plus `cargo clippy -- -D warnings` or Cargo `build.warnings` in CI | practice; `build.warnings` is 1.97 |
| "object safe" | "dyn compatible" | terminology in the Reference |
