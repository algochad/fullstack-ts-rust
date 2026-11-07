# TypeScript versions: what changed

Rewritten for this plugin from the TypeScript team's announcements and release notes (devblogs.microsoft.com/typescript, typescriptlang.org), npm and GitHub metadata, and local runs of tsc 5.9.3, 6.0.3, 7.0.2 and 7.1.0-beta in scratch directories.

Verified on 2026-11-07. The latest `typescript` on npm was **7.0.2** (published 2026-07-08, dist-tag `latest`); the latest 5.x was 5.9.3 and the latest 6.x was 6.0.3. Lines marked "observed" were reproduced locally, not just read. When the project's version is older than the code you are about to write, or newer than your habits, check here first.

## Releases (npm publish dates)

| Version | Date | Notes |
|---|---|---|
| 5.9.3 | 2025-09-30 | last 5.x; the version this plugin pins next to its language server |
| 6.0.0-beta | 2026-02-11 | beta (blog post the same day) |
| 6.0.1-rc | 2026-03-06 | RC |
| 6.0.2 | 2026-03-23 | the 6.0 release ("Announcing TypeScript 6.0") |
| 6.0.3 | 2026-04-16 | latest 6.x |
| 7.0.1-rc | 2026-06-18 | RC, dist-tag `rc` |
| 7.0.2 | 2026-07-08 | the 7.0 release, dist-tag `latest` |
| 7.1.0-beta | 2026-10-20 | dist-tag `beta`; the post expects an RC about a month later and the final release shortly after |
| 7.1.0-dev.20261106.1 | 2026-11-06 | nightly, dist-tag `next` |

typescriptlang.org has a 6.0 release-notes page (`/docs/handbook/release-notes/typescript-6-0.html`) and no page at the matching 7.0 path (404 on 2026-11-07); the 7.0 announcement post is the reference.

## 5.9 (baseline)

Observed with tsc 5.9.3 and an empty `tsconfig.json`: not strict, every installed `@types/*` is loaded, `rootDir` is inferred from the sources (`src/a.ts` with `outDir: dist` emits `dist/a.js`), and `baseUrl`, `moduleResolution: node10` and `target: es5` are accepted without a warning.

## 6.0 (2026-03-23)

From the announcement and the release notes; the behavior lines are observed with tsc 6.0.3.

- **Purpose:** the bridge between 5.9 and 7.0, "the last release based on the current JavaScript codebase", API-compatible with 5.9. The December 2025 progress post says no 6.1 is planned and patch releases are limited to security issues and high-severity regressions or compatibility fixes.
- **Changed defaults:** `strict` is `true`; `module` is `esnext`; `target` floats to the newest supported ECMAScript version (`es2025` at release); `types` is `[]`; `rootDir` is the folder holding `tsconfig.json`; `noUncheckedSideEffectImports` is `true`; `libReplacement` is `false`. Setting the old value explicitly restores the old behavior (`"types": ["*"]` for the old `@types` loading).
  - Observed: an empty tsconfig now reports `TS2322` and `TS7006` on code 5.9.3 accepts; `process` fails with `TS2591` until `"types": ["node"]`; `src/a.ts` with `outDir: dist` emits `dist/src/a.js`.
