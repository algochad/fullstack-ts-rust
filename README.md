# agents-kit

**agents-kit** is a Claude Code plugin (repo: `fullstack-ts-rust`) for **fullstack TypeScript and Rust** work: web and backend, mobile, and desktop. It gives you tiered subagents (Opus, Sonnet, Haiku), a test-first pipeline, and two skills for debugging and security review that know your stack.

## Stack coverage

| Area | Technologies |
|---|---|
| Web and backend | TypeScript, React, NestJS, Better Auth |
| Mobile | React Native with Expo |
| Desktop and mobile native | Tauri v2 |
| Systems and native code | Rust |

The agents and skills detect which of these a repo uses (from `package.json`, `Cargo.toml`, `tauri.conf.json`, `app.json`, and imports) and apply the matching checks.

## What you get

### Subagents

| Agent | Model | Effort | Role |
|---|---|---|---|
| `architect` | Opus | high | Read-only design: explores the code and returns a step-by-step plan with the failing test for each step |
| `test-writer` | Sonnet | high | TDD red phase: writes one failing test and confirms it fails for the right reason. Edits tests only |
| `developer` | Sonnet | high | TDD green and refactor phase: minimal implementation, per-stack testing, headless smoke tests for UI |
| `reviewer` | Haiku | high | Read-only fresh-context review with a ranked report back to the main agent |
| `Explore` | Haiku | high | Read-only codebase search (replaces the built-in, see Notes) |
| `general-purpose` | Haiku | max | Catch-all research and multi-step tasks (replaces the built-in, see Notes) |

Plugin agents are called `agents-kit:developer` and so on. Claude picks them from their descriptions, or you can ask for one by name.

### Command

`/agents-kit:tdd <feature or bug>` runs one behavior at a time through plan, red, green, and review, with a gate between phases so green never starts before red is confirmed. Each phase runs in its own context.

### Skills

- **`security-audit`** finds exploitable vulnerabilities, verifies each one, and reports only high-confidence findings.
  - Method: diff-focused scope, project context research, source-to-sink tracing, per-finding verification, false-positive exclusions, variant search, confidence-scored report.
  - Stack checklists (`references/stacks/`):
    - **Better Auth:** `trustedOrigins`, disabled CSRF and origin checks, custom routes calling `auth.api`, proxy headers and IP spoofing, rate-limit storage, cookies, plugins.
    - **NestJS:** guards and authorization (IDOR), `ValidationPipe` whitelisting, JWT, injection, Helmet, CORS, CSRF, throttling, information disclosure.
    - **React Native and Expo:** secrets in the bundle, SecureStore vs AsyncStorage, PKCE, deep links, TLS, WebViews, OTA updates.
    - **Tauri:** capabilities and permissions, scopes, `#[tauri::command]` input handling, CSP, updater, keychain storage.
    - **Rust:** `unsafe` and FFI, panics, integer overflow and casts, injection and path traversal, crypto, `cargo audit` and `cargo deny`.
- **`debugging`** is evidence-first root-cause debugging: reproduce, trace backward, one hypothesis at a time, fix once, add a regression test. After three failed fixes it stops and questions the design. It includes starting points for NestJS, Better Auth, Expo, Tauri, and Rust.

They load automatically when relevant, or run `/agents-kit:security-audit` and `/agents-kit:debugging`.

### Bundled dependency

The plugin depends on [ponytail](https://github.com/DietrichGebert/ponytail) (MIT), a "smallest change that works" mode, and installs it automatically. It is listed in this repo's marketplace so a single install pulls it in.

## Install

```
/plugin marketplace add algochad/fullstack-ts-rust
/plugin install agents-kit@fullstack-ts-rust
```

Restart Claude Code afterwards. To try it from a local checkout: `claude --plugin-dir /path/to/fullstack-ts-rust`.

If you already installed ponytail from its own marketplace, uninstall that copy first (`claude plugin uninstall ponytail@ponytail`), or you will have two.

## Requirements

- **Node** on `PATH` for the override hook (see Notes).
- For the developer agent's UI smoke tests, any one of: the project's own e2e setup, Claude's built-in browser tools (no install needed, when available), or Playwright. Without any, the agent reports what it couldn't verify.
- Smoke tests run headless or in Claude's own browser pane. The agent will not use Claude in Chrome or computer use unless you explicitly ask, because they take over your real browser or desktop. Expo device or simulator runs and Tauri windows are not launched.

## Notes

- **Overriding built-ins.** Plugin agents are namespaced and lowest priority, so they can't replace the built-in `Explore` and `general-purpose`. A `SessionStart` hook (`scripts/install-overrides.js`, plain Node, so it behaves the same on macOS, Linux, and Windows) copies `overrides/*.md` into `~/.claude/agents/`. It only writes when a file differs, honors `CLAUDE_CONFIG_DIR`, and overwrites local edits to those two files. To opt out, delete `hooks/hooks.json` or the files in `overrides/`. New overrides load on the next session start. Without `node`, the hook fails harmlessly and the built-ins keep their defaults.
- **Read-only agents.** `reviewer`, `architect`, and `Explore` can't use `Edit`, `Write`, or `NotebookEdit`. They keep `Bash` and are told to run only read-only commands. Plugin agents can't set `permissionMode`, so Bash is restricted by instruction, not enforced.
- **Default model.** Plugins can't set the default model or effort. Set them in `settings.json` (`"model"` and `modelSettings`).
- **Windows and macOS.** The hook is written to be cross-platform but has only been tested on Linux.
- **Security skill scope.** It reports exploitable issues, not hardening advice, and skips denial of service and rate-limit findings by default. It is a review aid, not a substitute for a security audit.

## Design

Separate contexts per TDD phase, phase gates, fresh-context review, few agents with one job each, and model size matched to the task (Opus plans, Sonnet writes code, Haiku searches and reviews).

## Credits

The skills are rewritten, not copied, from ideas in [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) (MIT), [trailofbits/skills](https://github.com/trailofbits/skills) (CC-BY-SA-4.0; fp-check and variant-analysis), and [obra/superpowers](https://github.com/obra/superpowers) (MIT; systematic-debugging). Stack checklists summarize the official Better Auth, NestJS, Tauri, Expo, and React Native security documentation.

MIT licensed.
