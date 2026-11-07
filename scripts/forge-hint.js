// SessionStart and SubagentStart: in an archlast-forge project (archlast-forge.json at or above the working directory) say
// so, and name the skill whose conventions win. Silent everywhere else, so other projects pay nothing for the skill.
const fs = require("fs");
const path = require("path");

function isForgeProject(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, "archlast-forge.json"))) return true;
    if (path.dirname(d) === d) return false;
  }
}

const TEXT =
  "This is an archlast-forge project (archlast-forge.json). Before you create, change or review code here, load the `agents-kit:archlast-forge` skill: " +
  "its conventions are mandatory and beat the generic NestJS, React, TypeScript, frontend-design and security guidance wherever they differ " +
  "(for example Nest imports come from `@archlast/forge-runtime/nest`, never `@nestjs/*`). The generic skills still cover what it does not decide. " +
  "Do not edit `forge/_generated/`. A subagent cannot ask the user, so it reports the destructive commands that skill lists instead of running them.";

try {
  let p = {};
  try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch {}
  if (isForgeProject(p.cwd || process.cwd()))
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: p.hook_event_name || "SessionStart", additionalContext: TEXT } }));
} catch {}
process.exit(0);
