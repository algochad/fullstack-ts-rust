# Rust patterns

Rewritten for this plugin from the Rust API Guidelines, the Cargo book, the Tokio and tracing docs, and the community skills morganlinton/BeautifulRust (MIT), affaan-m/ECC rust-patterns and rust-testing (MIT), apollographql/skills rust-best-practices (MIT) and leonardomso/rust-skills (MIT). Snippets are illustrations: match the project's crates and style, and check names against the versions it pins.

## Workspace manifest

```toml
# Cargo.toml (root, virtual workspace)
[workspace]
resolver = "3"                 # a virtual workspace cannot infer it from an edition
members = ["crates/*"]

[workspace.package]
edition = "2024"
rust-version = "1.85"          # the MSRV you actually test
license = "MIT"

[workspace.dependencies]
anyhow = "1"
thiserror = "2"
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", default-features = false }

[workspace.lints.rust]
unsafe_code = "deny"           # "forbid" cannot be lifted, so no crate that needs unsafe could inherit it

[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }   # a group needs a lower priority than single lints
module_name_repetitions = "allow"
dbg_macro = "warn"
todo = "warn"
```

```toml
# crates/core/Cargo.toml
[package]
name = "app-core"
version = "0.1.0"
edition.workspace = true
rust-version.workspace = true

[dependencies]
serde.workspace = true
tokio = { workspace = true, features = ["rt", "macros"] }   # member features add to the workspace's

[lints]
workspace = true
```

With `deny`, the one module that wraps `unsafe` opts out with `#[expect(unsafe_code, reason = "FFI wrapper")]` on that module, and every block inside keeps its `// SAFETY:` comment. A crate that needs no `unsafe` can use `forbid` in its own `[lints.rust]`.

## Errors: typed in the library, context in the application

```rust
// library crate: a caller can match on the cause
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("record {id} not found")]
    NotFound { id: String },
    #[error("storage backend failed")]
    Backend(#[from] std::io::Error),       // keeps the source chain
    #[error("invalid record: {0}")]
    Invalid(String),
}

// application crate: context at each layer, one conversion at the edge
use anyhow::{Context, Result};

fn load(path: &std::path::Path) -> Result<Config> {
    let text = std::fs::read_to_string(path)
        .with_context(|| format!("reading {}", path.display()))?;
    serde_json::from_str(&text).with_context(|| format!("parsing {}", path.display()))
}

fn status(err: &StoreError) -> u16 {        // the edge decides what the outside world sees
    match err {
        StoreError::NotFound { .. } => 404,
        StoreError::Invalid(_) => 422,
        StoreError::Backend(_) => 500,       // log the source, do not return it
    }
}
```

- An enum variant exists because a caller can react to it. Do not mirror every inner error; a variant per upstream crate leaks your dependencies into your API.
- `#[error(transparent)]` forwards `Display` and `source()` for a wrapper variant. thiserror 2 needs a direct `thiserror` dependency wherever `derive(Error)` is used.
- Display `anyhow` errors with `{:#}` for the inline chain, `{:?}` for chain plus backtrace. Print the chain at the top of `main`; do not print and also return it.
- Match on a non-exhaustive foreign enum with a wildcard arm; match on your own business enums exhaustively, without `_`, so a new variant is a compile error to handle.

## Borrowing without cloning

```rust
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<'_, str> {      // allocates only when it has to
    if input.contains(' ') { Cow::Owned(input.replace(' ', "_")) } else { Cow::Borrowed(input) }
}

impl Batch {
    fn take_items(&mut self) -> Vec<Item> {      // move a field out of &mut self, no clone
        std::mem::take(&mut self.items)
    }
}

// handles cloned in a block, then moved: the clone is visible and deliberate
let job = {
    let db = db.clone();
    let cfg = std::sync::Arc::clone(&cfg);
    async move { run(db, cfg).await }
};
```

When a borrow error tempts you to clone, check these first: the borrow outlives its use (end it with a block); two fields of one struct are borrowed through methods (borrow the fields directly or split the struct); a `&mut self` method is called while a reference into `self` is alive (compute first, then mutate); a loop mutates the collection it iterates (collect ids first, or use `retain`, `drain`, `entry`).

## API design

```rust
// newtype that validates once: a value of this type is a valid email
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Email(String);

#[derive(Debug, thiserror::Error)]
#[error("invalid email: {0}")]
pub struct EmailError(String);

impl TryFrom<String> for Email {
    type Error = EmailError;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        if s.contains('@') { Ok(Self(s)) } else { Err(EmailError(s)) }   // returns the input in the error
    }
}
impl AsRef<str> for Email { fn as_ref(&self) -> &str { &self.0 } }
```

