---
description: Build the code graph and the team-learnings folder for this repo (local, no model calls)
---

Run `ctx init` in this repo. It builds `graphify-out/` (code graph) and `.trail/` (learnings and code map), writing nothing to the Claude config.

Then run `ctx status` and tell me: nodes in the graph, learnings found, and whether `graphify-out/` should go in `.gitignore`. Suggest committing `.trail/` (not `graphify-out/`) so teammates' agents start from the same learnings. Do not commit anything yourself.

If `ctx` is not installed yet, read the tail of the installer log named in its error and report what it says.
