# Rust troubleshooting

Rewritten for this plugin from the Rust compiler error index and Reference, the Cargo book, the Tokio and tracing docs, and the recurring failures catalogued in the community Rust skills (morganlinton/BeautifulRust, awesome-skills/code-review-skill and affaan-m/ECC; all MIT). Reproduce first (the `systematic-debugging` skill), then use this to find where to look. `rustc --explain E0xxx` prints the official explanation of any error code.

## How to read a rustc error

1. Fix the first error only. Later ones often cascade from it, and a clean `cargo check` after one fix is cheaper than reasoning about six.
2. Read the primary span, then the `note:` lines (they say where a value was moved, borrowed or required to be `'static`) and the `help:` line (often the fix).
3. A borrow or lifetime error is a question about ownership: who owns this value, and for how long? Adding `.clone()` or a lifetime annotation before answering it tends to move the error somewhere else.
4. `cargo check` is the fast loop; rust-analyzer (through the LSP tool when it is installed) shows the same errors inline. If rust-analyzer and cargo disagree, the feature set or target differs (see "rust-analyzer" below).

## Ownership and borrowing

- **E0382 use of moved value:** a value moved into a function, closure or `for` loop and was used again. Borrow it (`&x`), clone on purpose, restructure so one owner consumes it, or iterate with `.iter()`. In a loop, the move happens on the second iteration: move the value out of the loop or clone per iteration with a reason.
- **E0499 two mutable borrows / E0502 mutable and immutable borrow:** two live borrows overlap. Shorten one (compute into a local first, end it with a block), split a struct so disjoint fields borrow separately, or use `entry`, `retain`, `drain` or `split_at_mut` instead of indexing while iterating. Methods borrow all of `self`; direct field access borrows only that field.
- **E0505 move out while borrowed / E0506 assign to borrowed value:** the borrow is still used after the move or assignment. Reorder, or end the borrow earlier.
- **E0507 cannot move out of a borrow:** you hold `&T` or `&mut T` and tried to take ownership (often `self.field` out of `&self`, or an element out of a `Vec` by index). Use `std::mem::take`, `mem::replace` or `Option::take`, clone deliberately, or consume `self`.
- **E0515 returns a reference to a local, E0597 does not live long enough:** the value dies at the end of the function or block. Return the owned value, take the buffer from the caller, or move the owner outward.
- **E0716 temporary value dropped while borrowed:** bind the temporary to a `let` so it lives long enough (`let s = make(); let r = &s;`).
- **E0373 closure may outlive the current function:** a `thread::spawn` or `tokio::spawn` closure borrows a local. Add `move` and give the closure owned data (clone an `Arc` first).
- **E0106 missing lifetime specifier:** a returned reference could come from several inputs. Name the lifetime that links the output to the right input, or return an owned value.
- **E0310 the parameter type may not live long enough:** a generic `T` was passed where `'static` is needed (usually `spawn`). Add `T: 'static` (and `Send`) if the data really is owned, or restructure.
- **`already borrowed: BorrowMutError` at run time:** a `RefCell` was borrowed twice. Shorten the first borrow, or replace the shared mutable web with ownership or ids into a `Vec`.

## Traits and types

- **E0277 trait bound not satisfied:** read which type misses which trait. Common: a missing derive (`Debug`, `Clone`, `Serialize`), `?` used where the error type has no `From` conversion (add `#[from]` or `map_err`), `Sized` problems with `str` or `dyn Trait` (use `&str`, `Box<dyn Trait>`), an iterator collected into a type that cannot be built from its items.
- **`future cannot be sent between threads safely`:** the `note:` names what is held across an `.await` that is not `Send` (an `Rc`, a `RefCell` borrow, a `std::sync::MutexGuard`, a raw pointer). Drop it before the await by scoping it in a block, or switch to a `Send` type.
- **E0308 mismatched types:** often `&String` versus `&str`, `Option<T>` versus `T`, `usize` versus `u64` (use `try_from`, not `as`), or a missing `Ok(..)` on the last line. A trailing semicolon turns the last expression into `()`.
- **E0599 no method found:** the trait is not in scope (`use` it), a bound is missing on a generic, or the receiver is an `Option` or `Result` you forgot to unwrap or `?`. For a method that exists on a different type, check `Deref` and `as_ref`.
- **E0282 / E0283 type annotations needed:** give the type where it is chosen: `let v: Vec<u32> = ...collect();`, `"5".parse::<u32>()`, `.into()` with a typed binding.
- **E0038 the trait is not dyn compatible:** a method is generic, returns `Self`, is an `async fn`, or returns `impl Trait`. Add `where Self: Sized` to exclude the method, split the trait, use `async-trait` or boxed futures for `dyn`, or use generics or an enum instead of `dyn`.
- **E0004 non-exhaustive patterns:** a new enum variant needs handling. That is the compiler doing its job; resist adding `_ =>` on a business enum.
- **E0119 conflicting implementations / E0117 orphan rule:** you cannot implement a foreign trait for a foreign type; wrap the type in a newtype. A blanket impl overlaps a specific one.
- **E0432 / E0433 unresolved import or path:** a missing dependency or feature in `Cargo.toml`, a renamed module, or edition path differences. `cargo tree -e features -i <crate>` shows what is on.
- **E0603 / E0616 private item or field:** widen to `pub(crate)` if the caller is in the crate; otherwise add an accessor, not a `pub` field.
- **E0658 use of unstable feature:** the code needs nightly or a newer stable than the project's toolchain. Check `rust-toolchain.toml` and versions.md before reaching for `#![feature]`.
- **Edition 2024 only:** `if let` temporaries drop before `else` and tail-expression temporaries drop before locals, so code that compiled on 2021 can fail with a borrow error or change drop order; `extern` blocks and `#[no_mangle]` need `unsafe`; `static mut` references are denied. Run `cargo fix --edition` and read its comments.

