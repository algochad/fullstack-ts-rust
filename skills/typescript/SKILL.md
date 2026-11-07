---
name: typescript
description: Write, review and debug TypeScript in application code, whether web, Node backend, React, NestJS or a Tauri frontend. Covers detecting the setup first (TypeScript 5.9, 6 or 7, tsconfig, module format, runtime, bundler, linter, test runner), strictness flags, type design, validating data at trust boundaries, errors, async and cancellation, ESM and package exports, project references, type-check speed and JavaScript migration. Use whenever a repo has a tsconfig.json or .ts files, when an any, a cast or a ts-ignore needs a decision, when tsconfig or the TypeScript version changes, or when reviewing TypeScript. Security checks live in the security-audit skill.
---

# TypeScript

Working practice for TypeScript in application code. Follow the project's own conventions first; this skill fills the gaps. Written for this plugin from the official TypeScript docs and release notes and the most-starred community TypeScript skills (each reference names its sources). Detail lives in `references/`:

- [patterns.md](references/patterns.md): type design, runtime validation, results, async, modules and tsconfig recipes, with code
- [versions.md](references/versions.md): TypeScript 5.9, 6 and 7, with dates and what breaks
- [troubleshooting.md](references/troubleshooting.md): the errors you will actually hit
- [review-checklist.md](references/review-checklist.md): a checklist for reviewing TypeScript changes

This skill is the language and the toolchain. React specifics (props, hooks, JSX) are in `agents-kit:react`, Nest specifics in `agents-kit:nestjs`, security in `agents-kit:security-audit`, tests in `agents-kit:test-driven-development`, failures in `agents-kit:systematic-debugging`.

## 1. Detect before you write

Read the repo before suggesting anything:
- **TypeScript version:** `node_modules/typescript/package.json` or `npx --no-install tsc --version`, then the lockfile. 5.9, 6 and 7 differ in defaults and tooling (section 2). Never change the major version as a side effect of another task.
- **tsconfig files:** the root config, `extends`, `references`, and the config that covers the file you are editing (`tsc -p <config> --showConfig`). Repos often keep separate app, build and test configs.
- **Module format and runtime:** `"type"` in `package.json`, `module` and `moduleResolution`, the extension on relative imports, and how the code runs: `tsc` output, `tsx`, Node's own type stripping, Bun, Deno, or a bundler (Vite, esbuild, webpack, Next, the Nest CLI).
- **Tools:** linter and formatter (typescript-eslint, Biome, oxlint, Prettier) and whether type-aware rules are on; test runner (Vitest, Jest, `node:test`); validation library (Zod, Valibot, ArkType); monorepo layout (workspaces, Turborepo, Nx, project references, a shared base tsconfig).
- **The project's own scripts** (`typecheck`, `lint`, `build`, `test`) are the commands to run. Without a typecheck script, `tsc --noEmit -p <config>`.
- The nearest similar file is the pattern: match its naming, import style (`import type`, extensions, aliases), error style and test style. In a repo set up with `ctx`, `ctx where <thing>` finds it.
- If a choice changes the design and the repo gives no signal (which validation library, which strictness flag), report the question instead of guessing; subagents cannot ask the user.

## 2. Which TypeScript

Dates and sources are in [versions.md](references/versions.md) (latest `typescript` on npm was 7.0.2, checked 2026-11-07).

| | 5.9 | 6.0 | 7.x |
|---|---|---|---|
| Compiler | JavaScript | JavaScript, the last JS-based release | native (Go), still the `tsc` command |
| Empty `tsconfig.json` | not strict, loads every `@types/*` | strict, `module: esnext`, `target: es2025`, `types: []`, `rootDir` is the config folder | same as 6.0 |
| `baseUrl`, `moduleResolution: node`, `target: es5`... | fine | error unless `"ignoreDeprecations": "6.0"` | removed, no escape hatch |
| `require("typescript")` API and `tsserver` | yes | yes | no API in 7.0 (new one in the 7.1 beta), no `tsserver` |
| typescript-eslint 8.72 | works | works | not supported (peer range `<6.1.0`) |

