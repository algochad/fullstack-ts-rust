# agents-kit

A Claude Code plugin of subagents tiered by model, built around a TDD pipeline. Aimed at web and backend TypeScript (React, NestJS, Better Auth), React Native with Expo, Tauri (desktop and mobile), and Rust.

| Agent | Model | Effort | Role |
|---|---|---|---|
| `architect` | opus | high | Read-only design and step-by-step plan |
| `test-writer` | sonnet | high | TDD red: one failing test, confirmed failing |
| `developer` | sonnet | high | TDD green/refactor, headless smoke test for UI |
| `reviewer` | haiku | high | Read-only fresh-context review, ranked report |
| `Explore` (override) | haiku | high | Read-only codebase search |
| `general-purpose` (override) | haiku | max | Catch-all research and multi-step tasks |

Skills: `debugging` (reproduce, find the root cause, fix once, regression test) and `security-audit` (stack checklists for Better Auth, NestJS, Expo/React Native, Tauri and Rust; diff-focused hunt, per-finding verification, false-positive exclusions, variant search, confidence-scored report). They load automatically when relevant, or call `/agents-kit:debugging` and `/agents-kit:security-audit`.

Command: `/agents-kit:tdd <feature>` runs plan, red, green, review with a gate between phases.

## Install

```
/plugin marketplace add algochad/claude-agents-kit
/plugin install agents-kit@agents-kit
```

Or try locally: `claude --plugin-dir /path/to/claude-agents-kit`

## Notes

- Plugin agents are namespaced (`agents-kit:developer`) and have the lowest priority, so they can't replace built-ins. To override `Explore` and `general-purpose`, a `SessionStart` hook (a small Node script, so it runs the same on macOS, Linux and Windows) copies `overrides/*.md` to `~/.claude/agents/` (only when they differ, so plugin updates propagate). This overwrites local edits to those two files. To opt out, delete `hooks/hooks.json` or the files in `overrides/`. New overrides load on the next session start.
- `reviewer` and `architect` are read-only by `disallowedTools` plus an instruction to use only read-only Bash. Plugin agents can't set `permissionMode`, so Bash is not hard-blocked.
- The override hook needs `node` on PATH; without it the hook fails harmlessly and the two built-ins stay at their defaults. It honors `CLAUDE_CONFIG_DIR`.
- The smoke test needs Playwright (or the project's e2e setup) installed. Without it the developer reports what it couldn't verify.
- Design ideas: separate contexts per TDD phase, phase gates, fresh-context review, few agents.

## Credits

Skills are rewritten (not copied) from ideas in: [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) (MIT), [trailofbits/skills](https://github.com/trailofbits/skills) (CC-BY-SA-4.0; fp-check and variant-analysis), and [obra/superpowers](https://github.com/obra/superpowers) (MIT; systematic-debugging).
