---
description: Review a PR, a branch, or the current changes with parallel lenses and verified, confidence-scored findings
argument-hint: [PR number | branch | path...] [--comment]
---

Review: $ARGUMENTS (no argument means the current uncommitted and unpushed changes against the default branch).

Follow the `agents-kit:code-review` skill. Work out the scope first: for a PR number use `gh pr view` and `gh pr diff`; for a branch `git diff <default-branch>...<branch>`; otherwise `git diff` plus `git status`. On a PR, stop and say so if it is closed, a draft, trivial, or already reviewed by you.

Then, in one message, start these in parallel with `agents-kit:reviewer`, each told the scope, the PR title and description, and its one lens, and told to report candidates only (no fixes, no style, no pre-existing issues):
1. bugs in the diff itself (compile errors, wrong logic);
2. problems the change introduces that need context (callers via `ctx impact`, security, data, contract changes);
3. violations of the repo's `CLAUDE.md` / `AGENTS.md` that apply to the changed paths, quoting the rule.

When they return, validate each candidate in its own fresh agent (`agents-kit:reviewer`, `model: sonnet`), giving it only the claim, the code location and the PR intent, and asking it to try to refute the claim and give a confidence 0 to 100. Keep findings of 80 or more that survived.

Report to me, ranked: `path:line`, the problem, the evidence, the fix, confidence. End with what was checked and what was not. If nothing survived, say "No issues found" and what was checked.

Do not post anything to GitHub unless `--comment` is in the arguments. With `--comment`, post one summary comment with `gh pr comment`, no duplicate comments, and show me the text first.
