// Shared by the bin wrappers, the installer and the hook dispatcher: where the two forked tools live.
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const win = process.platform === "win32";
const data =
  process.env.CLAUDE_PLUGIN_DATA ||
  path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "plugins", "data", "agents-kit");
const src = (name) => path.join(data, "src", name);
const venv = path.join(data, "venv");

// AGENTS_KIT_*_BIN / _DIR point at an existing build (development, tests); otherwise the installer's copy.
function trailEntry() {
  if (process.env.AGENTS_KIT_TRAIL_BIN) return process.env.AGENTS_KIT_TRAIL_BIN;
  const dir = process.env.AGENTS_KIT_TRAIL_DIR || src("trail");
  return path.join(dir, "dist", "bin", "trail.js");
}
function graphifyBin() {
  if (process.env.AGENTS_KIT_GRAPHIFY_BIN) return process.env.AGENTS_KIT_GRAPHIFY_BIN;
  return path.join(venv, win ? "Scripts" : "bin", win ? "graphify.exe" : "graphify");
}
const ready = (f) => fs.existsSync(f);

// Graph-pass off by default: nothing here may call a model or the network on its own.
function toolEnv(extra) {
  return { ...process.env, DO_NOT_TRACK: "1", GRAPHIFY_BACKEND: process.env.AGENTS_KIT_ALLOW_LLM ? process.env.GRAPHIFY_BACKEND || "" : "none", ...extra };
}
function trailCmd(args) {
  const e = trailEntry();
  return e.endsWith(".js") ? { cmd: process.execPath, args: [e, ...args] } : { cmd: e, args };
}

module.exports = { root, data, src, venv, win, trailEntry, graphifyBin, ready, toolEnv, trailCmd };
