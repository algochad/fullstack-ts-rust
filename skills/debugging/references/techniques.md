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