- **Match the project.** Write `strict`, `types`, `rootDir`, `module` and `target` explicitly so one tsconfig means the same on 5.9, 6 and 7.
- **Upgrade in two steps:** 5.9 to 6.0 first (fix the deprecations; `ignoreDeprecations` is a short bridge), then 7. Microsoft states code that compiles cleanly on 6.0 (without `ignoreDeprecations`) should compile identically on 7.0.
- **Tools that import the compiler API cannot run on 7.0:** typescript-eslint (its maintainers confirm), Vue, Svelte, Astro, MDX and Angular editor tooling (named in the 7.0 announcement), and by the same logic ts-node and ts-jest. Keep a 6.x copy for them beside 7 through the `@typescript/typescript6` npm alias (versions.md has the lines), and use 7 for `tsc`.
- **The editor is not the compiler.** This plugin's language server is pinned to TypeScript 5.9.3 because 7 ships no `tsserver`. In a 6 or 7 project, editor squiggles and `tsc` can disagree; `tsc` is the truth.

## 3. tsconfig: what each flag buys

Turn strictness on in new code and ratchet it in old code, one flag per change. Never loosen a flag to make an error go away.

| Option | What it buys | Cost or note |
|---|---|---|
| `strict` | null checks, no implicit `any`, `unknown` in `catch`, strict function types | always on; 6+ defaults it, write it anyway |
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` include `undefined`: the commonest hidden crash | needs guards; on for new code |
| `exactOptionalPropertyTypes` | `a?: string` means absent, not "maybe `undefined`" | fights some library types (`fetch(url, { signal })` with an optional `signal` is `TS2769`); on when you model optionals carefully |
| `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns` | renamed base methods, forgotten `break` or `return` | cheap, on |
| `verbatimModuleSyntax` | imports and exports are kept or erased exactly as written; type imports must say `type` | right for bundlers, Node type stripping and ESM output; cannot emit CJS and ESM from one source |
| `isolatedModules` | every file transpiles alone, as esbuild, swc, Babel and Node do | on whenever something other than `tsc` emits |
| `erasableSyntaxOnly` | rejects syntax that needs a transform: `enum`, runtime `namespace`, parameter properties | on when Node, Deno or another strip-only runner executes the `.ts` |
| `skipLibCheck` | skips checking every `.d.ts`: faster, and hides conflicts between dependency typings | fine for apps; a library should still check its own emitted `.d.ts` (`attw`, `publint`); never use it to hide your own error |
| `noEmit` | `tsc` only checks | when a bundler, `tsx` or Node runs the code |
| `isolatedDeclarations` | exports need explicit types, so `.d.ts` can be emitted without type-checking | large libraries and monorepos; optional |

**Module settings follow how the code runs** (the official "Choosing compiler options" guide):
- `tsc` emits for Node: `"module": "nodenext"` (it implies `moduleResolution: nodenext` and `esModuleInterop`). Relative imports name the emitted file (`./util.js`), or write `.ts` and set `rewriteRelativeImportExtensions`. Under `verbatimModuleSyntax` the package needs `"type": "module"`, or `.ts` files are treated as CommonJS and ESM syntax is rejected.
- A bundler builds it (Vite, esbuild, webpack, Next, a Tauri frontend): `"module": "esnext"` (or `preserve`), `"moduleResolution": "bundler"`, `"noEmit": true`.
- A library: `nodenext`, or `node18` to pin Node's rules; `declaration: true`; `target` is the lowest runtime you support.
- Not `moduleResolution: node` or `baseUrl` (deprecated in 6, removed in 7). Aliases are `paths` with explicit prefixes (the bundler needs the same alias, since `paths` only affects type-checking) or package.json `imports` (`#/*`, supported by 6.0 under nodenext and bundler).
- `target` is what the runtime executes; `lib` must match it (no `dom` in a Node-only package). List `types` explicitly (`"types": ["node"]`), because 6+ no longer loads every `@types/*`.
- Decorator projects (`emitDecoratorMetadata`, as in many Nest and TypeORM apps): a class used as a constructor parameter type needs a real import, an interface needs `import type` (TS1272 otherwise). See troubleshooting.md.

