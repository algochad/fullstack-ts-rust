# Rust review checklist

Rewritten for this plugin from the Rust code-review guide in awesome-skills/code-review-skill (MIT), the review priorities in affaan-m/ECC rust-reviewer (MIT), the Rust API Guidelines checklist and the Tokio docs. Use it with `/agents-kit:code-review`: flag only what you can show is wrong, not preferences. Security findings follow the `security-audit` skill's [Rust checklist](../../security-audit/references/stacks/rust.md); this list does not repeat it.

## Ownership and borrowing
- [ ] No `.clone()` whose only job is to satisfy the borrow checker; each deliberate clone is cheap or commented (moved into a task, small immutable data).
- [ ] Parameters take `&str`, `&[T]`, `&Path`, not `&String`, `&Vec<T>`, `&PathBuf`; ownership is taken only to store or consume.
- [ ] `Rc`, `Arc`, `RefCell`, `Box` are not in public signatures; `Arc<Mutex<T>>` is real shared state, not a habit; `RefCell` has a reason.
- [ ] Structs own their data unless a borrow is the point; no needless lifetime annotations; no references returned to locals.

## Errors and panics
- [ ] Library errors are typed (`thiserror` enum or opaque struct); no `anyhow::Error`, `Box<dyn Error>`, `String` or `()` in a public `Result`; the source chain is kept (`#[from]`, `#[source]`).
- [ ] Application errors carry context (`.context(..)`) at layer boundaries and are converted once at the edge.
- [ ] No `unwrap()` or `expect()` on a fallible runtime path (I/O, parsing, input, channels, lookups); every `expect` states why it cannot fail.
- [ ] No `let _ = fallible()`, no `.ok()` discarding a reason, no empty `Err(_) => {}`; `#[must_use]` values are handled.
- [ ] No panic for bad input; `# Errors` and `# Panics` documented on public fallible functions; fallible twins exist where a panicking convenience does.
- [ ] Wildcard `_` arms are not hiding new variants of a business enum.

## API design (public crates)
- [ ] Names follow the conventions: no `get_` on getters, `as_`/`to_`/`into_`, `iter`/`iter_mut`/`into_iter`, bare feature names.
- [ ] Public types implement `Debug` and the common traits they can; conversions use `From`/`TryFrom`/`FromStr`; no `bool` parameters; newtypes for ids and units.
- [ ] Fields are private; `#[non_exhaustive]` and sealed traits are used where the API will grow; third-party types are not leaked.
- [ ] A new public item is intended: a breaking change (removed or renamed item, new variant on an exhaustive enum, new bound) is called out and versioned.
- [ ] Every public item has docs; examples use `?`, not `unwrap`.

## Async and concurrency
- [ ] No blocking call on the executor (`std::fs`, `std::thread::sleep`, sync clients, long CPU loops, `block_on`); bounded blocking work is in `spawn_blocking`.
- [ ] No `std::sync::Mutex`, `RwLock` or `RefCell` guard held across `.await`; `tokio::sync::Mutex` only where the guard must cross an await.
- [ ] Every `select!` branch in a loop is cancel-safe, or the state lives outside the future; public async fns that are not cancel-safe say so.
- [ ] Channels are bounded or the unbounded one is justified; spawned tasks are tracked (`JoinSet`, `TaskTracker`), their `JoinError` and `Err` results are handled, fan-out is bounded.
- [ ] Shutdown is structured: signal, `CancellationToken`, wait with a timeout; background tasks stop and flush.
- [ ] No `unsafe impl Send`/`Sync` to silence the compiler; lock order is consistent; atomics orderings are justified.
- [ ] Spans use `#[instrument]` or `.instrument()`, not `enter()` across an await.

## Unsafe
- [ ] Each `unsafe` block is minimal and has a `// SAFETY:` comment explaining why the invariants hold; each `unsafe fn` has a `# Safety` section.
- [ ] `unsafe` sits behind a safe API inside one small module; there is no safe alternative in std or a vetted crate; Miri or tests with adversarial inputs cover it.
- [ ] Edition 2024 forms are used (`unsafe extern`, `#[unsafe(no_mangle)]`); no references to `static mut`.

## Cargo, features and dependencies
- [ ] A new dependency is needed (not std, not a few lines), maintained, and has default features trimmed; the version requirement is a range, not `*`.
- [ ] Features are additive and bare-named; the default, no-default and all-features builds still compile; workspace dependencies use `workspace = true` and one version.
- [ ] `rust-version` and edition are respected: no syntax or API newer than the MSRV; `Cargo.lock` is committed and current for applications.
- [ ] Lints live in `[lints]`; `#[allow]` carries a reason (prefer `#[expect]`); no `#![deny(warnings)]` in source.
- [ ] Profile changes (`lto`, `codegen-units`, `panic = "abort"`, `overflow-checks`) come with a measurement and a note on what they change.

## Tests
- [ ] New behavior has a test that failed first; error paths and edge cases (empty, boundary, duplicate) are covered; tests assert behavior, not mirrored implementation.
- [ ] Tests are deterministic: paused time, port 0, temp dirs, no shared global state, no real network.
- [ ] Doc tests compile for new public examples; async tests use `#[tokio::test]`; `#[should_panic]` has `expected`.
- [ ] Parsers of untrusted input have property or fuzz coverage when the project has the tooling.

## Performance
- [ ] A performance claim has a benchmark or profile behind it; no premature `unsafe` or micro-tuning.
- [ ] No needless `collect()`, `clone()`, `format!` in a hot path; `with_capacity` where the size is known; no allocation in a tight loop without a reason.
- [ ] No `N+1` queries or per-item locking in loops.

## Verification
- [ ] `cargo fmt --check`, `cargo clippy -- -D warnings` (with the project's flags), `cargo test` (and `--doc`) pass, and `cargo check` passes for each feature set and target the diff touches.
- [ ] `ctx impact` was run for the changed crate and its dependents were checked.