- **Deprecated, with `"ignoreDeprecations": "6.0"` as the bridge (7.0 supports none of them):** `target: es5` (lowest is es2015), `downlevelIteration`, `moduleResolution: node` or `node10`, `module: amd | umd | systemjs | none`, `baseUrl` (move the prefix into `paths`), `alwaysStrict: false`. Observed codes: `TS5101` for `baseUrl`, `TS5107` for `moduleResolution=node10` and `target=ES5`.
- **Removed or now errors:** `moduleResolution: classic`, `outFile`, `esModuleInterop: false`, `allowSyntheticDefaultImports: false`, the `module Foo {}` namespace keyword (use `namespace`), `asserts` on imports (use `with`), `/// <reference no-default-lib="true"/>`, and `tsc file.ts` when a `tsconfig.json` exists (`TS5112`; `--ignoreConfig` skips the check).
- **New:** subpath imports starting with `#/` under `nodenext` and `bundler`; `--moduleResolution bundler` with `--module commonjs`; `--stableTypeOrdering` (makes 6.0 order types like 7.0, up to 25% slower, a diagnostic aid); `es2025` for `target` and `lib` (`RegExp.escape`, and `Promise.try`, Iterator and Set methods move out of `esnext`); Temporal types and `Map`/`WeakMap` `getOrInsert` and `getOrInsertComputed` under `esnext`; `dom.iterable` and `dom.asynciterable` folded into `dom`.
- **Type checking:** a method that never uses `this` is no longer context-sensitive (inference stops depending on property order); function expressions in generic calls are checked more strictly, so some calls need explicit type arguments; DOM types updated.
- **Migration helper:** the December 2025 post names `npx @andrewbranch/ts5to6 --fixBaseUrl` and `--fixRootDir` (it only rewrites `baseUrl` and `rootDir`).

## 7.0 (2026-07-08)

From the announcement, plus local observation.

- **What:** the native port (Go) of the compiler and language service. `npm install -D typescript` installs the new `tsc`; Microsoft's headline is "10x faster". The package's `bin` is only `tsc` (no `tsserver`) and `engines.node` is `>=16.20.0` (observed from the 7.0.2 package).
- **Speed (the announcement, full builds, default `--checkers 4`):** vscode 125.7 s to 10.6 s (11.9x), sentry 139.8 s to 15.7 s (8.9x), bluesky 24.3 s to 2.8 s (8.7x), playwright 12.8 s to 1.47 s (8.7x), tldraw 11.2 s to 1.46 s (7.7x); "typically between 8x and 12x". Memory use fell 6 to 26 percent on those projects.
- **Flags:** `--checkers` (default 4; experimental, can give order-dependent results in rare cases), `--builders` (parallel project-reference builds under `--build`), `--singleThreaded`. `--watch` is rebuilt. `--erasableSyntaxOnly`, `--noCheck`, `--generateTrace` and `--extendedDiagnostics` exist (observed in `tsc --help --all`).
- **Defaults:** 6.0's, and `stableTypeOrdering` is always on. Everything 6.0 deprecated is now an error: observed `TS5102` (`baseUrl`) and `TS5108` (`moduleResolution=node10`, `target=ES5`) "has been removed", and `ignoreDeprecations` does not help.
- **Compatibility claim:** "Practically any TypeScript code that compiles cleanly with TypeScript 6.0 (with the `stableTypeOrdering` flag on, and without any `ignoreDeprecations` flag set) should compile identically in TypeScript 7.0."
- **Behavior changes:** template-literal inference keeps Unicode code points whole (utilities that modeled UTF-16 units break); JavaScript and JSDoc checking was reworked (values cannot be used as types, so write `typeof`; `@enum`, `@class`, a standalone `?` type, postfix `!` and Closure function types are unsupported). Observed on 7.0.2: `experimentalDecorators` with `emitDecoratorMetadata` still emits `design:paramtypes`, and `target: es2015` with `async` and decorators emits down-leveled output.
- **No API in 7.0** ("it does not ship with an API"). Observed: `require("typescript")` exposes two keys (`version`, `versionMajorMinor`) where 5.9.3 and 6.0.3 expose about 2,250; the package's only API-like exports are `unstable/*` subpaths.
- **Language server:** standard LSP, not the tsserver protocol, started with `tsc --lsp --stdio` (observed: a headless client got `initialize`, hover and diagnostics answers). VS Code uses the `TypeScriptTeam.native-preview` extension, with built-in support to follow; Visual Studio enables it per workspace. Vue, MDX, Astro and Svelte editor tooling should stay on 6.0 for now; Angular uses 7.0 for `tsc` and 6.0 for the editor.
- **Side by side with 6.0:** `@typescript/typescript6` provides `tsc6` and re-exports the 6.0 API. The announcement's aliasing, which keeps `require("typescript")` on 6.0 for tools that need the API:

  ```json
  {
    "devDependencies": {
      "typescript": "npm:@typescript/typescript6@^6.0.2",
      "@typescript/native": "npm:typescript@^7.0.2"
    }
  }
  ```

  Observed with `typescript-eslint@8.72.1` and ESLint 10 added: `npm install` had no peer conflict, `tsc --version` printed 7.0.2, `tsc6 --version` printed 6.0.3, and `require("typescript").version` was 6.0.3.