## 4. Type design (rules)

- **Make invalid states unrepresentable:** model variants as a discriminated union (`{ status: "ready"; data: T } | { status: "failed"; error: Error }`), not a bag of optional fields. End every `switch` over a union with an exhaustiveness check so a new variant breaks the build ([patterns.md](references/patterns.md)).
- **`unknown`, not `any`.** `any` switches checking off for everything it touches. Use `unknown` for values you have not validated and narrow them (`typeof`, `in`, `instanceof`, a type predicate, a schema parse). Unavoidable `any` (broken third-party types) goes in one small wrapper with a precise return type and a comment.
- **A cast is not a check.** `as T` neither converts nor validates. Allow it only right next to the proof (after a schema parse, after a null check you cannot express otherwise). `as unknown as T` and `!` need a reason in a comment. Before a cast try `satisfies`, `as const`, a return type, a narrower variable or a generic constraint.
- **Suppress with `// @ts-expect-error <reason>`,** which fails when the error disappears, never `// @ts-ignore`, which stays silent forever. No `@ts-nocheck` in new code.
- **`satisfies`** checks a literal against a type and keeps its narrow inferred type (config and route tables). **`as const`** keeps literals and derives unions from arrays and objects. Use `readonly` for data you do not mutate.
- **Branded types** keep ids and units apart (`UserId` vs `OrderId`, cents vs dollars). Create them in one parse function, not with scattered casts.
- **Generics:** add a type parameter only when it relates two positions (input to output, key to object). Constrain only what the body uses, let callers infer, and drop parameters that appear once.
- **Mapped, conditional and template-literal types sparingly.** Plain interfaces and the built-ins (`Pick`, `Omit`, `Partial`, `Record`, `ReturnType`, `Awaited`) cover application code. A clever type costs compile time and readers; test non-trivial type utilities with type tests.
- **Narrowing:** discriminant checks first; type predicates (`x is T`) must be exactly true, because the compiler trusts them. Prefer a schema for external data.
- **Enums:** prefer string-literal unions or an `as const` object. `enum` emits runtime code, is not erasable, and `const enum` breaks per-file transpilers. If generated code or a protocol forces an enum, use a string enum.
- **Optional vs undefined:** `a?: T` may be absent; `a: T | undefined` is present but empty. `null` only where the data source uses it.
- **Overloads vs unions:** a union or generic when every case runs the same code; overloads for genuinely different call shapes, most specific first.
- **Signatures:** explicit return types on exported functions and public methods; infer locals and callbacks. `string`, not `String`; `object` or `Record<string, unknown>`, not `Object` or `{}`; a call signature, not `Function`.
- **`interface` or `type`:** follow the project. Default to `type` for unions and compositions and `interface` for object contracts that classes implement or consumers extend (only interfaces merge and can be augmented).

## 5. Trust boundaries: types are not a check

