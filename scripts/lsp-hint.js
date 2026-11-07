// SessionStart: the two bundled LSP plugins (typescript-lsp, rust-analyzer-lsp) start language servers that must be on
// PATH. Plugins cannot install those, so say so, once per session, only where the project uses the language and the
// server is missing. Silent otherwise.
const fs = require("fs");
const path = require("path");

const onPath = (bin) => (process.env.PATH || "").split(path.delimiter).some((d) => ["", ".cmd", ".exe"].some((ext) => d && fs.existsSync(path.join(d, bin + ext))));
const up = (names) => { for (let d = process.cwd(); ; d = path.dirname(d)) { if (names.some((n) => fs.existsSync(path.join(d, n)))) return true; if (path.dirname(d) === d) return false; } };

const lines = [];
if (up(["tsconfig.json", "package.json"]) && !onPath("typescript-language-server"))
  lines.push("TypeScript: install the language server for code intelligence: `npm i -g typescript typescript-language-server`.");
if (up(["Cargo.toml"]) && !onPath("rust-analyzer"))
  lines.push("Rust: install the language server for code intelligence: `rustup component add rust-analyzer`.");
if (lines.length) console.log("agents-kit LSP: " + lines.join(" ") + " (Until then the LSP tools report the server as missing; nothing else is affected.)");
process.exit(0);