## Cargo and the toolchain

- **`package requires rustc 1.xx`** or **`rustc 1.xx is not supported by the following package`:** a dependency's MSRV is above your toolchain. Pin an older release (`cargo update <crate> --precise <ver>`), raise the toolchain on purpose, or use resolver 3 / `incompatible-rust-versions = "fallback"` so Cargo picks compatible versions.
- **`feature X is not enabled` / unresolved item only in the workspace build:** feature unification across members. Build the member alone (`cargo build -p name`) and the whole workspace (`--workspace`) and compare; declare the feature on the crate that needs it instead of relying on a sibling to turn it on.
- **Two versions of the same crate (type mismatch between "crate X v1" and "crate X v2"):** `cargo tree -d` shows duplicates, `cargo tree -i <crate>` who requires each. Align the version requirements, or re-export the type so callers use the same one.
- **`failed to select a version for ...`:** conflicting requirements or a yanked release. Read the "required by" chain; `cargo update -p <crate>` or relax a pin.
- **Lockfile churn or `--locked` fails in CI:** `Cargo.lock` is out of date with `Cargo.toml`. Run `cargo update` (or `cargo check`) locally and commit the lockfile for applications.
- **`Blocking waiting for file lock on build directory`:** another cargo or rust-analyzer holds it. Wait, or give the editor its own target dir (`rust-analyzer.cargo.targetDir`).
- **Linker errors (`linking with cc failed`, `cannot find -lssl`, `pkg-config` not found):** a native library or toolchain is missing on the machine. Name the system package in your report; installing it is the user's call. Prefer pure-Rust options (`rustls`) when the project allows, or the crate's `vendored` feature.
- **Slow builds:** `cargo build --timings` writes an HTML report to `target/cargo-timings/`; look for one huge crate, a serial chain, proc-macro and build-script time, or a heavy dependency compiled at opt-level 0. Options in the Cargo book chapter "Optimizing Build Performance": `debug = "line-tables-only"` for dev, a faster linker, splitting a large crate, `[profile.dev.package."*"]` tuning.
- **rust-analyzer shows errors cargo does not (or the reverse):** it checks with its own feature set and target. Match `rust-analyzer.cargo.features` and target to the project, restart the server after a `Cargo.toml` or `build.rs` change, and trust `cargo check` with the project's flags as the tie-breaker.
- **Proc-macro or build-script problems in the editor:** reload the workspace; check that the build script succeeds with `cargo check`.

## Tokio and async at run time

