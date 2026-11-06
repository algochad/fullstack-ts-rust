# Debugging techniques

Ideas from obra's superpowers systematic-debugging supporting docs (MIT), reworded.

## Backward tracing

When the error is deep in the call stack:

1. Observe the symptom (the failing line and the bad value).
2. Find what called it and what value it passed.
3. Repeat up the chain until you reach where the value was first wrong: a default, a parse, a config read, a test fixture.
4. Fix there. If you can't see the chain, add a temporary log or stack-trace print at the sink that records the value and its caller (in tests, log before the dangerous operation, not after it fails), run once, and read it.

## Defense in depth

After fixing the root cause, make the bug structurally impossible by validating at each layer the data passes through, because one check can be bypassed by another code path, a refactor, or a mock:

1. **Entry point:** reject obviously invalid input at the API boundary.
2. **Business logic:** check that the data makes sense for this operation.
3. **Environment guards:** refuse dangerous operations in the wrong context (for example, destructive writes outside a temp directory in tests).
4. **Debug logging:** capture context so a future failure is diagnosable.

Only add the layers that are cheap and meaningful. Don't pile on checks for their own sake.

## Flaky tests: wait on conditions, not time

Arbitrary sleeps and fixed timeouts guess at timing, so they fail under load and waste time otherwise. Poll for the condition you actually need (the event arrived, the file exists, the state changed), with a short interval and a clear timeout and error message. If a test passes alone and fails in the suite, suspect shared state or leftover files from another test and find which test pollutes it (bisect the test order).

## Environment and data checks

- Versions, env vars, working directory, wrong branch, stale build or cache, and whether the code that runs is the code you're reading.
- Data assumptions: null or empty, types, encoding, timezone, ordering, duplicates.
- Concurrency: missing `await`, shared mutable state, ordering of side effects.

## Stack-specific starting points

- **NestJS:** dependency-injection errors ("Nest can't resolve dependencies of X") mean a provider is missing from `providers`, a module isn't imported or exported, or there's a circular import (`forwardRef`). Guard and pipe order, and `ValidationPipe` options, explain many 400/401/403 surprises. Check the global guard and public-route decorators first. Run with `--debug` or add a logger to the guard.
- **Better Auth:** 403 or "invalid origin" errors usually mean `trustedOrigins` or `baseURL` doesn't match the real origin (scheme, port, www, proxy). Missing sessions are often cookie attributes (`secure` on HTTP, `SameSite`, cross-domain), a Nest `bodyParser` left on, or a proxy dropping headers. Don't fix by disabling the origin or CSRF checks.
- **React Native / Expo:** stale Metro cache (`npx expo start -c`), version mismatches (`npx expo-doctor`, `npx expo install --check`), native config that needs a prebuild or a new dev client, and release-only crashes (Hermes, minification, missing permissions). Read `adb logcat` or the Xcode device log for native errors.
- **Tauri:** a command that silently fails from the frontend is usually a missing capability or permission (check `src-tauri/capabilities`), an argument-name mismatch (Rust `snake_case` vs JS `camelCase`), or a CSP block (see the webview devtools console). Rust-side output appears in the terminal running `tauri dev`.
- **Rust:** `RUST_BACKTRACE=1` (or `full`) for panics. Borrow-checker errors usually point to a lifetime or ownership design problem, not a missing `clone()`. For async hangs, look for a `std::sync::Mutex` guard held across `.await` or a blocking call on the async runtime. Use `cargo test -- --nocapture`, `dbg!`, and `tracing`. For `unsafe` or FFI bugs, run Miri or a sanitizer.
