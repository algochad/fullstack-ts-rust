// SessionStart: make sure the two forked tools (tools.json, pinned commits) are built in the plugin data dir.
// The session never waits: the first run forks a detached worker and returns; later runs just check a stamp.
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const lib = require("./lib");

const tools = require("../tools.json");
const stampFile = path.join(lib.data, "stamp.json");
const lockFile = path.join(lib.data, "install.lock");
const logFile = path.join(lib.data, "install.log");

const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; } };
const upToDate = () => {
  const s = read(stampFile);
  return s.trail === tools.trail.commit && s.graphify === tools.graphify.commit && lib.ready(lib.trailEntry()) && lib.ready(lib.graphifyBin());
};
const overridden = () => process.env.AGENTS_KIT_TRAIL_BIN && process.env.AGENTS_KIT_GRAPHIFY_BIN;

function main() {
  if (overridden() || upToDate() || process.env.AGENTS_KIT_NO_INSTALL) return;
  fs.mkdirSync(lib.data, { recursive: true });
  // A lock younger than 30 minutes means a worker is already on it.
  try { if (Date.now() - fs.statSync(lockFile).mtimeMs < 30 * 60e3) return notice(); } catch {}
  fs.writeFileSync(lockFile, String(process.pid));
  const out = fs.openSync(logFile, "a");
  spawn(process.execPath, [__filename, "--worker"], { detached: true, stdio: ["ignore", out, out], windowsHide: true }).unref();
  notice();
}
function notice() {
  console.log("agents-kit: the ctx tools (trail, graphify) are installing in the background, so `ctx` is unavailable until " + logFile + " says done.");
}

function sh(cmd, args, opts) {
  console.log("$ " + [cmd, ...args].join(" "));
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: lib.win, ...opts });
  if (r.status !== 0) throw new Error(cmd + " failed (" + (r.status ?? r.error) + ")");
}
function checkout(name) {
  const t = tools[name], dir = lib.src(name);
  if (!fs.existsSync(path.join(dir, ".git"))) { fs.mkdirSync(dir, { recursive: true }); sh("git", ["init", "-q", dir]); sh("git", ["remote", "add", "origin", process.env["AGENTS_KIT_" + name.toUpperCase() + "_REPO"] || t.repo], { cwd: dir }); }
  sh("git", ["fetch", "--depth", "1", "origin", t.commit], { cwd: dir });
  sh("git", ["checkout", "-q", "--force", t.commit], { cwd: dir });
  return dir;
}
function worker() {
  console.log("== install " + new Date().toISOString());
  const stamp = read(stampFile);
  try {
    if (stamp.trail !== tools.trail.commit || !lib.ready(lib.trailEntry())) {
      const dir = checkout("trail");
      sh("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: dir });
      sh("npm", ["run", "build"], { cwd: dir });
      stamp.trail = tools.trail.commit;
      fs.writeFileSync(stampFile, JSON.stringify(stamp));
    }
    if (stamp.graphify !== tools.graphify.commit || !lib.ready(lib.graphifyBin())) {
      const dir = checkout("graphify");
      const py = process.env.AGENTS_KIT_PYTHON || (lib.win ? "python" : "python3");
      if (!lib.ready(lib.graphifyBin())) sh(py, ["-m", "venv", lib.venv]);
      const pip = path.join(lib.venv, lib.win ? "Scripts" : "bin", lib.win ? "python.exe" : "python");
      sh(pip, ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", dir + "[leiden,watch]"]);
      stamp.graphify = tools.graphify.commit;
      fs.writeFileSync(stampFile, JSON.stringify(stamp));
    }
    console.log("done");
  } catch (e) {
    console.log("failed: " + e.message + " (it retries at the next session start)");
  } finally {
    try { fs.unlinkSync(lockFile); } catch {}
  }
}

if (process.argv[2] === "--worker") worker(); else main();
