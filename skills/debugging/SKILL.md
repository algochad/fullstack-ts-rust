---
name: debugging
description: Systematic root-cause debugging. Use when something is broken, a test fails, an error or stack trace appears, behavior is unexpected, or a fix "didn't work". Reproduce first, find the cause, fix it once, and add a regression test.
---

# Debugging

Find the root cause before changing code. Guessing and patching symptoms wastes cycles and hides the bug.

## Process

1. **Reproduce.** Get the exact failing command, input, and error. Run it and see it fail yourself. If you can't reproduce it, say so and collect more evidence (logs, versions, environment) instead of guessing.
2. **Read the evidence.** Read the full error and stack trace, top to bottom, and the code at each frame that is yours. Note what the message actually says, not what you expect it to say.
3. **Narrow it down.** Bisect: which input, which commit (`git bisect` or `git log -p` on the file), which layer. Add temporary logging or an assertion at the boundary where the data first goes wrong. Change one thing at a time.
4. **Form one hypothesis, then test it.** State "the bug is X because Y", then run something that would prove it wrong. If the test doesn't fit, discard the hypothesis; don't bend the evidence.
5. **Fix the root cause once.** Grep every caller of the code you change. Fix it in the shared code, not at each symptom site. Never silence an error, add a retry, or catch-and-ignore to make it go away.
6. **Prove it.** Write a test that failed before the fix and passes after (the test-writer agent does this well). Run the full relevant suite. Remove the temporary logging.

## Check these first

- Recent changes: `git diff`, `git log -5`, dependency or lockfile updates.
- Environment: versions, env vars, config, stale build or cache, wrong working directory, wrong branch.
- Assumptions about data: null or empty, types, encoding, timezone, ordering, duplicates.
- Async and state: race conditions, shared mutable state, missing await, ordering of side effects.
- Whether the failing code is even the code that runs (stale build, wrong path, mocked in tests).

## Report

State the root cause in one or two sentences, the fix and why it addresses the cause, the regression test, and anything you couldn't verify. If it's still unsolved after real effort, say what you ruled out and what you'd try next.
