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
| `reviewer` | Sonnet | high | Read-only fresh-context review with a ranked report back to the main agent (pass Opus for a subtle or security-critical change) |
| `Explore` | Haiku | high | Read-only codebase search (replaces the built-in, see Notes) |
| `general-purpose` | Sonnet | high | Catch-all research and multi-step tasks (replaces the built-in, see Notes) |

**Why these models.** The model matches the job: Opus for design and planning, where a wrong plan costs the most; Sonnet for writing code and tests and for judging real bugs, where false alarms and misses both cost; Haiku only for read-only search, where the answer is a list of file locations. The main agent can pick another `model` when it spawns any of them (Opus for a hard problem, Haiku for mechanical work). **Effort is capped at high for every subagent:** each agent is set to high or lower, and a `PreToolUse` hook on the `Agent` tool refuses an effort of xhigh, max or "higher" with a message saying what to pass instead (fail closed). The model stays free.

Plugin agents are called `agents-kit:developer` and so on. Claude picks them from their descriptions, or you can ask for one by name.

### Command

`/agents-kit:tdd <feature or bug>` runs one behavior at a time through plan, red, green, and review, with a gate between phases so green never starts before red is confirmed. Each phase runs in its own context.

`/agents-kit:code-review [PR | branch] [--comment]` is Anthropic's `code-review` command: parallel reviewers (bugs in the diff, problems that need context, rule violations) whose candidates are each validated in a fresh agent, so only high-signal findings survive. It posts to GitHub only with `--comment`. Here the reviewers are `agents-kit:reviewer` agents and also run `ctx impact` and `trail check`.

### Skills