## 7.1 beta (2026-10-20)

From the announcement and the 7.1.0-beta package. A new API under `typescript/sync`, `typescript/async`, `typescript/fs` and `typescript/ast` (7.0.2 has the same files under `unstable/*`); content mappers so editors can check Vue, Svelte, Astro, MDX, CSS Modules and Ember files (`contentMappers` in tsconfig, `--runExternalCode` to allow them to run); stable `--target es2026` and `--lib es2026`; import attributes in ambient module declarations; `import source`; new `esnext` library methods (`Promise.allKeyed`, `Promise.allSettledKeyed`, `Iterator.zip`, `Iterator.zipKeyed`, `Iterator.prototype.chunks`, `join`, `includes`); a stricter distributive-conditional-type check; DOM type updates that can add errors. Install with `typescript@beta`. The post does not mention typescript-eslint.

## Packages and repositories

- `typescript` is the native compiler since 7.0; `@typescript/typescript6` (6.0.2) is the 6.0 API plus `tsc6`; `@typescript/native-preview` (the old `tsgo` previews) has `latest` at 7.0.0-dev.20260707.2, and nightlies now ship as `typescript@next`.
- microsoft/typescript-go is closed and archived ("the staging repo for the TypeScript 7.0 release ... now completed"); development continues in microsoft/TypeScript.

## Tooling status

| Tool | Status on 2026-11-07 |
|---|---|
| typescript-eslint 8.72.1 | peer range `typescript >=4.8.4 <6.1.0`. A maintainer wrote on 2026-07-08 (issue 12518) that it "isn't compatible with TS 7 at this time, because there is no TS 7 API" and to run it on TS 6; the tracking issue 10940 is open |
| typescript-language-server 6.0.3 | needs Node `>=22.22.2` and drives `tsserver`. Observed with 6.0.2: workspace TypeScript 5.9.3 works; a workspace with TypeScript 7.0.2 and a server-side 5.9.3 logs "provides no tsserver" and falls back to the bundled 5.9.3; a server whose own TypeScript is 7.0.2 returns no capabilities and empty hovers (why `scripts/lsp.js` pins 5.9.3) |
| Zod 4.6.7, Valibot 1.5.0, ArkType 2.2.9 | all accepted as `StandardSchemaV1` (`@standard-schema/spec` 1.1.0) by tsc 5.9.3, 6.0.3 and 7.0.2 |
| Vitest 5.1.0, tsx 4.23.15, Biome 2.6.6, oxlint 1.92.0, `@arethetypeswrong/cli` 0.18.5, publint 0.3.25, `@typescript/analyze-trace` 0.11.1 | latest versions on npm; compatibility with TypeScript 7 not checked |
| Node type stripping | Node 26.8.2: `process.features.typescript` is `strip`, `--no-strip-types` exists, and a file with an `enum` fails with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` |
| NestJS 12 | `@nestjs/schematics` 12 needs TypeScript 6 (see the nestjs skill's versions.md) |

## What this means for a project today (derived from the above)

- A project on 5.9 or 6 is fine; keep its pin. The tools around it decide when 7 is usable: anything that imports the compiler API stays on a 6.x copy (the alias above) until it supports TypeScript 7's API (7.1 beta ships the first one).
- 7 is already a safe, much faster `tsc --noEmit` for code that is clean on 6.0, if lint, tests and the editor do not depend on it for the API.
- Write `strict`, `types`, `rootDir`, `module` and `target` explicitly so one tsconfig reads the same on 5.9, 6 and 7.
- Re-check this page before advising an upgrade: 7.1 (RC and final) was due within weeks of 2026-10-20.
