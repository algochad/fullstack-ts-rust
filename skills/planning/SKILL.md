---
name: planning
description: Settle what to build before building it, then write a plan a different engineer or agent could follow. Use for a new feature, a change in behavior, a refactor, or anything where the request leaves something open that would change the design. Clarify intent and constraints, lay out approaches, get a choice, then write small steps with exact files and the test for each.
---

# Planning

Find out what is wanted and why before deciding how, then write steps small enough to follow without guessing. Ideas from `brainstorming` and `writing-plans` in obra's [superpowers](https://github.com/obra/superpowers) (MIT), reworded and shortened.

## 1. What do you know?

- If everything that matters is in the request ("make the icon cornflower blue"), do it and say what you did. Don't run a process on a clear task.
- Otherwise read first: the code, docs and tickets the request points at, until you can say how the relevant part works today and what the change touches. Don't ask what the project already answers.

## 2. Say it back, ask one thing

Restate the request in your words: what, for whom, why. Add what you found that bears on it, including a constraint, a conflict or a cheaper path they may not have seen. If the why is missing, ask for it in one open question. If a choice would change what gets built, ask only that one and sketch each option with its trade-off and which you'd pick. Don't send a list of questions.

## 3. Approaches

When more than one sensible design exists, lay out two or three: what each does, what it costs, and your recommendation with the reason. Include the do-less option. Get a pick before building anything that is hard to undo.

## 4. Write the plan

- Start from the smallest design that fully solves it; name what you are deliberately not doing.
- Break the work into steps of a few minutes each. For each step give: the files to create or change (exact paths), the failing test to write first and how to run it, the minimal change, and the check that proves it.
- Order for early feedback: the riskiest or most uncertain step first, a working thin slice before breadth.
- No placeholders: no "add error handling", no "similar to step 3". Write the code shape or the exact behavior.
- List risks: data loss, migrations, auth, behavior other code relies on, and what you could not verify.
- Where `graphify-out/` or `.trail/` exists, use `ctx where` and `ctx impact` to find what the change touches and which past decisions apply, and name them in the plan.

## 5. Hand off

Give the plan to whoever builds it (the `developer` agent, one behavior at a time via `/agents-kit:tdd`). After each step verify with the `verification` skill before starting the next. If reality contradicts the plan, stop and revise the plan; don't improvise silently.
