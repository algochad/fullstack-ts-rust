// Language servers for the bundled typescript-lsp and rust-analyzer-lsp plugins. Those plugins spawn the server by bare
// name from Claude Code's own PATH, which does not include this plugin's bin/, so a server has to be on the user's PATH.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const lib = require("./lib");

// Pinned. TypeScript 7 (the native port) answers LSP requests with empty results through this server, so stay on 5.x.
const TS = { "typescript-language-server": "6.0.2", typescript: "5.9.3" };

// "Exists on PATH" is not enough: rustup leaves a rust-analyzer proxy behind that fails when the component is missing.
const works = (bin) => { try { return spawnSync(bin, ["--version"], { timeout: 5000, stdio: "ignore", shell: lib.win }).status === 0; } catch { return false; } };
const have = (bin) => works(bin);
const pathDirs = () => (process.env.PATH || "").split(path.delimiter).filter(Boolean);

// The one place we may put a link: ~/.local/bin, only if it is already on PATH and writable.
function linkDir() {
  const dir = path.join(os.homedir(), ".local", "bin");
  if (lib.win || !pathDirs().some((d) => path.resolve(d) === dir)) return null;
  try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); return dir; } catch { return null; }
}

function installTypescript(sh) {
  const prefix = path.join(lib.data, "lsp");
  fs.mkdirSync(prefix, { recursive: true });
  sh("npm", ["install", "--prefix", prefix, "--no-audit", "--no-fund", "--ignore-scripts", ...Object.entries(TS).map(([n, v]) => `${n}@${v}`)]);
  const bin = path.join(prefix, "node_modules", ".bin", "typescript-language-server");
  const dir = linkDir();
  if (!dir) throw new Error("no ~/.local/bin on PATH to link into; add " + path.dirname(bin) + " to PATH or run: npm i -g typescript@5 typescript-language-server");
  const link = path.join(dir, "typescript-language-server");
  if (fs.existsSync(link) || fs.lstatSync(link, { throwIfNoEntry: false })) fs.rmSync(link, { force: true });
  fs.symlinkSync(bin, link);
}

function installRust(sh) { sh("rustup", ["component", "add", "rust-analyzer"]); }

// Which servers are missing and installable here (a package manager exists)? A verified server is not re-checked for a
// week and a failed install is not retried for a week, so a normal session start spawns nothing. Mutates stamp.lsp.
const WEEK = 7 * 864e5;
function missing(stamp) {
  if (process.env.AGENTS_KIT_NO_LSP_INSTALL) return [];
  stamp.lsp ||= {};
  const out = [];
  for (const [k, bin, installer] of [["ts", "typescript-language-server", "npm"], ["rust", "rust-analyzer", "rustup"]]) {
    const e = stamp.lsp[k] || {};
    if (Date.now() - (e.ok || 0) < WEEK || Date.now() - (e.failed || 0) < WEEK) continue;
    if (have(bin)) stamp.lsp[k] = { ok: Date.now() };
    else if (have(installer)) out.push(k);
  }
  return out;
}

module.exports = { TS, works, have, missing, installTypescript, installRust, linkDir };
