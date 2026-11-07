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

test("gate: denies a code search until ctx is tried, then opens; subagents are separate; stop asks for impact once", () => {
  const stubTrail = path.join(tmp, "stub-trail.js");
  fs.writeFileSync(stubTrail, "");
  const e = { ...env, AGENTS_KIT_TRAIL_BIN: stubTrail, CLAUDE_PLUGIN_DATA: path.join(tmp, "data") };
  fs.writeFileSync(path.join(repo, ".trail", "plugin-managed.json"), "{}");
  const hook = (event, p) => { const r = spawnSync(process.execPath, [path.join(root, "scripts", "gate.js"), event], { env: e, input: JSON.stringify({ cwd: repo, session_id: "s1", ...p }), encoding: "utf8" }); return r.stdout ? JSON.parse(r.stdout) : null; };
  const bash = (command, extra) => hook("gate", { tool_name: "Bash", tool_input: { command }, ...extra });
  const denied = (o) => o?.hookSpecificOutput?.permissionDecision === "deny";
  assert.ok(denied(bash("ls forge")), "ls is a code search");
  assert.ok(denied(hook("gate", { tool_name: "Grep", tool_input: { pattern: "x" } })));
  assert.strictEqual(bash("cat src/auth.ts"), null, "reading a named file is fine");
  assert.strictEqual(bash("trail ask login", { session_id: "s2" }), null);
  assert.ok(denied(bash("ls forge", { session_id: "s2" })), "trail ask alone does not open the gate");
  assert.strictEqual(bash("cd src && ctx where login"), null);
  assert.strictEqual(bash("grep -rn login src"), null, "open after one ctx call");
  assert.ok(denied(bash("grep -rn login src", { agent_id: "sub1" })), "a subagent has its own gate");
  assert.ok(denied(bash("find . -name x", { agent_id: "sub1" })));
  assert.strictEqual(bash("find . -name x", { agent_id: "sub1" }), null, "never more than two denials");
  assert.strictEqual(hook("stop-gate", {}), null, "no edits, no stop request");
  hook("mark-edit", { tool_name: "Edit" });
  assert.strictEqual(hook("stop-gate", {}).decision, "block");
  assert.strictEqual(hook("stop-gate", {}), null, "asked once");
  assert.match(hook("rule", { hook_event_name: "SubagentStart" }).hookSpecificOutput.additionalContext, /ctx where/);
  fs.rmSync(path.join(repo, ".trail", "plugin-managed.json"));
  assert.strictEqual(bash("ls forge", { session_id: "s9" }), null, "inactive without ctx init");
});

test("cohesion: no part of the kit gives instructions that conflict with another", () => {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.md$/.test(e.name) && files.push(path.join(d, e.name))));
  ["agents", "overrides", "commands", "skills"].forEach((d) => walk(path.join(root, d)));
  const text = (f) => fs.readFileSync(f, "utf8");
  // Things that would fight the plugin: installing upstream packages, wiring hooks, scripted reply endings, another confidence scale.
  const banned = [/(^|[^-\w])superpowers:[a-z]/, /\/agents-kit:review(?![-\w])/, /agents-kit:(debugging|verification|planning)(?![-\w])/, /start-server\.sh[^\n]*--open/, /npm install -g/, /pip install graphifyy/, /graphify (hook|claude) install/, /trail init(?! --plugin)/, /word for word/, /close your reply with/i, /1 to 10/, /graft upgrade/];
  for (const f of files) for (const re of banned) assert.doesNotMatch(text(f), re, `${path.relative(root, f)} matches ${re}`);
  // Every skill an agent preloads or names as agents-kit:<x> exists, and has a matching folder with SKILL.md.
  const skills = fs.readdirSync(path.join(root, "skills"));
  for (const f of files) {
    for (const m of text(f).matchAll(/agents-kit:([a-z-]+)/g)) assert.ok(skills.includes(m[1]) || fs.existsSync(path.join(root, "commands", m[1] + ".md")) || fs.existsSync(path.join(root, "agents", m[1] + ".md")), `${path.relative(root, f)} names agents-kit:${m[1]}`);
    const fm = text(f).match(/^skills:\n((?:  - .*\n)+)/m);
    if (fm) for (const n of fm[1].matchAll(/  - (\S+)/g)) assert.ok(skills.includes(n[1]), `${path.relative(root, f)} preloads missing skill ${n[1]}`);
  }
  for (const k of skills) assert.ok(fs.existsSync(path.join(root, "skills", k, "SKILL.md")), k);
});