```rust
// builder: more than a couple of optional inputs, or construction that validates
#[derive(Debug, Clone)]
pub struct Client { base: String, timeout: Duration, retries: u32 }

#[must_use]
pub struct ClientBuilder { base: String, timeout: Duration, retries: u32 }

impl Client {
    pub fn builder(base: impl Into<String>) -> ClientBuilder {
        ClientBuilder { base: base.into(), timeout: Duration::from_secs(30), retries: 3 }
    }
}

impl ClientBuilder {
    pub fn timeout(mut self, d: Duration) -> Self { self.timeout = d; self }   // named after the field
    pub fn retries(mut self, n: u32) -> Self { self.retries = n; self }
    pub fn build(self) -> Result<Client, ConfigError> {                         // all validation lives here
        if self.base.is_empty() { return Err(ConfigError::EmptyBase); }
        Ok(Client { base: self.base, timeout: self.timeout, retries: self.retries })
    }
}
```

```rust
// room to grow without a major version
#[non_exhaustive]
#[derive(Debug)]
pub enum Event { Started, Stopped }          // callers must write a wildcard arm

pub trait Plugin: private::Sealed {          // only this crate can implement it
    fn name(&self) -> &str;
}
mod private { pub trait Sealed {} }
```

- `bool` parameters become two-variant enums (`Verbosity::Summary`) or two methods; `report(true)` cannot grow a third mode.
- Typestate (`Connection<Disconnected>` to `Connection<Connected>` with `PhantomData`) is for protocols where a wrong order must not compile. For ordinary configuration a builder is enough.
- Derive `Debug` on every public type; hand-write it to redact secrets. Implement `Display` for anything people read. `Copy` only for small plain data, because the compiler copies silently.
- Hand-written `Ord` needs `PartialEq`, `PartialOrd` and `Hash` that agree with it; a derived `PartialEq` beside a custom `Ord` misbehaves in `BTreeMap` and `sort`.

## Dispatch: generics, `dyn`, enums

```rust
fn run_static<H: Handler>(h: &H) { h.handle() }       // monomorphized: fast, one copy per type
fn run_dyn(h: &dyn Handler) { h.handle() }            // one copy, vtable call, mixed types in a Vec<Box<dyn Handler>>

enum AnyHandler { File(FileHandler), Net(NetHandler) }   // closed set: an enum, exhaustively matched
```

A closed set of variants you control is an enum; an open set that callers extend is `dyn`; a hot path with one type is generic. Wrap a public `dyn` in your own type (`struct Store(Arc<dyn StoreImpl>)`) so you can change it later. For `dyn` with async methods, the `async-trait` crate or manual `Pin<Box<dyn Future + Send + '_>>` returns; native `async fn` in traits (1.75) is for generic use.

## Async

```rust
// bounded blocking work off the executor; two `?`: the join, then the work
let digest = tokio::task::spawn_blocking(move || hash_file(&path))
    .await
    .context("hash task panicked")??;

// guard scoped before the await
let snapshot = {
    let guard = state.lock().expect("state lock poisoned");
    guard.clone()
};                                  // guard dropped here
publish(snapshot).await;
```

```rust
// a worker loop: both select branches are cancel-safe
async fn worker(mut rx: tokio::sync::mpsc::Receiver<Job>, token: CancellationToken) {
    loop {
        tokio::select! {
            _ = token.cancelled() => break,
            job = rx.recv() => match job {
                Some(job) => handle(job).await,   // runs to completion; not a select branch
                None => break,                    // every sender dropped
            },
        }
    }
    // flush and close here
}
```

```rust
// structured shutdown: tell, then wait
let token = CancellationToken::new();
let tracker = TaskTracker::new();
let (tx, rx) = tokio::sync::mpsc::channel(64);          // bounded: senders wait when the worker is slow
tracker.spawn(worker(rx, token.clone()));

tokio::signal::ctrl_c().await?;
token.cancel();                                          // every clone sees it
tracker.close();
if tokio::time::timeout(Duration::from_secs(10), tracker.wait()).await.is_err() {
    tracing::warn!("shutdown timed out; some tasks ignored the token");
}
```

```rust
// a group of tasks whose results you need; failures are visible
let mut set = tokio::task::JoinSet::new();
for url in urls { set.spawn(fetch(url)); }
while let Some(joined) = set.join_next().await {
    match joined {
        Ok(Ok(body)) => results.push(body),
        Ok(Err(e)) => tracing::warn!(error = %e, "fetch failed"),
        Err(join_err) => tracing::error!(error = %join_err, "fetch task panicked or was cancelled"),
    }
}
```

