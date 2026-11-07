---
name: code-review
description: High-signal review of a diff, branch or pull request for bugs, wrong logic, broken callers, security problems and violations of the repo's own written rules (CLAUDE.md, AGENTS.md). Every finding is verified and confidence-scored, and only confident ones are reported. Also covers how to act on review feedback you receive. Use when asked to review code, before merge, or after implementing a change.
---

# Code review

A review is useful in proportion to how many of its findings are real. One false alarm costs more trust than one missed nit. Method adapted from the `code-review` plugin in Anthropic's official plugin directory (Apache-2.0) and `requesting-` / `receiving-code-review` in obra's [superpowers](https://github.com/obra/superpowers) (MIT), reworded. For security depth use the `security-audit` skill.

## Scope

Review the change, not the codebase: the diff of the PR, branch or files you were given (`git diff <base>...HEAD`, `gh pr diff`). On a PR, skip and say so if it is closed, a draft, obviously trivial, or already reviewed by you. Read the PR title and description for intent. Pre-existing problems are out of scope unless the change makes them worse.

## Lenses (run them separately, in parallel if you can)

1. **Bugs in the diff.** Code that will not compile or parse, unresolved names or imports, type errors, and logic that is wrong regardless of input. Read the diff itself first.
2. **Problems the change introduces, with context.** Wrong behavior in callers and callees, changed contracts, races, data loss, missing authorization or validation at a trust boundary, secrets, migrations. Read the connected code. Where `graphify-out/` exists, run `ctx impact` on the changed files and read the "used by" files you have not seen; where `.trail/` exists, a learning that the change contradicts is a finding.
3. **The repo's written rules.** Read the root `CLAUDE.md` / `AGENTS.md` and any in directories the change touches. Flag a violation only when you can quote the exact rule and it applies to that file's path.
4. **Tests.** Behavior changed with no test that would fail if it broke, only for risky code (money, auth, data, concurrency, parsing). Say what test is missing, not "add more tests".

## Verify, then score

For each candidate, try to refute it: re-read the code, check the definition, follow the call. A finding that survives gets a confidence from 0 to 100. **Report only 80 and above.** Anything you could not validate without context you do not have is either dropped or listed under "Not checked", never reported as a defect. If an independent reader can run in a fresh context (a second subagent), have it validate each candidate before it is reported.

## Do not report

- Style, naming, formatting, or anything a linter or formatter would catch.
- Pre-existing issues; code that looks wrong but is correct.
- Issues that depend on inputs or state you cannot show, and subjective suggestions.
- General quality or test-coverage remarks beyond lens 4, and rules that the code explicitly silences with a lint-ignore.

## Report

Rank by severity (blocker, high, medium). For each: `path:line`, what is wrong, why it is real (the evidence: the line, the caller, the rule quoted), how to fix it, and confidence. When linking on GitHub use the full commit SHA and a line range with a line of context each side. End with: what you checked, and what you did not (no runtime, no integration environment, files not read). If nothing survives, say "No issues found" and list what was checked. Don't pad.

## When you receive review feedback

- Read all of it, then check each point against the code before acting. Don't agree first and verify later; "you're right" is not a technical answer.
- If something is unclear, ask before implementing any of it, since items are often related.
- Correct feedback: fix one item at a time and run the tests after each. Wrong or inapplicable feedback: say why, with the evidence, and don't implement it. Suggestions for features nobody uses get checked against how the code is actually used.
- Don't thank, don't perform enthusiasm. State what you changed.
