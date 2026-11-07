// PreToolUse on the Agent (Task) tool: the main agent may pick any model for a subagent, but the effort is capped at high.
// Fails closed: an effort above high (xhigh, max, or the relative "higher") is refused with a message that says what to pass instead.
const fs = require("fs");

const OK = new Set(["low", "medium", "high", "lower"]);
try {
  let p = {};
  try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch {}
  const effort = p.tool_input && p.tool_input.effort;
  if (effort !== undefined && !OK.has(String(effort).toLowerCase()))
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny",
      permissionDecisionReason: `Subagent effort is capped at high here (you passed effort: ${effort}). Spawn it again with effort high, medium, low or lower, or leave effort out so the agent's own setting applies. You may still choose the model.` } }));
} catch {}
process.exit(0);
