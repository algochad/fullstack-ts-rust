---
description: Run a feature through plan, red, green, review using the agents-kit subagents
argument-hint: <feature or bug to implement>
---

Implement this with the agents-kit TDD pipeline: $ARGUMENTS

Run the phases in order, each in its own subagent. Do not start a phase until the previous gate passes. Finish one behavior completely before starting the next.

1. **Plan (skip for small tasks):** `agents-kit:architect` returns the steps and the first failing test for each.
2. **Red:** `agents-kit:test-writer` writes one failing test. Gate: it reports the failure output and the failure is for the right reason.
3. **Green:** `agents-kit:developer` implements the minimum to pass that test, and smoke tests headless if the change is frontend. Gate: the new test and the relevant suite pass.
4. **Review:** `agents-kit:reviewer` reads the change and returns a ranked report. Fix anything high or medium, then re-run the tests.
5. Repeat from step 2 for the next behavior.

Report to me: the plan, the tests added, the commands run with results, the reviewer's findings, and anything skipped or unverified. You decide which findings to act on; don't apply the reviewer's suggestions blindly.
