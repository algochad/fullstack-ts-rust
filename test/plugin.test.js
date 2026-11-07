// node --test test/   (no network, no installed tools: graphify is a stub that prints a fixture)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-test-"));
const repo = path.join(tmp, "repo");
const stub = path.join(tmp, "graphify-stub.js");

const git = (...a) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: repo, encoding: "utf8" });
fs.mkdirSync(path.join(repo, "src"), { recursive: true });
fs.mkdirSync(path.join(repo, "graphify-out"));
fs.mkdirSync(path.join(repo, ".trail", "learnings"), { recursive: true });
fs.writeFileSync(path.join(repo, "graphify-out", "graph.json"), JSON.stringify({
  nodes: [
    { id: "auth", label: "auth.ts", source_file: "src/auth.ts" },
    { id: "login", label: "login()", source_file: "src/auth.ts" },
    { id: "session", label: "session.ts", source_file: "src/session.ts" },
    { id: "pay", label: "pay.ts", source_file: "src/billing/pay.ts" },
    { id: "ref_zod", label: "zod" },
  ],
  links: [
    { source: "session", target: "login", relation: "calls" },
    { source: "auth", target: "pay", relation: "imports_from" },
    { source: "auth", target: "ref_zod", relation: "imports_from" },
  ],
}));
fs.writeFileSync(path.join(repo, "src", "auth.ts"), "export const login = 1\n");
fs.writeFileSync(path.join(repo, ".trail", "learnings", "a.md"), '---\ntitle: login must not cache\nauthor: sam\ndate: 2026-11-07\nstatus: active\ntouches:\n  - "src/auth.ts#login"\n---\nbody\n');
fs.writeFileSync(path.join(repo, ".trail", "learnings", "b.md"), "---\ntitle: old thing\nstatus: superseded\ntouches:\n  - src/auth.ts\n---\n");
fs.writeFileSync(path.join(repo, ".trail", "learnings", "c.md"), "---\ntitle: other dir\nstatus: active\ntouches:\n  - src/billing\n---\n");
fs.writeFileSync(stub, `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0] === "status") console.log(JSON.stringify({ nodes: 3, stale: true, stale_file_count: 1 }));
else console.log(JSON.stringify({ seeds: ["x"], unresolved_seeds: [], nodes: [{ id: "x", label: "login()", source_file: "src/auth.ts", line_start: 1 }, { id: "y", label: "session.ts", source_file: "src/session.ts" }] }));
`);
fs.chmodSync(stub, 0o755);
git("init", "-q");
git("add", "src");
git("commit", "-qm", "i");

const env = { ...process.env, AGENTS_KIT_GRAPHIFY_BIN: stub, AGENTS_KIT_TRAIL_BIN: path.join(tmp, "missing-trail.js") };
const ctx = (...a) => spawnSync(process.execPath, [path.join(root, "scripts", "ctx.js"), ...a], { cwd: repo, env, encoding: "utf8" });

test("ctx where joins graph nodes with active learnings by file, symbol suffix ignored", () => {
  const r = ctx("where", "login");
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /src\/auth\.ts: login\(\):1\*/);
  assert.match(r.stdout, /login must not cache \(sam, 2026-11-07\)/);
  assert.doesNotMatch(r.stdout, /old thing/);
  assert.doesNotMatch(r.stdout, /other dir/);
});

test("ctx where --json carries the learnings", () => {
  const j = JSON.parse(ctx("where", "login", "--json").stdout);
  assert.deepStrictEqual(j.learnings.map((l) => l.title), ["login must not cache"]);
});

test("ctx impact reads one hop of edges: used by, uses, and learnings on all of them", () => {
  const j = JSON.parse(ctx("impact", "src/auth.ts", "--json").stdout);
  assert.deepStrictEqual(j.used_by, ["src/session.ts"]);
  assert.deepStrictEqual(j.uses, ["src/billing/pay.ts"], "externals without a source file are skipped");
  assert.deepStrictEqual(j.learnings.map((l) => l.title).sort(), ["login must not cache", "other dir"], "a directory touch matches files under it");
});

