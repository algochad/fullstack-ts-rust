---
name: rust
description: Write, review and debug Rust application and library code, including Tauri backends, CLIs and services. Covers detecting the toolchain, edition, MSRV, workspace and features first, Cargo and dependency hygiene, ownership and borrowing, error handling with thiserror and anyhow, API design, traits, async with tokio, concurrency, serde, tracing, unsafe policy, testing, clippy and rustfmt, performance, and reading compiler errors. Use whenever the repo has a Cargo.toml, when adding or changing .rs code, when a borrow checker, trait bound or async error appears, or when reviewing Rust. Security checks are in the security-audit skill's Rust checklist.
---

# Rust

Working practice for Rust application and library code, including Tauri backends, CLIs and services. Follow the project's own conventions first; this skill fills the gaps. Written for this plugin from the official Rust documentation (Reference, Cargo book, Edition Guide, API Guidelines, Tokio docs) and the most-starred community Rust skills (see the credits in the README). Detail lives in `references/`:

- [patterns.md](references/patterns.md): code for layout, errors, API design, borrowing, async, serde, tracing, tests, profiles
- [versions.md](references/versions.md): verified facts for Rust 1.99, edition 2024, Cargo, key crates, and deprecated patterns
- [troubleshooting.md](references/troubleshooting.md): compiler errors, Cargo and tokio failures, how to read them
- [review-checklist.md](references/review-checklist.md): a checklist for reviewing Rust changes

Other skills own their parts, so this one does not repeat them: `agents-kit:security-audit` and its [Rust security checklist](../security-audit/references/stacks/rust.md) (unsafe, FFI, panics as denial of service, casts, injection, crypto, `cargo audit`); `agents-kit:tauri` for Tauri apps (commands, capabilities, state, the frontend bridge); `agents-kit:test-driven-development`, `agents-kit:systematic-debugging` and `agents-kit:verification-before-completion` for process.

## 1. Detect before you write

Read the manifests and config before suggesting anything:
- **Toolchain, edition, MSRV:** `rust-toolchain.toml` (channel, components, targets) or `rustc --version`; `edition` and `rust-version` in `Cargo.toml`, often under `[workspace.package]` and inherited with `edition.workspace = true`. Never use syntax or APIs newer than the declared edition or MSRV: let chains need edition 2024 and Rust 1.88, for example (versions.md). No declared MSRV: assume the installed toolchain, and say so when you lean on a recent feature.
- **Layout:** root `Cargo.toml` (`[workspace]`, `members`, `resolver`, `[workspace.dependencies]`, `[workspace.lints]`), crate kinds (lib, bin, proc-macro, `-sys`), `src-tauri/` (Tauri: use `agents-kit:tauri`).
- **Features:** `[features]`, defaults, and the combinations CI builds (`--all-features`, `--no-default-features`).
- **Stack:** async runtime (tokio, async-std, smol or none), framework (axum, actix-web, tonic), database (sqlx, diesel, sea-orm), error crates (thiserror, anyhow, eyre, snafu), serde, `tracing` or `log`, clap.
- **Quality config:** `clippy.toml`, `[lints]` tables, `rustfmt.toml`, `deny.toml`, `.cargo/config.toml`, `.config/nextest.toml`, and the commands the CI workflow or Makefile runs. Those are the commands to run.
- The nearest existing module or crate is the pattern to copy: error type, test layout, naming, module style. In a repo with `graphify-out/` or `.trail/`, start with `ctx where <thing>`. When the LSP tool lists a rust-analyzer server, use it for definitions, references, hover and diagnostics before grepping.
- You may be a subagent that cannot ask questions. When a choice changes the design (MSRV bump, new dependency, edition migration, public API break), take the conservative option and put the question in your report.

## 2. Layout, workspaces and modules

