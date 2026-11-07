---
name: verification
description: Evidence before claims. Use before saying work is done, fixed, passing or ready, before committing, opening a PR or handing back to the user, and when relaying what a subagent reported. Run the command that proves the claim, read its output, then state the result with the evidence.
---

# Verification before completion

**No completion claim without fresh evidence from this turn.** "Should work" and "looks right" are guesses. Idea from `verification-before-completion` in obra's [superpowers](https://github.com/obra/superpowers) (MIT), reworded.

## The check

Before you say anything is done, fixed, passing or ready:
1. Name the command that would prove it.
2. Run it in full, now, not a remembered run or a partial one.
3. Read the whole output: exit code, failure count, warnings.
4. If it does not confirm the claim, report the real status with the output. If it does, state the claim and the evidence together.

## What counts

| Claim | Needs | Not enough |
|---|---|---|
| Tests pass | the test command, zero failures | an earlier run, "it should pass" |
| Types and lint clean | `tsc --noEmit`, the linter, zero errors | one of them passing |
| Build works | the build command, exit 0 | lint passing |
| Bug fixed | the original repro now passes | code changed, assumed fixed |
| New regression test is real | it fails without the fix, passes with it | it passes once |
| Requirement met | each requirement checked against the result | tests green |
| UI works | the flow exercised in a real render | the code compiles |
| Subagent finished | the diff and a rerun of its checks | its own report |

## Say it plainly

Report what ran, what it showed, and what you did not or could not verify (no device, no network, flaky, skipped). Don't use "should", "probably" or "seems to" about something you could have run. Don't open with "Done!" before the evidence. If you are tired, rushed or sure, the rule still applies.