A type on external data is a claim. Where data enters (HTTP body, query, params and headers, `JSON.parse`, `res.json()`, `process.env`, files, `localStorage`, `postMessage`, queue payloads, loosely typed DB rows, third-party APIs, Tauri `invoke` results), parse it with a runtime schema and derive the type from the schema, so there is one source of truth.
- Use the library the project already has. Zod, Valibot and ArkType all implement Standard Schema, so shared code can accept any of them through `@standard-schema/spec` without a hard dependency ([patterns.md](references/patterns.md)). Don't add a second library for one schema.
- Parse once, at the edge, and return the parsed value (after transforms), not the input. Inside the boundary trust the types and do not re-validate.
- Environment: parse `process.env` once at startup into a typed config and fail fast; no `process.env.X` in feature code.
- `JSON.parse`, `res.json()` and `invoke<T>()` hand you `any` or an unchecked generic. Assign to `unknown` and parse.
- Share the schema, or types derived from it, between client and server instead of hand-copying interfaces, or generate them from the API contract.
- Validation is not authorization, escaping or sanitization; for those use `agents-kit:security-audit` (its Tauri and NestJS checklists cover IPC and request pipelines).

## 6. Errors and results

- Throw `Error` subclasses, never strings or plain objects, and keep the original with `new Error(message, { cause })`. Under `strict` the `catch` variable is `unknown`: narrow with `instanceof Error`, or use one `errorMessage(e: unknown)` helper, not `e as Error`.
- **Expected failures** (parse, lookup, validation, a domain rule) can return a result union (`{ ok: true; value } | { ok: false; error }`) so callers must handle them; exceptions are for the unexpected. Follow the project's style (exceptions plus a filter in Nest, a Result library elsewhere) and don't mix styles in one module.
- Give domain errors a stable `code`, not just text, and map them to HTTP or UI at the edge.
- Never an empty `catch`, never `return null` for a failure the caller must know about, and handle `JSON.parse`, `new URL` and `Number()` on user input.

## 7. Async and cancellation