- Logic in `src/lib.rs`, a thin `src/main.rs` (argument parsing, tracing setup, runtime, exit code): tests, benches and examples can only reach what the library exposes. Modules by domain (`auth/`, `orders/`), not by kind (`models/`, `traits/`).
- A workspace is for crates that build and version together. Split a crate for a second purpose, to cut compile time, or to enforce a dependency direction, not for folder tidiness. One root manifest holds `[workspace.package]` (edition, rust-version, license), `[workspace.dependencies]` (one version per dependency) and `[workspace.lints]`; members opt in with `serde.workspace = true` and `[lints] workspace = true`. A virtual workspace must set `resolver` itself (`"3"` on edition 2024): it has no edition to infer it from.
- Private by default: `pub(crate)` before `pub`, because widening later is not breaking and narrowing is. Re-export the public API from `lib.rs` item by item. Globs only for `use super::*` in tests and a framework's prelude.
- Commit `Cargo.lock` for applications and use `--locked` in CI; a library's lockfile is not used by its dependents. Profiles are read from the root manifest only.

## 3. Features and dependencies

- **Features are additive.** Cargo builds a dependency with the union of every feature asked for, so enabling a feature must never remove an item or change a signature. Names are bare (`std`, `serde`), never `no-std` or `use-serde`. Mutually exclusive features are a design problem: pick at runtime or split the crate.
- **Unification pitfall:** members built together (`--workspace`, repeated `-p`) share one feature set per dependency, so `cargo build -p a` can compile where the workspace build fails, or the reverse. Resolver 2 and later keep build-dependencies, proc-macros and unused dev-dependencies from leaking features into normal builds. On edition 2024, `dep = { workspace = true, default-features = false }` disables defaults only on Rust 1.99+; another member that leaves defaults on still enables them in a combined build.
- Test the matrix a change can affect: default, `--no-default-features`, `--all-features`; `cargo hack --feature-powerset` when the project uses cargo-hack.
- Every dependency costs compile time, binary size and supply-chain exposure (build scripts and proc macros run at build time). Check std first (`LazyLock`, `OnceLock`, `std::thread::scope`, `mpsc`). Turn off default features you do not use. Version ranges (`"1"`, `"1.4"`), never `"*"`.
- Inspect with `cargo tree -d` (duplicate versions), `cargo tree -i <crate>` (who pulls it in), `cargo tree -e features -i <crate>` (why a feature is on), `cargo build --timings`. Use cargo-deny, cargo-audit, cargo-machete or cargo-udeps, and cargo-semver-checks when the project already has them; installing any of them is the user's call.
- **MSRV:** set `rust-version`. Edition 2024 (resolver 3) makes Cargo prefer dependency versions compatible with it; older resolvers can opt in with `incompatible-rust-versions = "fallback"` under `[resolver]` in `.cargo/config.toml`. `cargo update <crate> --precise <ver>` pins around a release that raised its MSRV. Libraries should check their declared lower bounds really build (nightly `-Z minimal-versions` or `-Z direct-minimal-versions`).

## 4. Ownership and borrowing

- **Borrow instead of clone.** Parameters take `&str`, `&[T]`, `&Path` (or `impl AsRef<Path>`), not `&String`, `&Vec<T>`, `&PathBuf`. Take `String` or `Vec<T>` by value only when the function stores or consumes it. A `.clone()` that only quiets the borrow checker is a design smell (later changes to the copy are silently lost). Try first: end the borrow earlier with a block or a named `let`; `std::mem::take`, `mem::replace` or `Option::take` to move a field out of `&mut self`; split a struct so disjoint fields borrow separately; pass ids or indices instead of references; clone small immutable data on purpose, with a comment.
- `Cow<'_, str>` when a function sometimes allocates and sometimes returns its input unchanged. `Arc<str>`, `Box<str>`, `Box<[T]>` for long-lived immutable data.
- `Rc` is single-threaded; `Arc` crosses threads and tasks on a multi-thread runtime. Reach for either only when shared ownership is part of the design, and keep both, `RefCell` and `Box` out of public signatures (a shared service is a cheap-to-clone handle around `Arc<Inner>`).
- **Interior mutability** (`Cell`, `RefCell`, `Mutex`, `RwLock`, atomics) moves checks to run time; `RefCell` panics on a double borrow. Fine for caches, lazy state, and shared state behind a small API. A design problem when it dodges the borrow checker in a web of mutable objects: restructure with ownership, ids into a `Vec` (arena), or message passing.
- **Lifetimes:** rely on elision; name one only when the compiler asks or the name documents a relationship (`'src`, `'conn`). Prefer owned fields: a struct holding `&'a T` forces a lifetime onto every container. Return owned values, not references to locals. `spawn` needs `'static` because the task owns its data, not because anything leaks.

