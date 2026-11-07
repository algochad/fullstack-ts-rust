// SessionStart: the bundled LSP plugins need a language server on PATH. install-tools.js installs them in the background;
// this says so when one is still missing in a project that uses the language, and is silent otherwise.
const fs = require("fs");
const path = require("path");
const lib = require("./lib");
const lsp = require("./lsp");

const up = (names) => { for (let d = process.cwd(); ; d = path.dirname(d)) { if (names.some((n) => fs.existsSync(path.join(d, n)))) return true; if (path.dirname(d) === d) return false; } };
let stamp = {};
try { stamp = JSON.parse(fs.readFileSync(path.join(lib.data, "stamp.json"), "utf8")); } catch {}
const verified = (k) => Date.now() - (stamp.lsp?.[k]?.ok || 0) < 7 * 864e5;

const lines = [];
if (up(["tsconfig.json", "package.json"]) && !verified("ts") && !lsp.have("typescript-language-server"))
  lines.push("TypeScript language server is not installed (`npm i -g typescript@5 typescript-language-server`).");
if (up(["Cargo.toml"]) && !verified("rust") && !lsp.have("rust-analyzer"))
  lines.push("rust-analyzer is not installed (`rustup component add rust-analyzer`).");
if (lines.length)
  console.log("agents-kit LSP: " + lines.join(" ") + " agents-kit tries to install these itself at session start (set AGENTS_KIT_NO_LSP_INSTALL=1 to stop it); if this line keeps appearing, read " + path.join(lib.data, "install.log") + ".");
process.exit(0);
