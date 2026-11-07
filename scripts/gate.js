// Hooks that make the agent use ctx instead of hoping it will. Only active in a repo that ran `ctx init`, with the tools
// installed and a graph present; AGENTS_KIT_NO_GATE=1 turns them off. Events (argv[2]):
//   rule        SessionStart / SubagentStart: tell the model the rule, plus the one-line ctx status
//   gate        PreToolUse Bash|Grep|Glob: refuse a code search until this agent has tried ctx once (at most twice, never a deadlock)
//   mark-edit   PostToolUse Write|Edit|MultiEdit: remember that this session changed files
//   stop-gate   Stop: after edits, ask once for `ctx impact` before finishing
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const lib = require("./lib");

const RULE =
  "agents-kit RULE for this repo (it has a code graph and team learnings): your first search of the code in a task is `ctx where <symbol, file or phrase>`, " +
  "not ls, find, grep or Grep/Glob. It returns file:line plus what the team learned about those files, in one call. Read what it points at. " +
  "Before you finish a change, run `ctx impact` and look at the \"used by\" files. A hook refuses a code search until you have tried ctx once.";
const DENY = "Run `ctx where <what you are looking for>` first (agents-kit rule): one call returns the code locations and the team learnings on them. After one ctx call, grep, find and ls are open again.";
const STOP = "You changed files this session. Run `ctx impact` (no arguments: it covers the git changes) and check any \"used by\" file you have not looked at, then finish. This is asked once.";

function repoRoot(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".trail", "plugin-managed.json"))) return d;
    if (path.dirname(d) === d) return null;
  }
}
const active = (root) => root && !process.env.AGENTS_KIT_NO_GATE && lib.ready(lib.trailEntry()) && lib.ready(lib.graphifyBin()) && fs.existsSync(path.join(root, "graphify-out", "graph.json"));

// Per-session state in the plugin data dir, pruned after a day.
function state(key) {
  const dir = path.join(lib.data, "gate");
  const file = path.join(dir, crypto.createHash("sha1").update(key).digest("hex").slice(0, 16) + ".json");
  let s = {};
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  return { s, save: () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(s)); } catch {} }, dir };
}
function prune(dir) {
  try { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (Date.now() - fs.statSync(p).mtimeMs > 864e5) fs.unlinkSync(p); } } catch {}
}

const CTX = /(^|&&|;|\|\|?|\()\s*ctx(\s|$)/; // only ctx opens the gate: it is the join of the two tools
const IMPACT = /(^|&&|;|\|\|?|\()\s*ctx\s+impact(\s|$)/;
const SEARCH = /(^|&&|;|\|\|?|\()\s*(cd\s+[^;&|]+(&&|;)\s*)?(git\s+grep|grep|egrep|fgrep|rg|find|ls|tree|fd|ag|ack)(\s|$)/;

function decide(event, p) {
  const root = repoRoot(p.cwd || process.cwd());
  if (!active(root)) return null;
  const sid = p.session_id || "none";
  const hookOut = (name, extra) => ({ hookSpecificOutput: { hookEventName: name, ...extra } });
  if (event === "rule") {
    const brief = spawnSync(process.execPath, [path.join(__dirname, "ctx.js"), "brief"], { cwd: root, encoding: "utf8", env: lib.toolEnv() }).stdout.trim();
    return hookOut(p.hook_event_name || "SessionStart", { additionalContext: [brief, RULE].filter(Boolean).join("\n") });
  }
  if (event === "mark-edit") { const st = state(sid); st.s.edited = true; st.save(); return null; }
  if (event === "stop-gate") {
    const st = state(sid);
    if (!st.s.edited || st.s.impact || p.stop_hook_active || st.s.stopAsked) return null;
    st.s.stopAsked = true; st.save();
    return { decision: "block", reason: STOP };
  }
  if (event !== "gate") return null;
  const st = state(sid + "|" + (p.agent_id || "main"));
  prune(st.dir);
  const cmd = String(p.tool_input?.command || "");
  if (p.tool_name === "Bash" && CTX.test(cmd)) {
    st.s.tried = true; st.save();
    if (IMPACT.test(cmd)) { const top = state(sid); top.s.impact = true; top.save(); }
    return null;
  }
  const search = p.tool_name === "Grep" || p.tool_name === "Glob" || (p.tool_name === "Bash" && SEARCH.test(cmd));
  if (!search || st.s.tried || (st.s.denied || 0) >= 2) return null;
  st.s.denied = (st.s.denied || 0) + 1; st.save();
  return hookOut("PreToolUse", { permissionDecision: "deny", permissionDecisionReason: DENY });
}

module.exports = { decide, RULE };
if (require.main === module) {
  try {
    let p = {};
    try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch {}
    const out = decide(process.argv[2], p);
    if (out) console.log(JSON.stringify(out));
  } catch {}
  process.exit(0);
}