- Every promise is awaited, returned or handled. Turn on `@typescript-eslint/no-floating-promises` and `no-misused-promises` (type-aware) or the equivalent; intentional fire-and-forget is `void p.catch(log)`.
- `array.forEach(async ...)` does not wait. Use `for...of` (sequential) or `Promise.all(items.map(...))` (parallel).
- **Independent work runs in parallel, but unbounded.** Over thousands of items cap the concurrency (a small worker pool or the project's `p-limit`). `Promise.all` rejects on the first failure and does not cancel the rest; use `Promise.allSettled` when you need every outcome and `Promise.any` for the first success.
- **Cancel with `AbortSignal`:** accept a `signal` parameter, pass it to `fetch` and friends, bound waits with `AbortSignal.timeout(ms)`, combine with `AbortSignal.any([...])`, and call `signal.throwIfAborted()` in long loops. Treat `AbortError` as a normal outcome in callers. In React effects abort in the cleanup (see `agents-kit:react`).
- A function that never awaits should not be `async` (it changes synchronous throws into rejections). Clear timers and listeners in cleanup. Top-level `await` only in ESM, and not in libraries.

## 8. Modules, packages and declaration files

- One module system per package. Use `import type` for types (required by `verbatimModuleSyntax`). Under nodenext, relative ESM imports carry an extension. In ESM, `import.meta.dirname` replaces `__dirname`.
- **Published or shared packages** declare `exports` with the `types` condition first in each entry, a `.d.cts` beside a `.cjs` for dual packages, and an `attw` and `publint` run before release ([patterns.md](references/patterns.md)). Subpath exports hide internals. Avoid a barrel that re-exports a whole tree: small entry points keep imports honest and cycles visible.
- **Declaration files:** never hand-write `.d.ts` for your own code (set `declaration`). Write one only for an untyped dependency, and type just the surface you use. A `.d.ts` with a top-level `import` or `export` is a module, so its `declare module "x"` becomes an augmentation, not a declaration.
- **Augmentation** (`declare module "express-serve-static-core"`, `declare global`) is for interfaces and globals, lives in one documented file the tsconfig includes, and is the last resort. Prefer a typed accessor or a schema-parsed config.
- Match `@types/node` to the Node major. Import JSON with `with { type: "json" }` and `resolveJsonModule`.

## 9. Project references and monorepos

- Use **project references** (`composite`, `references`, `tsc -b`) when packages build in dependency order and consume each other's emitted `.d.ts`: you get incremental builds and enforced boundaries. When everything bundles from source, one tsconfig and workspace resolution is simpler.
- The root solution file has `"files": []`, so `tsc --noEmit` there checks nothing. Run the repo's typecheck script, usually `tsc -b`.
- Put strictness in one `tsconfig.base.json` that packages extend, and keep tests in their own tsconfig so test globals do not leak into `src`. Use workspace package names, never `../../other-package/src`, which breaks `rootDir`.
- One TypeScript version across the workspace (root dependency or catalog); mixed versions give different answers per package.

## 10. Tooling

- **Typecheck is `tsc --noEmit`** (or the project script, or `tsc -b`). Bundlers, `tsx`, esbuild, swc and Node's type stripping do not check types, so CI must run it. Never replace it with a test or a build.
- **Lint:** typescript-eslint gives type-aware rules (`no-floating-promises`, `no-unsafe-*`, `switch-exhaustiveness-check`, `consistent-type-imports`, `ban-ts-comment`) but needs TypeScript 6.0.x or older. Biome and oxlint are fast single binaries; check which type-aware rules they cover before dropping typescript-eslint. None replaces `tsc`.
- **Run TS:** `tsx` for scripts and dev servers (esbuild, no type check). Node strips types itself on recent versions (on by default on Node 26.8.2; checked): erasable syntax only, so set `erasableSyntaxOnly` and `verbatimModuleSyntax` and `tsc` flags what the runtime cannot run. Bun and Deno run TS natively without checking. ts-node is legacy and needs the compiler API.
- **Test:** the project's runner. Type-level code gets type tests (`expectTypeOf` in Vitest, `*.test-d.ts`, or `tsd`).
- No global installs; use the project-local binaries (`npx --no-install tsc`).

## 11. Type-check performance

- Measure first: `tsc --extendedDiagnostics` (check time, instantiations, memory), `tsc --generateTrace dir` with `@typescript/analyze-trace` for the slow files and types, `--explainFiles` for why a file is included, `--traceResolution` for module lookups.
- Usual fixes: precise `include` and `exclude` (don't check `dist` or tests twice); `incremental` or project references; explicit return types on exported functions; interfaces that `extend` instead of big intersections; split huge unions; bound recursive conditional types ("Type instantiation is excessively deep"); import types narrowly instead of through a giant barrel; isolate heavy schema types behind one module with an explicit exported type.
- The biggest single lever is TypeScript 7, where Microsoft reports typically 8x to 12x faster full builds (vscode: 125.7 s to 10.6 s). It is a tooling decision (section 2), not a drive-by change.

## 12. Migrating JavaScript

- Add a tsconfig with `allowJs`, `noEmit` and `checkJs: false` and put `typecheck` in CI first. Convert leaf modules before their importers, one directory per change, and don't refactor while renaming.
- Type the boundaries first (schemas for I/O), then the internals. Use `// @ts-check` plus JSDoc for files you cannot rename yet.
- Turn `strict` on with the unfinished flags opted out (`"strictNullChecks": false`) and remove one opt-out per change. Track the `any` and suppression count and don't let it rise. No mass `any`.
- Under TypeScript 7 JSDoc checking is stricter (values cannot be used as types, `@enum` and `@class` are gone), so JSDoc-heavy JS needs a look first (versions.md).

## 13. Before you say it is done

The project's typecheck on the config that covers the changed files, the linter, and the tests that touch the change; a type test for any new type utility; `attw` and `publint` for a package whose `exports` changed. Run `ctx impact` on exported types and modules: importers are where a changed signature breaks. Never weaken tsconfig or lint rules, or add `any` or `@ts-ignore`, to get green; if the baseline already fails, say so. Then the `verification-before-completion` skill. For a review, use [references/review-checklist.md](references/review-checklist.md) with `/agents-kit:code-review`.