test("ctx impact accepts a symbol label and says when the target is not in the graph", () => {
  assert.deepStrictEqual(JSON.parse(ctx("impact", "login", "--json").stdout).used_by, ["src/session.ts"]);
  assert.match(ctx("impact", "src/new.ts").stdout, /not in the graph/);
});

test("ctx without a graph says how to get one", () => {
  fs.renameSync(path.join(repo, "graphify-out"), path.join(repo, "go"));
  const r = ctx("where", "login");
  fs.renameSync(path.join(repo, "go"), path.join(repo, "graphify-out"));
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /ctx init/);
});

test("brief reports stale graph and learning count; silent outside a repo", () => {
  const withTrail = spawnSync(process.execPath, [path.join(root, "scripts", "ctx.js"), "brief"], { cwd: repo, env: { ...env, AGENTS_KIT_TRAIL_BIN: stub }, encoding: "utf8" });
  assert.match(withTrail.stdout, /STALE.*; 2 team learnings/);
  assert.strictEqual(ctx("brief").stdout, "", "silent until both tools are installed");
  const out = spawnSync(process.execPath, [path.join(root, "scripts", "ctx.js"), "brief"], { cwd: os.tmpdir(), env, encoding: "utf8" });
  assert.strictEqual(out.stdout, "");
});

test("dispatch never fails or prints when trail is not installed", () => {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "dispatch.js"), "prompt"], { env, input: "{}", encoding: "utf8" });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, "");
});

test("dispatch does no work in a repo that has not run ctx init, and hints once at session start", () => {
  const fakeTrail = path.join(tmp, "fake-trail.js");
  fs.writeFileSync(fakeTrail, 'console.log("RAN " + process.argv.slice(2).join(" "))');
  const e = { ...env, AGENTS_KIT_TRAIL_BIN: fakeTrail };
  const run = (event) => spawnSync(process.execPath, [path.join(root, "scripts", "dispatch.js"), event], { env: e, input: JSON.stringify({ cwd: repo }), encoding: "utf8" });
  assert.strictEqual(run("prompt").stdout, "");
  assert.match(run("session-start").stdout, /not set up/);
  fs.writeFileSync(path.join(repo, ".trail", "plugin-managed.json"), "{}");
  assert.match(run("prompt").stdout, /RAN hook prompt/);
  fs.rmSync(path.join(repo, ".trail", "plugin-managed.json"));
});

test("data dir is derived from the cache path when CLAUDE_PLUGIN_DATA is missing (Bash tool case)", () => {
  const at = path.join(tmp, "plugins", "cache", "mk", "nm", "1.0.0");
  fs.mkdirSync(path.join(at, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(root, "scripts", "lib.js"), path.join(at, "scripts", "lib.js"));
  const { CLAUDE_PLUGIN_DATA, ...clean } = process.env;
  const r = spawnSync(process.execPath, ["-e", `console.log(require(${JSON.stringify(path.join(at, "scripts", "lib.js"))}).data)`], { env: clean, encoding: "utf8" });
  assert.strictEqual(r.stdout.trim(), path.join(tmp, "plugins", "data", "nm-mk"));
});

test("every hook script exists and tools.json pins full commits", () => {
  const h = JSON.parse(fs.readFileSync(path.join(root, "hooks", "hooks.json"), "utf8")).hooks;
  for (const g of Object.values(h).flat()) for (const x of g.hooks) {
    const script = x.args[0].replace("${CLAUDE_PLUGIN_ROOT}", root);
    assert.ok(fs.existsSync(script), script);
  }
  const t = require("../tools.json");
  for (const k of Object.keys(t)) assert.match(t[k].commit, /^[0-9a-f]{40}$/, k);
});
