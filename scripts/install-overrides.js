// Plugin agents can't replace built-ins, so copy the overrides to user scope, which can.
const fs = require("fs");
const os = require("os");
const path = require("path");

const src = path.join(__dirname, "..", "overrides");
const dest = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "agents");

fs.mkdirSync(dest, { recursive: true });
for (const f of fs.readdirSync(src).filter((n) => n.endsWith(".md"))) {
  const from = fs.readFileSync(path.join(src, f));
  const to = path.join(dest, f);
  if (!fs.existsSync(to) || !from.equals(fs.readFileSync(to))) fs.writeFileSync(to, from);
}
