#!/usr/bin/env node
// ctx: one question, both memories. Graphify says where the code is and what touches it; Trail says what the team learned there.
// The seam is the file path: a Graphify node's source_file against a Trail learning's `touches:`.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const lib = require("./lib");

const sh = (cmd, args, opts) => spawnSync(cmd, args, { encoding: "utf8", env: lib.toolEnv(), ...opts });
const repoRoot = () => {
  const r = sh("git", ["rev-parse", "--show-toplevel"]);
  return r.status === 0 ? r.stdout.trim() : null;
};
const graphPath = (root) => path.join(root, "graphify-out", "graph.json");
const graphify = (args) => sh(lib.graphifyBin(), args);

function graphQuery(root, text, depth) {
  if (!lib.ready(lib.graphifyBin()) || !fs.existsSync(graphPath(root))) return null;
  const r = graphify(["query", text, "--json", "--depth", String(depth), "--graph", graphPath(root)]);
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// Front matter of .trail/learnings/*.md: only title, status and touches matter here.
function learnings(root) {
  const dir = path.join(root, ".trail", "learnings");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const m = fs.readFileSync(path.join(dir, f), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const fm = m[1], one = (k) => (fm.match(new RegExp("^" + k + ":\\s*(.*)$", "m")) || [])[1]?.replace(/^["']|["']$/g, "").trim();
    const block = fm.match(/^touches:\s*\r?\n((?:\s+-.*\r?\n?)*)/m);
    const touches = block ? block[1].split(/\r?\n/).map((l) => l.replace(/^\s*-\s*/, "").replace(/^["']|["']$/g, "").trim()).filter(Boolean) : [];
    if ((one("status") || "active") !== "active") continue;
    out.push({ file: path.join(".trail", "learnings", f), title: one("title") || f, author: one("author"), date: one("date"), touches: touches.map((t) => t.replace(/#.*$/, "").replace(/^\.\//, "")) });
  }
  return out;
}
const touching = (all, files) => all.filter((l) => l.touches.some((t) => files.some((f) => f === t || f.startsWith(t.replace(/\/$/, "") + "/"))));

function group(nodes) {
  const by = new Map();
  for (const n of nodes) {
    if (!n.source_file) continue;
    if (!by.has(n.source_file)) by.set(n.source_file, []);
    by.get(n.source_file).push(n);
  }
  return by;
}
function printLearnings(ls) {
  if (!ls.length) return console.log("learnings: none for these files");
  console.log("learnings:");
  for (const l of ls) console.log(`  ${l.title} (${[l.author, l.date].filter(Boolean).join(", ")}) -> ${l.file}`);
}
function needGraph(root) {
  console.error(lib.ready(lib.graphifyBin()) ? "no code graph here yet: run `ctx init`" : "graphify is not installed yet (see " + lib.data + "/install.log)");
  process.exit(2);
}

function where(root, args) {
  const json = args.includes("--json"), depth = args.includes("--depth") ? args[args.indexOf("--depth") + 1] : 2;
  const q = args.filter((a, i) => a !== "--json" && a !== "--depth" && args[i - 1] !== "--depth").join(" ");
  if (!q) { console.error("usage: ctx where <symbol, file or phrase> [--depth N] [--json]"); process.exit(2); }
  const g = graphQuery(root, q, depth);
  if (!g) needGraph(root);
  const files = [...group(g.nodes).keys()], ls = touching(learnings(root), files);
  if (json) return console.log(JSON.stringify({ query: q, seeds: g.seeds, unresolved: g.unresolved_seeds, nodes: g.nodes, learnings: ls }, null, 2));
  if (!g.nodes.length) console.log(`no graph match for "${q}"` + (g.unresolved_seeds?.length ? " (unresolved: " + g.unresolved_seeds.join(", ") + ")" : ""));
  for (const [f, ns] of group(g.nodes)) console.log(`${f}: ` + ns.map((n) => n.label + (n.line_start ? `:${n.line_start}` : "") + (g.seeds.includes(n.id) ? "*" : "")).join(", "));
  printLearnings(ls);
}

function changedFiles(root) {
  const r = sh("git", ["status", "--porcelain", "--no-renames", "-uall"], { cwd: root });
  return r.stdout.split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, "")).filter((f) => !/^(graphify-out|\.trail)\//.test(f));
}
function impact(root, args) {
  const json = args.includes("--json"), targets = args.filter((a) => a !== "--json");
  const own = targets.length ? targets : changedFiles(root);
  if (!own.length) return console.log("nothing changed and no target given");
  if (!lib.ready(lib.graphifyBin()) || !fs.existsSync(graphPath(root))) needGraph(root);
  const near = new Map();
  for (const t of own) {
    const g = graphQuery(root, path.basename(t), 2);
    for (const n of g?.nodes || []) if (n.source_file && !own.includes(n.source_file)) near.set(n.source_file, n);
  }
  const ls = touching(learnings(root), [...own, ...near.keys()]);
  if (json) return console.log(JSON.stringify({ target: own, neighbors: [...near.keys()], learnings: ls }, null, 2));
  console.log("target: " + own.join(", "));
  console.log(near.size ? "neighbors in the graph (2 hops, either direction): " + [...near.keys()].join(", ") : "neighbors in the graph: none");
  printLearnings(ls);
}

function status(root, short) {
  const ready = { trail: lib.ready(lib.trailEntry()), graphify: lib.ready(lib.graphifyBin()) };
  const gr = ready.graphify && fs.existsSync(graphPath(root)) ? (() => { try { return JSON.parse(graphify(["status", "--json", "--graph", graphPath(root)]).stdout); } catch { return null; } })() : null;
  const ls = learnings(root), hasTrail = fs.existsSync(path.join(root, ".trail"));
  if (short) {
    if (!ready.trail || !ready.graphify) return;
    if (!gr && !hasTrail) return console.log("ctx: this repo has no code graph or learnings yet; `ctx init` builds both locally (no model calls).");
    return console.log(`ctx: ${gr ? (gr.stale ? `code graph STALE (${gr.stale_file_count} files changed; run \`graphify update .\`)` : `code graph fresh, ${gr.nodes} nodes`) : "no code graph (`ctx init`)"}; ${ls.length} team learnings. Ask with \`ctx where <x>\`, check changes with \`ctx impact\`.`);
  }
  console.log(JSON.stringify({ tools: ready, graph: gr, learnings: ls.length }, null, 2));
}

function init(root) {
  if (!lib.ready(lib.graphifyBin()) || !lib.ready(lib.trailEntry())) { console.error("tools not installed yet (see " + lib.data + "/install.log)"); process.exit(2); }
  const a = spawnSync(lib.graphifyBin(), ["update", root], { stdio: "inherit", env: lib.toolEnv() });
  const { cmd, args } = lib.trailCmd(["init", "--plugin", "--no-agents", "--no-mcp", "--yes", root]);
  const b = spawnSync(cmd, args, { stdio: "inherit", env: lib.toolEnv({ TRAIL_INVOKED_AS: "trail" }) });
  console.log("\nctx: graph in graphify-out/ (add it to .gitignore unless the team shares it), learnings in .trail/learnings/ (commit these).");
  process.exit(a.status || b.status || 0);
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const root = repoRoot() || (cmd === "brief" || cmd === "status" ? null : process.cwd());
  if (!root) return; // brief outside a repo: say nothing
  switch (cmd) {
    case "where": return where(root, args);
    case "impact": return impact(root, args);
    case "status": return status(root, false);
    case "brief": return status(root, true);
    case "init": return init(root);
    case "learn": { const { cmd: c, args: a } = lib.trailCmd(["note", ...args]); process.exit(spawnSync(c, a, { stdio: "inherit", env: lib.toolEnv({ TRAIL_INVOKED_AS: "trail" }) }).status ?? 1); }
    default:
      console.error("ctx where <x> | impact [file...] | learn --title T -m BODY --touches F | status | init");
      process.exit(cmd ? 2 : 0);
  }
}
main();