## 5. Errors and panics

- **Libraries** return typed errors: a `thiserror` enum (one variant per cause a caller can act on, `#[from]` or `#[source]` to keep the chain) or an opaque struct with a `kind()`. Never `anyhow::Error`, `Box<dyn Error>`, `String` or `()` in a public `Result`. Errors are `Error + Send + Sync + 'static`; messages lowercase, no trailing period.
- **Applications** (bins, services, Tauri backends) use `anyhow::Result` with `.context("opening config")` or `.with_context(|| ...)` at layer boundaries, and convert to a typed error or response once, at the edge (HTTP status, Tauri command error, exit code). One strategy per crate.
- `?` to propagate; `From` impls make it work; `map_err` only to add meaning. No `let _ = fallible();`, no `.ok()` that discards the reason.
- **No `unwrap()` or `expect()` on a fallible runtime path:** I/O, parsing, user, network or config input, channel results, lookups that can miss. `expect("why this cannot fail")` is right for violated invariants (it firing is a bug), values known at compile time (a regex literal in a `LazyLock`), startup in `main`, tests and examples. Prefer `let Some(x) = opt else { return Err(..) };` and `if let` to `is_some()` followed by `unwrap()`.
- A panic is a bug; an error is an expected failure. Do not panic on bad input and do not use `catch_unwind` as exception handling. Where a panicking convenience exists, document `# Panics` and offer the fallible twin (`v[i]` and `v.get(i)`, `new` and `try_new`). A poisoned lock means another thread panicked mid-update: `.lock().expect("cache lock poisoned")` propagates it; recover with `PoisonError::into_inner` only when the data is valid after any panic.
- `Drop` never fails, panics or blocks; offer `close(self) -> Result<()>` for fallible teardown. Document `# Errors`, `# Panics` and `# Safety` on public items.

## 6. API design

Follow the Rust API Guidelines checklist for public crates; the points that matter most:
- **Naming:** `UpperCamelCase` types, `snake_case` functions, no `get_` prefix on getters (`len()`, `name()`, `name_mut()`); conversions `as_` (cheap borrow), `to_` (costly or owned copy), `into_` (consumes `self`); `iter`, `iter_mut`, `into_iter`; constructors `new`, `with_*`, `try_new`, `from_*`.
- **Common traits eagerly:** `Debug` on every public type, plus `Clone`, `PartialEq`, `Eq`, `Hash`, `Default`, `Display` for errors and text where they fit; `From`, `TryFrom`, `FromStr` instead of `Into` or ad-hoc `from_str`; `Send + Sync` where possible.
- **Make misuse hard:** newtypes for ids and units, enums instead of `bool` flags (no `bool` parameters in public signatures), `Option` for absence, validating constructors (`TryFrom`) so a type that exists is valid, a builder (`Foo::builder()`, `build() -> Result`) past a couple of optional inputs, typestate when a wrong call order must not compile.
- **Evolution:** private fields, `#[non_exhaustive]` on public enums and structs you may extend, sealed traits when downstream impls are unwanted, no third-party types in your API unless re-exported, `#[must_use]` on builders and pure functions. Breaking changes: removing or renaming items, a new variant on an exhaustive enum, a new field on a public-constructible struct, a new trait bound.
- **Parameters:** libraries accept generics at the boundary (`impl AsRef<Path>`, `impl IntoIterator<Item = T>`, `R: Read`); application code uses plain concrete types and avoids speculative generality.
- **Docs:** `///` on every public item with a one-line summary, an `# Examples` doctest using `?` (not `unwrap`), and `# Errors`, `# Panics`, `# Safety` as they apply.

## 7. Traits, generics, iterators