- **Superpowers skills** (obra/superpowers v7.0.2, MIT, vendored in full, namespaced `agents-kit:`): `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`, and `using-superpowers`, which a SessionStart hook injects so skills are checked before any response. Left out: `diagnosing-superpowers` (it files issues against the upstream project) and the other harnesses' tool notes.
- **`nestjs`** is this plugin's NestJS skill: detect the version and setup, structure and layering, the request pipeline (what goes in a guard, interceptor, pipe or filter), DTO validation, errors, config, persistence and transactions, Better Auth (`@thallesp/nestjs-better-auth`), testing, health checks, shutdown, background work, with references for architecture, a Nest 10/11/12 version guide (current as of 12.4), troubleshooting, and a review checklist. The security side stays in `security-audit`'s NestJS checklist.
- **`react`** is the React web skill (React 19.x, current as of 19.3): detecting the setup, components and hooks, when not to use an effect, where state lives, forms and the React 19 actions APIs, data fetching, Suspense and error boundaries, rendering performance and what React Compiler changes, accessibility in code, testing by user-visible behavior, TypeScript with React. References: patterns, versions (React 18 to 19.3, Vite 8, Next 16, React Router 8, Vitest 5), troubleshooting, a review checklist. React Native and Expo are out of scope.
- **`typescript`** covers tsconfig strictness and what each flag buys, type design (discriminated unions, branded types, `satisfies`, `unknown` over `any`), validating data at trust boundaries, async and cancellation, ESM and CommonJS, tooling, and the TypeScript 5.9, 6 and 7 situation: 6.0 changed defaults, and 7.0 is the native compiler with no JS API yet, which breaks typescript-eslint and the language server's own TypeScript. Recipes in `patterns.md` were compile-checked on 5.9.3, 6.0.3 and 7.0.2.
- **`tauri`** is for Tauri 2.x (desktop and mobile): commands, async and state, errors across the IPC boundary, events and channels, plugins and capabilities as they affect building, mobile, sidecars, the updater, and testing **without launching the app** (`cargo test`, `tauri::test`, `mockIPC`, a headless browser on the served frontend). Security depth stays in `security-audit`; versions cover 2.1 to 2.12 and the 1.x migration, and flag Tauri 3 as alpha.
- **`rust`** is Rust practice (stable 1.99, edition 2024 as the latest): workspaces and features, ownership and borrowing idioms, errors (`thiserror` for libraries, `anyhow` for applications), API design, async with tokio (no blocking the executor, no std guard across `.await`, cancellation safety), `tracing`, unsafe policy, testing, tooling and performance. Security stays in `security-audit`'s Rust checklist.
- **Expo and React Native** skills are vendored from Expo's official [expo/skills](https://github.com/expo/skills) (MIT) and Callstack's [react-native-best-practices](https://github.com/callstackincubator/agent-skills) (MIT): `expo-overview` (the router and shared rules), `expo-router`, `expo-native-ui`, `expo-ui`, `expo-data-fetching`, `expo-project-structure`, and `react-native-best-practices` (performance). Left out on purpose: Expo's EAS, store, OTA and device-driving skills, and the feedback command that reports to Expo. Each carries an "In agents-kit" section: no apps, simulators or devices are ever launched, no secrets in `EXPO_PUBLIC_*`, and verification is `tsc`, Jest, `expo export --platform web` plus the headless browser, and `expo-doctor`.
- **`frontend-design`** is Anthropic's skill, vendored in full (Apache-2.0), with an appended section for this plugin: the project's design system counts as part of the brief, stack notes for React, Expo and Tauri, and rendering checks through the bundled headless Playwright server.
- **`security-audit`** finds exploitable vulnerabilities, verifies each one, and reports only high-confidence findings.
  - Method: diff-focused scope, project context research, source-to-sink tracing, per-finding verification, false-positive exclusions, variant search, confidence-scored report.
  - Stack checklists (`references/stacks/`):
    - **Better Auth:** `trustedOrigins`, disabled CSRF and origin checks, custom routes calling `auth.api`, proxy headers and IP spoofing, rate-limit storage, cookies, plugins.
    - **NestJS:** guards and authorization (IDOR), `ValidationPipe` whitelisting, JWT, injection, Helmet, CORS, CSRF, throttling, information disclosure.
    - **React Native and Expo:** secrets in the bundle, SecureStore vs AsyncStorage, PKCE, deep links, TLS, WebViews, OTA updates.
    - **Tauri:** capabilities and permissions, scopes, `#[tauri::command]` input handling, CSP, updater, keychain storage.
    - **Rust:** `unsafe` and FFI, panics, integer overflow and casts, injection and path traversal, crypto, `cargo audit` and `cargo deny`.
- **`agents-kit:archlast-forge`** is the skill for building apps with [archlast-forge](https://github.com/algochad/archlast-forge) (blueprint, built-ins, CLI, testing, deployment). It is bundled in this plugin, as a copy of the isolated repository [archlast-forge-skills](https://github.com/algochad/archlast-forge-skills) (MIT, copied at commit 58242c0; `node scripts/sync-archlast-forge.mjs` refreshes it), which is where the skill will live once it leaves the archlast-forge repository. It is for archlast-forge projects only: a session-start and subagent-start hook mentions it only when `archlast-forge.json` is found, the agents are told to load it first there, and where its conventions differ from the generic `nestjs`, `react`, `typescript`, `frontend-design` and `security-audit` guidance, its conventions win. The generic skills still cover what it does not decide. If you also installed it on its own (the plugin from that repository, or `npx skills add`), you will have two copies.
- **`ctx`** is the front door to the code graph and team memory (below).

**How the parts fit.** `using-superpowers` is the entry point and lists every skill; process skills run first, then `ctx` to find code, then domain skills. Superpowers' subagent templates dispatch this plugin's `developer` (implementer), `reviewer` and `architect` instead of `general-purpose`. `/agents-kit:tdd` is the same red-green-refactor loop split across `test-writer`, `developer` and `reviewer`. The vendored text is unchanged except for marked "In agents-kit" sections, the renamed namespace, `--open` removed from the brainstorming visual companion (it would launch a window), and the subagent templates. One confidence scale (0 to 100, report 80+) and one severity scale (high, medium, low) are used by `reviewer`, `/agents-kit:code-review` and `security-audit`. Specs and plans are saved where upstream saves them (`docs/superpowers/`). If you install the original `superpowers`, `frontend-design` or `code-review` plugins as well, you will have two copies of each.

They load automatically when relevant, or run them by name, e.g. `/agents-kit:security-audit`.

### ctx: code graph + team memory

Two forked, local-only tools behind one command, installed automatically on the first session start:

- **[Graphify](https://github.com/algochad/graphify)** (fork of Graphify-Labs/graphify, Apache-2.0) builds a tree-sitter code graph: where things are and what connects to what, in many languages, plus docs and SQL.
- **[Trail](https://github.com/algochad/Trail-Code)** (fork of trailhq/Trail-Code, MIT) keeps what the team learned (`.trail/learnings/*.md`, each tied to files), checks a diff against them, and warns before an edit that contradicts one.

They meet at the file path: a graph node's `source_file` against a learning's `touches:`.

```
ctx init                         # once per repo: graph + learnings folder, no model calls
ctx where login                  # code locations + the learnings on those files
ctx impact [file...]             # who uses the target, what it uses, + learnings on them (default: git changes)
ctx learn --title ... -m ...     # save a learning (the main agent does this, after you agree)
ctx status
```

`/agents-kit:ctx-init` runs the first one for you. All subagents know `ctx`; `Explore` and `general-purpose` try it before grepping. The forks' `graphify` and `trail` commands are also on `PATH` while the plugin is enabled.

**What the forks change, and what they never do**
- No telemetry, update checks, cloud workspace, or model calls. The Graphify model passes are off (`GRAPHIFY_BACKEND=none`) unless you set `AGENTS_KIT_ALLOW_LLM=1`.
- Reading your past Claude sessions or PRs to propose learnings is opt-in (`trail init --mine-sessions` / `--mine-prs`) and never run by the plugin.
- Opt-in per repo: the hooks do nothing, and write nothing, in a repo until `ctx init` has run there (it creates `.trail/plugin-managed.json`). Elsewhere you get one hint line at session start.
- **Agents can't skip it.** In a repo set up with `ctx init`, every session and subagent is told the rule at start; a `PreToolUse` hook refuses `grep`, `find`, `ls`, `Grep` and `Glob` until that agent has tried `ctx` once (at most two refusals, so a broken ctx can never block work); and after the session edits files, the `Stop` hook asks once for `ctx impact`. `AGENTS_KIT_NO_GATE=1` turns all three off.
- Neither tool writes hooks, a statusline, MCP servers, or skills into `~/.claude`. The plugin registers one hook per Trail event (`scripts/dispatch.js`) and ships the skills. Graphify has no hook; it is asked on demand.
- Fixes Trail's parsing under a user git config with `diff.mnemonicPrefix`, `colorMoved` and similar.

**Install details.** `scripts/install-tools.js` runs at session start. If the pinned commits in `tools.json` are not built yet, it starts one detached worker (git, `npm ci && npm run build`, a Python venv and `pip install`) in `${CLAUDE_PLUGIN_DATA}` and returns, so the session never waits; progress is in `install.log` there. It needs `git`, Node 20.16+ or 22.3+, and Python 3.10+ on `PATH`. Until it finishes `ctx` says so and agents carry on without it. A failed install retries at the next session start. Updating the plugin to a version with new pins rebuilds them.

### Bundled Playwright browser

`.mcp.json` registers Microsoft's [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Apache-2.0), the same server as Anthropic's official `playwright` plugin, pinned to an exact version and started as `npx -y @playwright/mcp@0.0.83 --headless --isolated`. Headless means no window ever opens on your desktop; isolated means an in-memory profile with no saved logins or cookies. It reads `http(s)` URLs only (`file:` is blocked by the server), so serve the app first. Its tools appear as `mcp__plugin_agents-kit_playwright__*`; add that pattern to your allow list to skip per-tool prompts. It needs Node and a browser: if Chromium or Chrome is not installed, the server has an install tool. Don't also install Anthropic's separate `playwright` plugin, or you will have two servers. Bump the pin in `.mcp.json` deliberately; it is not `@latest` on purpose.

### Bundled dependencies

The plugin depends on three other plugins and installs them automatically. All are listed in this repo's marketplace, so one install pulls them in:

- [ponytail](https://github.com/DietrichGebert/ponytail) (MIT): a "smallest change that works" mode.
- **typescript-lsp** and **rust-analyzer-lsp**, Anthropic's official language-server plugins from [claude-plugins-official](https://github.com/anthropics/claude-plugins-official), pinned to a commit. They give Claude go-to-definition, references, hover and diagnostics for TypeScript/JavaScript and Rust. Plugins can't install language servers themselves, so agents-kit's session-start installer does: if `typescript-language-server` or `rust-analyzer` does not work on `PATH`, it installs them in the background. TypeScript: `typescript-language-server` 6.0.2 and `typescript` 5.9.3 into the plugin's data folder, linked from `~/.local/bin` (only if that is already on your `PATH`; TypeScript 7 gives empty LSP answers through this server, hence 5.x). Rust: `rustup component add rust-analyzer`. It needs `npm` or `rustup` respectively, never touches a server that already works, retries a failed install after a week, and says so in a session-start line if one is still missing. `AGENTS_KIT_NO_LSP_INSTALL=1` turns it off; Windows only gets the message, not the install.

If you already installed any of these from another marketplace, uninstall that copy, or you will have two.

## Install

```
/plugin marketplace add algochad/fullstack-ts-rust
/plugin install agents-kit@fullstack-ts-rust
```

Restart Claude Code afterwards. To try it from a local checkout: `claude --plugin-dir /path/to/fullstack-ts-rust`.

**Updating from an older version:** `claude plugin update` does not install dependencies that a new version adds, and the plugin then fails to load with "Dependency ... is not installed" (3.3.0 added the LSP plugins). Run `claude plugin install agents-kit@fullstack-ts-rust` once, then `claude plugin list`, and `claude plugin install <name>@fullstack-ts-rust` for any dependency still reported missing.

## Requirements

- **Node** on `PATH` for the hooks (see Notes). For `ctx`: also `git` and Python 3.10+, and network on the first session for the clone and `pip`.
- For the developer agent's UI smoke tests, in this order: the project's own e2e setup, Claude's built-in browser tools (when available), the bundled Playwright server (below), or a headless Playwright script. Without any, the agent reports what it couldn't verify.
- Smoke tests run headless or in Claude's own browser pane. The agent will not use Claude in Chrome or computer use unless you explicitly ask, because they take over your real browser or desktop. Expo device or simulator runs and Tauri windows are not launched.

## Notes

- **Overriding built-ins.** Plugin agents are namespaced and lowest priority, so they can't replace the built-in `Explore` and `general-purpose`. A `SessionStart` hook (`scripts/install-overrides.js`, plain Node, so it behaves the same on macOS, Linux, and Windows) copies `overrides/*.md` into `~/.claude/agents/`. It only writes when a file differs, honors `CLAUDE_CONFIG_DIR`, and overwrites local edits to those two files. To opt out, delete `hooks/hooks.json` or the files in `overrides/`. New overrides load on the next session start. Without `node`, the hook fails harmlessly and the built-ins keep their defaults.
- **Read-only agents.** `reviewer`, `architect`, and `Explore` can't use `Edit`, `Write`, or `NotebookEdit`. They keep `Bash` and are told to run only read-only commands. Plugin agents can't set `permissionMode`, so Bash is restricted by instruction, not enforced.
- **Default model.** Plugins can't set the default model or effort. Set them in `settings.json` (`"model"` and `modelSettings`).
- **Windows and macOS.** The hooks, installer and `ctx` are plain Node and ship `.cmd` shims, but have only been tested on Linux. The Python venv and `npm ci` steps are the likeliest to need attention elsewhere.
- **Uninstalling the tools.** Delete `${CLAUDE_PLUGIN_DATA}` (Claude Code does this when the plugin is uninstalled). Per-repo data stays: `graphify-out/` and `.trail/`.
- **Security skill scope.** It reports exploitable issues, not hardening advice, and skips denial of service and rate-limit findings by default. It is a review aid, not a substitute for a security audit.

## Design

Separate contexts per TDD phase, phase gates, fresh-context review, few agents with one job each, and model size matched to the task (Opus plans, Sonnet writes code, Haiku searches and reviews).

## Credits

**Vendored (with modifications marked in the files):** [expo/skills](https://github.com/expo/skills) (six skills, MIT, `licenses/expo-skills-MIT.txt`) and [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) `react-native-best-practices` (MIT, `licenses/callstack-agent-skills-MIT.txt`); [obra/superpowers](https://github.com/obra/superpowers) v7.0.2 at 22f0b46 (MIT, `licenses/superpowers-MIT.txt`); Anthropic's `frontend-design` skill and `code-review` command from [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) at 0412be7 (Apache-2.0, `licenses/anthropic-*-Apache-2.0.txt`, `skills/frontend-design/LICENSE.txt`). Modified by algochad; not endorsed by their authors.

**Written for this plugin, informed by:** the `react`, `typescript`, `tauri` and `rust` skills draw on the official docs and release notes of each project (react.dev, the TypeScript blog and release notes, v2.tauri.app and its docs repo, the Rust blog, Edition Guide, Cargo book and tokio docs) and on community skills: [affaan-m/ECC](https://github.com/affaan-m/ECC), [wshobson/agents](https://github.com/wshobson/agents), [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills), [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates), [mattpocock/skills](https://github.com/mattpocock/skills), [remix-run/remix](https://github.com/remix-run/remix), [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills), [morganlinton/BeautifulRust](https://github.com/morganlinton/BeautifulRust), [apollographql/skills](https://github.com/apollographql/skills), [leonardomso/rust-skills](https://github.com/leonardomso/rust-skills), [mukiwu/tempo-term](https://github.com/mukiwu/tempo-term), [travisjneuman/.claude](https://github.com/travisjneuman/.claude), [julien-blanchon/Montelimar](https://github.com/julien-blanchon/Montelimar) and [j4flmao/agent-skills](https://github.com/j4flmao/agent-skills) (all MIT or Apache-2.0; ideas rewritten, nothing copied; sources without a license were read but not used); the `nestjs` skill draws on the official [NestJS docs](https://docs.nestjs.com) and migration guides, the `nestjs-patterns` skill in [affaan-m/ECC](https://github.com/affaan-m/ECC) (about 299k stars, MIT), the NestJS review guide in [awesome-skills/code-review-skill](https://github.com/awesome-skills/code-review-skill) (about 2.2k stars, MIT), and the `nestjs-expert` troubleshooting in [diegosouzapw/awesome-omni-skills](https://github.com/diegosouzapw/awesome-omni-skills) (MIT; originally sickn33); the security-audit skill draws on [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) (MIT) and [trailofbits/skills](https://github.com/trailofbits/skills) (CC-BY-SA-4.0; fp-check and variant-analysis); the stack checklists summarize the official Better Auth, NestJS, Tauri, Expo and React Native security documentation.

ctx bundles forks of [Graphify](https://github.com/Graphify-Labs/graphify) (Apache-2.0, with portions MIT; modified by algochad, see `licenses/graphify-NOTICE.txt`) and [Trail-Code](https://github.com/trailhq/Trail-Code) (MIT). Their licenses are in `licenses/`; their guidance is rewritten into `skills/ctx/references/`, not shipped as separate skills (the originals told agents to install the upstream packages and register their own hooks, which conflicts with this plugin). They are not affiliated with this plugin or endorsing it.

This plugin is MIT licensed.
