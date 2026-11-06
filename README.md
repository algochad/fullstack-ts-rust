# agents-kit

A Claude Code plugin of subagents tiered by model, built around a TDD pipeline.

| Agent | Model | Effort | Role |
|---|---|---|---|
| `architect` | opus | high | Read-only design and step-by-step plan |
| `test-writer` | sonnet | high | TDD red: one failing test, confirmed failing |
| `developer` | sonnet | high | TDD green/refactor, headless smoke test for UI |
| `reviewer` | haiku | high | Read-only fresh-context review, ranked report |
| `Explore` | haiku | high | Read-only codebase search |
| `general-purpose` | haiku | max | Catch-all research and multi-step tasks |

Command: `/agents-kit:tdd <feature>` runs plan, red, green, review with a gate between phases.

## Install

```
/plugin marketplace add algochad/claude-agents-kit
/plugin install agents-kit@agents-kit
```

Or try locally: `claude --plugin-dir /path/to/claude-agents-kit`

## Notes

- Plugin agents are namespaced (`agents-kit:developer`). `Explore` and `general-purpose` may not replace the built-ins of the same name; if they don't, copy those two files to `~/.claude/agents/`.
- `reviewer` and `architect` are read-only by `disallowedTools` plus an instruction to use only read-only Bash. Plugin agents can't set `permissionMode`, so Bash is not hard-blocked.
- The smoke test needs Playwright (or the project's e2e setup) installed. Without it the developer reports what it couldn't verify.
- Design ideas: separate contexts per TDD phase, phase gates, fresh-context review, few agents.
