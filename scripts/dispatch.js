// One entry for every Trail hook event: runs `trail hook <event>` with the host's payload, and never fails the host.
// Graphify gets no hook of its own: ctx asks it on demand.
const { spawnSync } = require("child_process");
const lib = require("./lib");

const event = process.argv[2];
try {
  if (event && lib.ready(lib.trailEntry())) {
    const { cmd, args } = lib.trailCmd(["hook", event]);
    const r = spawnSync(cmd, args, { stdio: "inherit", env: lib.toolEnv() });
    if (event === "session-start" && r.status === 0) spawnSync(process.execPath, [require("path").join(__dirname, "ctx.js"), "brief"], { stdio: "inherit", env: lib.toolEnv() });
  }
} catch {}
process.exit(0);