- Prefer, in order: a concrete type; generics (`T: Trait`, `impl Trait`: static dispatch, inlined, more code); `dyn Trait` (heterogeneous collections, plugin points, smaller binaries; box at the boundary). A trait is for polymorphism or an extension API, not for organizing code.
- **Dyn compatibility** (formerly object safety): generic methods, `Self` outside the receiver, `async fn` and return-position `impl Trait` break it; `where Self: Sized` excludes a method. `async fn` in traits (stable since 1.75) works with generics, but such a trait cannot be `dyn`; for `dyn` use the `async-trait` crate (boxed futures) or an enum of implementations.
- Few required methods, defaults for the rest. Bounds on `impl` blocks, not on struct definitions. Associated types when each implementor has one choice, generics when one type can implement the trait many ways.
- **Iterators:** lazy chains for short pipelines, a `for` loop when the body is long or exits early; collect into `Result<Vec<_>, E>` and apply `?`; no intermediate `collect()` and no `.clone()` inside closures without a reason. Closure bounds: the most general that works (`FnOnce`, then `FnMut`, then `Fn`). `move` closures for threads and tasks, with cloned handles bound in a block just before.
- `macro_rules!` only when functions and generics cannot do the job; derives are fine. `cargo expand` shows the output (needs a nightly toolchain installed).

## 8. Async with tokio