test("every plugin dependency is listed in this repo's marketplace, and git sources are pinned to a full sha", () => {
  const dep = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8")).dependencies;
  const mk = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "marketplace.json"), "utf8")).plugins;
  for (const d of dep) assert.ok(mk.some((p) => p.name === d), `${d} missing from marketplace.json`);
  for (const p of mk.filter((p) => p.source.source === "git-subdir")) assert.match(p.source.sha, /^[0-9a-f]{40}$/, p.name);
});

test("every markdown file is well-formed: valid frontmatter, balanced fences, no dead relative links", () => {
  const all = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { if (e.name === "node_modules" || e.name === ".git") return; e.isDirectory() ? walk(path.join(d, e.name)) : /\.md$/.test(e.name) && all.push(path.join(d, e.name)); });
  walk(root);
  for (const f of all) {
    const rel = path.relative(root, f), s = fs.readFileSync(f, "utf8");
    assert.strictEqual((s.match(/^\s*(```|~~~)/gm) || []).length % 2, 0, `${rel}: unbalanced code fences`);
    if (s.startsWith("---")) {
      const m = s.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      assert.ok(m, `${rel}: frontmatter is not closed`);
      // YAML has no parser in node core, so lint the three ways a hand-written value breaks: an unquoted ": " or " #", an unquoted
      // flow start ([ or {) that is not a JSON array, and a leading indicator character.
      let inBlock = false;
      for (const line of m[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
        if (!kv) continue;
        const v = kv[2].trim();
        inBlock = /^[|>][+-]?$/.test(v);
        if (inBlock || v === "" || /^["']/.test(v)) continue;
        assert.doesNotMatch(v, /: |\s#/, `${rel}: ${kv[1]} needs quotes (contains ": " or " #")`);
        assert.doesNotMatch(v, /^[*&!%@`]/, `${rel}: ${kv[1]} starts with a YAML indicator, quote it`);
        if (/^[\[{]/.test(v)) assert.doesNotThrow(() => JSON.parse(v), `${rel}: ${kv[1]} starts with [ or { but is not valid JSON, quote it`);
      }
    }
    const body = s.replace(/```[\s\S]*?```/g, "");
    for (const m of body.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g)) {
      if (/^(https?:|mailto:|\/)/.test(m[1])) continue;
      assert.ok(fs.existsSync(path.join(path.dirname(f), m[1])), `${rel}: dead link ${m[1]}`);
    }
  }
});

test("lsp: finds what works, plans an install for what does not, and does not retry a fresh failure", () => {
  const bin = path.join(tmp, "lspbin");
  fs.mkdirSync(bin, { recursive: true });
  const stub = (n, code = 0) => { fs.writeFileSync(path.join(bin, n), `#!/bin/sh\nexit ${code}\n`); fs.chmodSync(path.join(bin, n), 0o755); };
  stub("npm"); stub("rustup");
  const run = (stamp, extraEnv = {}) => {
    const r = spawnSync(process.execPath, ["-e", `const l=require(${JSON.stringify(path.join(root, "scripts", "lsp.js"))});const s=${JSON.stringify(stamp)};console.log(JSON.stringify({todo:l.missing(s),stamp:s.lsp}))`], { env: { PATH: bin, ...extraEnv }, encoding: "utf8" });
    return JSON.parse(r.stdout);
  };
  assert.deepStrictEqual(run({}).todo, ["ts", "rust"], "both missing and installable");
  stub("rust-analyzer", 1); // the rustup proxy case: present on PATH but fails
  assert.deepStrictEqual(run({}).todo, ["ts", "rust"], "a server that exits non-zero counts as missing");
  stub("rust-analyzer"); stub("typescript-language-server");
  const ok = run({});
  assert.deepStrictEqual(ok.todo, []);
  assert.ok(ok.stamp.ts.ok && ok.stamp.rust.ok, "working servers are recorded so later sessions spawn nothing");
  fs.rmSync(path.join(bin, "typescript-language-server"));
  assert.deepStrictEqual(run({ lsp: { ts: { failed: Date.now() } } }).todo, [], "a failure under a week old is not retried");
  assert.deepStrictEqual(run({}, { AGENTS_KIT_NO_LSP_INSTALL: "1" }).todo, [], "opt-out");
  assert.match(require("../scripts/lsp.js").TS.typescript, /^5\./, "TypeScript 7 returns empty LSP results through this server");
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
