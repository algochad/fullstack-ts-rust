---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. Brainstorming and systematic-debugging are Superpowers' most common process skills, but the rule holds for any of them.

- "Let's build X" → agents-kit:brainstorming first, then implementation skills.
- "Fix this bug" → agents-kit:systematic-debugging first, then domain skills.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Platform Adaptation

Claude Code is the only harness this plugin targets: `references/claude-code-tools.md`.

## In agents-kit

This copy of the skill ships inside the agents-kit plugin, so "your skills" are the ones below, all invoked as `agents-kit:<name>`. (Added by agents-kit; the rest of this file is upstream.)

- **Process skills, first:** `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review` / `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `dispatching-parallel-agents`, `writing-skills`.
- **Finding code:** `ctx` is part of the Skill check, and in a repo set up with `ctx init` its command, `ctx where <thing>`, is the first search you make; a hook refuses grep, find, ls, Grep and Glob until you have tried it. After it, read what it pointed at.
- **Domain skills, after the process skill:** `nestjs`, `react`, `typescript`, `tauri`, `rust` and `expo-overview` (Expo and React Native; it routes to the other `expo-*` skills) for work in those stacks (more than one can apply: a Tauri app is `tauri` plus `rust` plus `typescript` and `react`), `frontend-design` for any UI, `security-audit` for auth, input, secrets, files, IPC or dependencies.
- **Commands:** `/agents-kit:code-review` (parallel, verified PR review), `/agents-kit:tdd` (plan, red, green, review in separate agents), `/agents-kit:ctx-init`.
- **Subagent roles map to this plugin's agents.** Wherever a skill says to dispatch a `general-purpose` subagent for one of these roles, use the plugin's agent instead: implementer is `agents-kit:developer`, red phase is `agents-kit:test-writer`, planner is `agents-kit:architect`, reviewer is `agents-kit:reviewer`. They are tiered by model on purpose; don't override it unless a skill says to.
- **The ponytail skill** decides how much to build and how long the reply is; these skills decide the process. They don't conflict: do the process, keep the change small, keep the reply short.
- **Windows and desktop:** nothing here opens a visible window or takes over the user's mouse, keyboard or Chrome. Where a skill offers a browser or visual companion, serve it on localhost and give the user the URL; never auto-open it. UI checks use the project's e2e setup, Claude's built-in browser pane, or the bundled headless Playwright server, never Claude in Chrome or computer use unless the user asked.

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, etc, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.