- **Hang or stall under load:** a blocking call on the executor (`std::fs`, `std::thread::sleep`, a sync HTTP or database client, a long CPU loop) starves other tasks; a `std::sync::Mutex` guard held across `.await` deadlocks; a bounded channel whose receiver stopped fills and blocks senders; a `select!` loop recreating a non-cancel-safe future starves it. Add `tracing` around the suspect awaits, or use `tokio-console` if the project has it. Move blocking work to `spawn_blocking`.
- **`Cannot start a runtime from within a runtime`:** `block_on` (or `Runtime::new`) was called inside async code. Make the caller async and `.await`; for sync code that must call async, give it a `Handle` and call from a non-runtime thread.
- **`there is no reactor running, must be called from the context of a Tokio 1.x runtime`:** async I/O or timers were used outside a runtime (a plain `#[test]`, a thread without a `Handle`, a library called before `main` builds the runtime). Use `#[tokio::test]` or `#[tokio::main]`, or enter the runtime with `handle.enter()`.
- **`Cannot drop a runtime in a context where blocking is not allowed`:** a runtime was created or dropped inside async code. Keep one runtime owned by `main`.
- **`JoinError` (cancelled or panicked):** a task panicked or was aborted. A panic inside a spawned task is isolated by default: it ends that task only, so log the `JoinError` instead of unwrapping it, and find the panic message above it in the log.
- **`channel closed` (`SendError`, `RecvError`):** the other half was dropped, often because a task panicked or finished early. Decide whether that is a normal shutdown (break the loop) or a failure (return an error).
- **Data lost in a `select!` loop:** a non-cancel-safe branch (`read_exact`, `write_all`, `Mutex::lock`, your own two-step read) was dropped mid-way. See "Cancellation safety" in SKILL.md section 8.
- **A `spawn_blocking` task never ends at shutdown:** a started blocking task cannot be aborted and the runtime waits for it. Make it check a flag or channel, or use `Runtime::shutdown_timeout`.
- **`stack overflow` in async code or deep recursion:** huge futures are held on the stack (`clippy::large_futures` finds them) and recursive `async fn` needs `Box::pin`. Box the large future or the recursion.
- **Timer-based test is slow or flaky:** use `#[tokio::test(start_paused = true)]` (tokio's `test-util` feature) and `tokio::time::advance`.

## Panics and runtime behavior

- **Backtrace:** `RUST_BACKTRACE=1` (or `full`). A panic inside a spawned task or thread does not end the process unless `panic = "abort"` is set. In tests the message is shown with `cargo test -- --nocapture`.
- **`PoisonError`:** another thread panicked while holding the lock; find that panic first. Decide deliberately between propagating it and `into_inner()`.
- **Arithmetic differs between debug and release:** overflow panics in debug and wraps in release unless `overflow-checks = true`. Use `checked_*`, `saturating_*` or `try_from` where the value is untrusted.
- **Slicing or indexing panics:** `s[a..b]` on a `str` panics off a char boundary; use `get(..)`. `v[i]` panics out of range; use `get(i)`.
- **Behavior differs only in `--release`:** an overflow, a data race behind `unsafe`, or a timing assumption. Run the failing case in release with debug assertions (`cargo test --release`), and run `unsafe` modules under Miri (the user installs the nightly toolchain and component).
- **Test passes alone, fails in the suite:** shared global state, a fixed port, a shared temp file, or test order. Run with `-- --test-threads=1` to confirm, then remove the sharing instead of keeping the flag.
- **Doc test fails but the code is fine:** the example needs `# ` hidden setup lines, a `?` wrapper (`fn main() -> Result<..>`), or `no_run` / `ignore` with a reason. Doc tests build against the public API only.

## Serde and logging

- **`missing field` / `unknown field` / `invalid type` from serde:** the wire name differs from the Rust name (`rename_all`, `rename`), the field is optional on one side (`default`, `Option`), or `deny_unknown_fields` is on. Print the raw input in a test and compare.
- **An untagged enum gives "data did not match any variant":** serde cannot say which variant failed. Prefer an internally tagged enum, or deserialize into `serde_json::Value` first when diagnosing.
- **No log output:** no subscriber was installed in `main`, or `RUST_LOG` is unset or filtered (`EnvFilter` needs the `env-filter` feature); in tests install one with `try_init()` so repeated calls do not panic. Lines vanish at exit when a `tracing-appender` guard is dropped early.
- **Spans look wrong in async code:** `span.enter()` was held across an `.await`; use `#[instrument]` or `.instrument(span)`.

## After changing edition, MSRV or a major dependency

- **Edition 2024 migration:** `cargo fix --edition`, then read each changed site: temporaries and drop order, `unsafe extern`, `static mut`, `set_var`, `impl Trait` capture rules, and Cargo key spellings. Set `rust-version` and a resolver explicitly in a virtual workspace.
- **thiserror 1 to 2:** use `{type}` instead of `{r#type}` in messages and add a direct `thiserror` dependency to every crate that derives `Error`.
- **MSRV bump:** change `rust-version` in the workspace table, the CI toolchain, `clippy.toml` (`msrv`), and any `rust-toolchain.toml` together; clippy's `incompatible_msrv` flags APIs newer than the declared MSRV.