- Not cancel-safe in a loop: `read_exact`, `write_all`, `Mutex::lock`, your own multi-step reads. Keep the partial state outside the future, or run the step in its own task.
- Bounded concurrency over a stream: `futures::stream::iter(urls).map(fetch).buffer_unordered(8)`, or a `Semaphore` permit held for the duration of each task.
- A tokio runtime inside a test or a binary is created once; library code never calls `Runtime::new()` or `block_on`.
- Make a public future's `Send`-ness a checked fact: `const _: () = { const fn assert_send<T: Send>() {} assert_send::<MyClient>(); };`.

## serde

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateOrder {
    pub customer_id: u64,
    #[serde(default)]
    pub notes: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coupon: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]      // {"type":"start","id":1}
pub enum Command { Start { id: u64 }, Stop { id: u64 } }

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]                          // validated while deserializing
pub struct Slug(String);
impl TryFrom<String> for Slug { /* Error: Display */ }
```

Wire types change with the protocol, so keep them separate from domain types and convert with `From` or `TryFrom`. Borrow from the input (`&'a str` or `Cow<'a, str>` with `#[serde(borrow)]`) only in hot, short-lived parsing. `flatten` and `untagged` cost speed and error quality; use them when the format demands it.

## tracing

```rust
#[tracing::instrument(skip(self, payload), fields(len = payload.len()), err)]
async fn handle(&self, id: u64, payload: &[u8]) -> Result<(), HandleError> {
    tracing::debug!(%id, "handling");
    Ok(())
}

fn init_tracing() {
    // needs tracing-subscriber's `env-filter` feature
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
}
```

`err` records the `Err` as an event, so do not also log it where it is returned. Fields hold ids and counts, not payloads. Levels: `error` for failures someone must act on, `warn` for degraded but continuing, `info` for lifecycle, `debug` and `trace` for detail.

## Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_an_email_without_an_at_sign() {
        let err = Email::try_from("nobody".to_string()).unwrap_err();
        assert_eq!(err.to_string(), "invalid email: nobody");
    }

    #[test]
    fn loads_the_default_config() -> anyhow::Result<()> {      // `?` instead of unwrap
        let cfg = Config::load_from_str(DEFAULT)?;
        assert_eq!(cfg.port, 8080);
        Ok(())
    }
}
```

```rust
// tests/api.rs: an integration test sees only the public API
use app_core::Client;

#[test]
fn builds_with_defaults() {
    let client = Client::builder("https://example.test").build().unwrap();
    assert_eq!(client.retries(), 3);
}
```

```rust
// property test: any valid slug survives a round trip
proptest::proptest! {
    #[test]
    fn slug_round_trips(s in "[a-z0-9-]{1,32}") {
        let slug = Slug::try_from(s.clone()).unwrap();
        proptest::prop_assert_eq!(slug.as_str(), s);
    }
}

// snapshot test: review the diff with cargo insta review, do not accept blindly
insta::assert_snapshot!(render_report(&sample()));

// deterministic time
#[tokio::test(start_paused = true)]
async fn retries_after_the_backoff() {
    let task = tokio::spawn(call_with_retry());
    tokio::time::advance(Duration::from_secs(5)).await;
    assert!(task.await.unwrap().is_ok());
}
```

- A doc test is a public example that compiles and runs: `///` a fenced `rust` block using `?` (hide the wrapper with `# ` lines), never `unwrap()`.
- For the red phase, a stub returns a plausible wrong value, so the first failure reads `left: 0, right: 8080` and not `not yet implemented`.
- Fixtures: `tempfile::tempdir()` per test, `TcpListener::bind("127.0.0.1:0")` for a free port, a fake clock or paused time for timers.

## Release profile

```toml
[profile.release]
lto = "thin"            # true ("fat") gains a little more at a much higher link time
codegen-units = 1       # better inlining, slower builds
# panic = "abort"       # smaller, but any panic ends the process; read section 13 of SKILL.md first
# overflow-checks = true   # when wrapping arithmetic would be a bug

[profile.dev.package."*"]
opt-level = 2           # optimize dependencies only; your own crates keep fast rebuilds
```

Measure before and after (`cargo build --timings` for build time, a release benchmark for run time). Profiles in member manifests are ignored; set them in the workspace root.

## Layout of a binary plus library

```text
my_app/
  Cargo.toml
  src/
    main.rs            parse args, init tracing, build the runtime, call lib::run, map the error to an exit code
    lib.rs             pub fn run(config) -> anyhow::Result<()>; re-exports the public API
    config.rs
    orders/            one domain: mod.rs or orders.rs, plus model.rs, service.rs
    storage/           infrastructure behind a trait the domain owns
  tests/               integration tests (public API only), tests/common/mod.rs for helpers
  benches/             criterion or divan
```