- Use the runtime the project uses. Libraries do not spawn or pick a runtime; they take the caller's I/O types and futures.
- **Never block the executor.** No `std::thread::sleep`, `std::fs`, blocking HTTP or database clients, long CPU loops, or `block_on` inside async code (Tokio panics with "Cannot start a runtime from within a runtime"). Use `tokio::time::sleep`, `tokio::fs`, async clients; or move the work off the executor: `spawn_blocking` for bounded blocking work that ends on its own (it cannot be aborted once started, and runtime shutdown waits for it), a dedicated `std::thread` for long-lived loops, `rayon` or a `Semaphore` around `spawn_blocking` for CPU-heavy work. `block_in_place` panics on a current-thread runtime and suspends sibling futures in the same task.
- **Never hold a `std::sync::Mutex`, `RwLock` or `RefCell` guard across `.await`:** it deadlocks or makes the future `!Send`. Clippy warns by default (`await_holding_lock`, `await_holding_refcell_ref`). Scope the guard in a block, copy out what you need, then await. `tokio::sync::Mutex` only when the guard must live across an await (usually an I/O handle); for plain data a std mutex inside a small non-async API is cheaper, and Tokio's docs say so. A task that owns the resource plus a channel is often better than either.
- **Cancellation safety:** dropping a future cancels it at its last `.await`; it is cancel-safe if dropping and recreating it loses nothing. In `loop { select! { .. } }` every branch that loses the race is dropped, so each must be cancel-safe. Per Tokio's docs `mpsc::Receiver::recv`, `watch::Receiver::changed`, `TcpListener::accept`, `AsyncReadExt::read` and `AsyncWriteExt::write` are; `read_exact`, `read_to_end`, `read_to_string`, `write_all`, `Mutex::lock`, `RwLock::read` and `write`, `Semaphore::acquire` and `Notify::notified` are not, and neither is your own function that awaits twice with state in between. Fix by keeping state outside the future (a buffer owned by the loop), pinning one long-lived future outside the loop (`tokio::pin!`), or moving the non-cancel-safe work into a spawned task and selecting on its `JoinHandle`. Document `# Cancel safety` on public async fns that are not.
- `tokio::time::timeout` for deadlines; `select!` for racing independent events (`biased;` only when order matters).
- **Channels:** bounded `mpsc::channel(n)` by default, for backpressure; unbounded needs a reason (it is also unbounded memory). `oneshot` for a reply, `watch` for latest-value state, `broadcast` for fan-out (slow receivers lag). Dropping the last sender ends the receiver's loop: use that as a shutdown signal where it fits.
- **Spawning:** `tokio::spawn` needs a `'static + Send` future, so move owned data in (clone the `Arc` or handle first). Spawn only what must run independently; otherwise `.await`, `join!`, `try_join!`. Keep the `JoinHandle` or a `JoinSet` and look at the result: a panic or cancellation arrives as `JoinError`, and a detached task that returns `Err` must log it. Bound fan-out with a `Semaphore` or `buffer_unordered(n)`.
- **Structured shutdown** (Tokio's graceful-shutdown guide): find out when (`tokio::signal::ctrl_c`, SIGTERM via `tokio::signal::unix`, an internal channel); tell everyone (`tokio_util::sync::CancellationToken`, one clone per task, selected on); wait (`tokio_util::task::TaskTracker`: spawn through it, `close()`, `wait().await` under an outer timeout). Flush and close in the shutdown path; `Drop` cannot await.
- A future holding an `Rc`, a `RefCell` borrow or another non-`Send` value across `.await` is `!Send` and `spawn` rejects it (troubleshooting.md). An `async fn` with no `.await` should be a plain function.
- Tests: `#[tokio::test]`; `#[tokio::test(start_paused = true)]` (needs tokio's `test-util` feature) makes `sleep` and `timeout` instant and deterministic.

## 9. Concurrency beyond async

- `Send` and `Sync` are automatic. Never `unsafe impl Send` or `Sync` to silence an error: fix the type (`Rc` to `Arc`, `RefCell` to `Mutex` or `RwLock`).
- Prefer message passing or owned data per thread. When sharing: data with linked invariants under one lock, short critical sections, one global lock order, no callbacks or `.await` while locked, never return a guard from a public API.
- `std::thread::scope` lets threads borrow locals and joins them for you. `rayon` (`par_iter`) for data parallelism, wrapped in `spawn_blocking` when called from async code.
- Atomics: `Relaxed` only for independent counters and flags; anything that publishes data needs acquire and release (or `SeqCst` when unsure) and a comment saying why. A lock until a measurement says otherwise.
- `LazyLock` and `OnceLock` from std replace `lazy_static` and `once_cell` for globals. Avoid mutable globals; references to `static mut` are denied on edition 2024.

## 10. Serde and tracing

- **serde:** derive on boundary types (DTOs), not on internal state. `rename_all = "camelCase"` for JS-facing JSON; `tag` for enums on the wire; `default` and `skip_serializing_if` to evolve a schema; `deny_unknown_fields` where strictness matters (it does not combine with `flatten`); `transparent` for newtypes; `try_from` to validate while deserializing. `untagged` gives poor errors. Hand-write `Debug` (and skip `Serialize`) on types that hold secrets. Limit input size before deserializing untrusted data.
- **tracing:** events and spans through `tracing`, not `println!` or `dbg!` (a CLI's own output aside). Structured fields (`info!(user_id = %id, "created")`, `%` for Display, `?` for Debug). `#[instrument(skip(self, payload), err)]` on request and command boundaries. In async code attach spans with `#[instrument]` or `.instrument(span)`; holding `span.enter()` across `.await` produces wrong traces. One subscriber, initialized in `main` (`tracing_subscriber::fmt()` with an `EnvFilter` on `RUST_LOG`); libraries emit but never install one. Keep the guard from `tracing-appender`'s non-blocking writer alive until exit or buffered lines are lost. Never log secrets, tokens or full request bodies.

## 11. Unsafe

The security view (FFI, soundness patterns, review triggers) is in the [Rust security checklist](../security-audit/references/stacks/rust.md); this is the working policy.
- Do not write `unsafe` when std or a vetted crate has the safe version. Legitimate reasons: FFI and platform calls, a benchmarked hot path, an abstraction safe Rust cannot express.
- The smallest block around the one operation, each with a `// SAFETY:` comment saying why the invariants hold here; each `unsafe fn` or trait with a `# Safety` doc section for callers. Wrap it in a safe API inside the smallest module that can uphold the invariant: the module boundary is the soundness boundary.
- `unsafe_op_in_unsafe_fn` (warn by default on edition 2024); `unsafe_code = "forbid"` under `[lints.rust]` for crates that need none; clippy's `undocumented_unsafe_blocks` (off by default).
- Edition 2024 syntax: `unsafe extern "C" { pub safe fn f(); pub unsafe fn g(); }`, `#[unsafe(no_mangle)]`, `std::env::set_var` is `unsafe`.
- Test unsafe code under Miri (`cargo +nightly miri test`; needs a nightly toolchain with the `miri` component, which the user installs) with adversarial inputs.

## 12. Testing

Use the project's runner and follow the `agents-kit:test-driven-development` loop.
- **Unit tests** in `#[cfg(test)] mod tests` beside the code; **integration tests** in `tests/` through the public API (each file is its own crate; shared helpers in `tests/common/mod.rs`); **doc tests** on public examples (`cargo test --doc`; nextest does not run them).
- Red phase: stub only enough to compile, so the failure is an assertion about behavior and not `not yet implemented`. One behavior per test, named for it. Tests may return `Result<(), E>` and use `?`. `assert_matches!` (stable since 1.96) or `matches!` for error variants; `#[should_panic(expected = "...")]` always with `expected`.
- Deterministic: paused time instead of sleeps, port 0 instead of fixed ports, `tempfile` directories, no shared global state; `--test-threads=1` or `--nocapture` only to diagnose.
- **proptest** for parsers, round trips and invariants (commit its regression files); **insta** snapshots for large structured output (review every diff, never accept blindly); hand-written fakes or `mockall` at trait seams, for external systems only.
- **cargo-nextest** when the project uses it, plus `cargo test --doc`. Coverage with cargo-llvm-cov if configured. A fuzz target (cargo-fuzz) for parsers of untrusted input if the project has them.
- **Benchmarks:** criterion or divan (`#[bench]` is gone from stable); release profile (`cargo bench` does that); `std::hint::black_box` on inputs; compare before and after on the same machine.

## 13. Tooling, performance, targets

- Loop: `cargo check`, `cargo clippy`, `cargo fmt`, `cargo test`; rust-analyzer; `cargo tree -d`; `cargo build --timings`; `cargo doc --no-deps` (without `--open`) to catch broken doc links.
- **Lints:** configure once in `[lints]` or `[workspace.lints]`, not scattered attributes (a group needs `priority = -1` next to single lints). Fix a lint rather than silence it; when one is wrong for one item, `#[expect(clippy::name, reason = "...")]` (stable since 1.81) on the narrowest item, which warns when it goes stale. Never `#![deny(warnings)]` in source (new compilers add warnings): enforce in CI with `cargo clippy -- -D warnings` or Cargo's `build.warnings` (1.97+). For code that handles untrusted input enable `unwrap_used`, `indexing_slicing`, `arithmetic_side_effects`, `cast_possible_truncation`; they are off by default, as are `redundant_clone` and `needless_collect` (nursery).
- **Performance: measure first.** criterion or divan, a profiler such as `cargo flamegraph` or `samply` if installed, never a debug build. Then fewer allocations in hot paths (`with_capacity`, reused buffers, `write!` into a `String`, no needless `collect` or `clone`), and better algorithms before micro-tuning.
- **Release profile trade-offs:** the release default is opt-level 3, `lto = false` (thin local), `codegen-units = 16`, `panic = "unwind"`, overflow checks off. `lto = "thin"` or `true` with `codegen-units = 1` gives faster, smaller code and much slower builds. `panic = "abort"` shrinks the binary but a panic ends the whole process (no `catch_unwind`, no per-task isolation; tests, build scripts and proc macros ignore it). `overflow-checks = true` when wrapping would be a bug. `[profile.dev.package."*"] opt-level = 2` keeps debug runs usable. Change profiles only with a measurement.
- **Cross-compiling (notes):** `cargo build --target <triple>` needs the target's std (`rustup target add`) and a linker or C toolchain; installing them is the user's call. Set linkers under `[target.<triple>]` in `.cargo/config.toml`, check `cfg(target_os = ...)` code with `cargo check --target`, and expect native C dependencies (OpenSSL) to be the usual failure; pure-Rust `rustls` avoids it when the project allows. Tauri targets: `agents-kit:tauri`.

## 14. Reading compiler errors

Read the first error only (the rest often cascade), then its `help:` and `note:` lines; `rustc --explain E0382` prints the official explanation of a code. A borrow error is about who owns the value and for how long, so ask that before reaching for `clone()`. The common codes, async and Cargo failures: [troubleshooting.md](references/troubleshooting.md). Bugs and failing tests follow `agents-kit:systematic-debugging` (`RUST_BACKTRACE=1`, `cargo test -- --nocapture`, `dbg!`, `tracing`); an async hang is usually a blocking call or a guard held across `.await`.

## 15. Before you say it is done

`cargo fmt --check`; `cargo clippy -- -D warnings` (add `--all-targets`, `--workspace` and the project's feature flags, as CI does); `cargo test` (and `--doc` or nextest as the project does); `cargo check` for every feature set and `--target` a cfg change touches. Run `ctx impact` on the crate: other crates that depend on it are where a changed public item breaks. Run `agents-kit:security-audit` on code that touches input, files, processes, the network, secrets or `unsafe`. Then `agents-kit:verification-before-completion`. For a review use [references/review-checklist.md](references/review-checklist.md) with `/agents-kit:code-review`.
