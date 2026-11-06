---
name: debugging
description: Systematic root-cause debugging. Use for any bug, failing test, build failure, error or stack trace, unexpected behavior, flaky test, or a fix that "didn't work", before proposing a fix. Reproduce, gather evidence, trace to the source, test one hypothesis at a time, fix once, and add a regression test.
---

# Debugging

**Iron law: no fix without a root cause.** A fix that treats a symptom hides the bug and brings it back later. Use this especially under time pressure, when the fix looks obvious, and after a fix has already failed.

Process adapted from the systematic-debugging skill in obra's [superpowers](https://github.com/obra/superpowers) (MIT), reworded. Technique details are in [references/techniques.md](references/techniques.md).

## Phase 1: Find the root cause

Finish this phase before proposing any fix.

1. **Read the evidence.** Read the whole error and stack trace, top to bottom, and the code at every frame that is yours. Note exact messages, paths, line numbers, and codes. Warnings often contain the answer.
2. **Reproduce it.** Get the exact command, input, and environment, and watch it fail yourself. Is it every time or sometimes? If you can't reproduce it, collect more data (logs, versions, config) instead of guessing.
3. **Check what changed.** `git diff`, `git log -p` on the file, dependency or lockfile bumps, config, environment. `git bisect` when the last good state is known.
4. **Instrument the boundaries** in multi-part systems (CI to build to deploy, API to service to database). Log what enters and leaves each component and check config and env at each layer. Run once, find the layer where good data turns bad, then dig into that layer only.
5. **Trace backward from the symptom.** Where does the bad value come from? What passed it in? Keep going up until you reach the origin. Fix at the origin, not where it blows up (see the tracing technique in the reference).

## Phase 2: Compare with what works

- Find similar working code in the same codebase, or a reference implementation. Read it fully, not a skim.
- List every difference between the working and broken versions, however small. Don't dismiss one with "that can't matter".
- Write down the dependencies and assumptions: config, environment, ordering, data shape.

## Phase 3: One hypothesis at a time

- State it: "The root cause is X because Y." Be specific.
- Test it with the smallest possible change or observation, changing one variable at a time.
- Worked? Go to phase 4. Didn't? Form a new hypothesis from the new evidence. Don't stack another fix on top.
- If you don't understand something, say so and research it. Don't pretend.

## Phase 4: Fix and prove

1. **Write a failing test first** that reproduces the bug at its simplest (the `test-writer` agent does this). If there is no test framework, use the smallest script that fails.
2. **Make one fix** for the root cause. No "while I'm here" cleanups or bundled refactors. Grep every caller of what you change and fix it once, in the shared code.
3. **Verify.** The new test passes, the relevant suite passes, and the original reproduction no longer fails. Remove temporary logging.
4. **Make it hard to recur.** Add validation at the layers the bad data passed through when that's cheap (see defense in depth in the reference).

## If fixes keep failing

Count your attempts. After two failed fixes, go back to phase 1 with what you learned. After **three**, stop and question the design: each fix exposing new coupling or shared state elsewhere, or needing a large refactor, means the pattern is wrong, not the hypothesis. Report that to the user and discuss before trying again.

## Red flags: stop and go back to phase 1

"Quick fix now, investigate later." "Just try changing X." "I'll change several things and run the tests." "It's probably X." "I don't fully get it but this might work." Proposing fixes before tracing the data. One more attempt after two failures.

## When there truly is no root cause

If the investigation shows the cause is environmental, timing-dependent, or external, you're done with the process: document what you checked, add suitable handling (retry, timeout, a clear error), and add logging for next time. Most "no root cause" cases are an investigation stopped early, so check that yours wasn't.

## Report

The root cause in one or two sentences, the evidence for it, the fix and why it addresses the cause, the regression test, and what you couldn't verify. If unsolved, say what you ruled out and what you'd try next.

## Credits

Adapted from obra/superpowers systematic-debugging (MIT). Text is rewritten, not copied.
