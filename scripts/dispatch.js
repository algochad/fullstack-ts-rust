// One entry for every Trail hook event: runs `trail hook <event>` with the host's payload, and never fails the host.
// Opt-in per repo: a repo without .trail/plugin-managed.json (made by `ctx init`) gets no hook work and no writes,
// only a one-line hint at session start. Graphify gets no hook of its own: ctx asks it on demand.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const lib = require("./lib");

// Walks up from dir; returns "init" if the repo opted in, "git" if it is a repo that has not, else null.
function repoState(dir) {
  let seenGit = false;
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".trail", "plugin-managed.json"))) return "init";
    if (fs.existsSync(path.join(d, ".git"))) seenGit = true;
    if (path.dirname(d) === d) return seenGit ? "git" : null;
  }
}

try {
  const event = process.argv[2];
  const input = fs.readFileSync(0);
  let cwd = process.cwd();
  try { cwd = JSON.parse(input).cwd || cwd; } catch {}
  const state = repoState(cwd);
  if (event && state === "init" && lib.ready(lib.trailEntry())) {
    const { cmd, args } = lib.trailCmd(["hook", event]);
    spawnSync(cmd, args, { input, stdio: ["pipe", "inherit", "inherit"], env: lib.toolEnv() });
  } else if (event === "session-start" && state === "git" && lib.ready(lib.trailEntry())) {
    console.log("ctx: this repo is not set up for code graph and team learnings; `/agents-kit:ctx-init` (or `ctx init`) does it locally. Nothing runs here until then.");
  }
} catch {}
process.exit(0);
