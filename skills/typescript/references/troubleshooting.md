# TypeScript troubleshooting

Rewritten for this plugin from the TypeScript release notes and tsconfig reference, from local reproductions with tsc 5.9.3, 6.0.3 and 7.0.2 on 2026-11-07 (the messages below are copied from those runs), and from the recurring failures catalogued in the community TypeScript skills named in patterns.md. Reproduce first (the `systematic-debugging` skill), then use this to find where to look.

## First: which compiler and which config?

Most "it works on my machine" TypeScript bugs are a different compiler or a different tsconfig. Check `npx --no-install tsc --version`, then `tsc -p <config> --showConfig` for the config that covers the failing file. The editor uses the nearest `tsconfig.json`; a file that no `include` covers is checked with default options instead (looser than the project's). The editor's language server in this plugin is TypeScript 5.9.3, so in a 6 or 7 project `tsc` is the truth.

## After upgrading to 6 or 7

- **`TS2591: Cannot find name 'process'. Do you need to install type definitions for node?`** (also `describe`, `expect`, `__dirname`): `types` now defaults to `[]`, so `@types/*` are no longer loaded automatically. Add them: `"types": ["node"]` (plus `"vitest/globals"`, `"vite/client"` as used). `"types": ["*"]` restores the old behavior.
- **A flood of `TS2322` and `TS7006` (`Parameter 'x' implicitly has an 'any' type`) in code that compiled before:** `strict` is now on by default. Fix the code, or set `"strict": false` explicitly as a short, tracked bridge; don't delete the config's strict flags.
- **Build output moved from `dist/` to `dist/src/`:** `rootDir` now defaults to the folder holding `tsconfig.json`. Set `"rootDir": "src"`.
- **`TS5101: Option 'baseUrl' is deprecated`, `TS5107: Option 'moduleResolution=node10' is deprecated` or `'target=ES5'` (6.0.3):** migrate the option (`paths` with explicit prefixes instead of `baseUrl`; `nodenext` or `bundler` instead of `node10`; `ES2015` or newer instead of `ES5`). `"ignoreDeprecations": "6.0"` silences them on 6.0 only, as a bridge.
- **`TS5102: Option 'baseUrl' has been removed` and `TS5108: ... has been removed` (7.0.2):** the same options, now hard errors that `ignoreDeprecations` does not silence. Migrate them on 6.0 first.
- **`TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline`:** a script (lint-staged, a pre-commit hook) runs `tsc some/file.ts`. Use `tsc -p tsconfig.json`, or pass `--ignoreConfig` when you really want the file alone.
- **`npm install` fails on a peer conflict, or ESLint crashes inside `@typescript-eslint/typescript-estree`, after installing TypeScript 7:** typescript-eslint 8.72.1 allows `typescript >=4.8.4 <6.1.0` and needs the compiler API, which 7.0 does not ship. Keep a 6.x copy under the `typescript` name and put 7 under another name (the alias in versions.md); verified to install cleanly with ESLint 10.
- **ts-node, ts-jest or another tool that calls the compiler API fails when it loads `typescript` on 7:** `require("typescript")` has no API there, since it only has `version` and `versionMajorMinor` in 7.0.2. Same fix: give the tool a 6.x `typescript` (alias), or switch to a runner that does not need the API (`tsx`, Node's type stripping, Vitest).
- **Generic calls that compiled on 5.9 now ask for type arguments (6.0):** function expressions in generic calls are checked more strictly. Add the explicit type argument at the call.
- **Compare 6 and 7 behavior:** `tsc --stableTypeOrdering` on 6.0 makes type ordering match 7.0 (up to 25% slower; a diagnostic aid, not a setting to keep).

## The editor shows nothing, or something different from `tsc`

- **Hover, completions and diagnostics are empty (typescript-language-server):** the server drives `tsserver`, and TypeScript 7 does not ship one. Observed with server 6.0.2: when the server's own TypeScript was 7.0.2, `initialize` returned no capabilities. The plugin avoids this by installing `typescript@5.9.3` beside the server; if you changed that install, put a 5.x or 6.x back. A workspace that has TypeScript 7 in `node_modules` only produces the message "The TypeScript of the workspace ... provides no tsserver", then the server falls back to its own 5.9.3.
- **The server will not start:** `typescript-language-server` 6.x declares Node `>=22.22.2`.
- **For a TypeScript 7 project, TypeScript's own server is `tsc --lsp --stdio`** (an editor setting, not something to install globally). Its observed answers on 7.0.2 were correct for hover and diagnostics.
- **Squiggles in the editor that `tsc` does not report, or the reverse:** different TypeScript versions (5.9.3 editor vs the project's), a file outside every `include`, or the editor using the root tsconfig while CI uses `tsconfig.build.json`. Restart the TS server after changing the version or `extends` chain.

## Module and import errors

- **`TS2835: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './b.js'?`:** under `nodenext` an ESM relative import names the emitted file. Write `./b.js`, or write `./b.ts` and set `rewriteRelativeImportExtensions`.
- **`TS1295: ECMAScript imports and exports cannot be written in a CommonJS file under 'verbatimModuleSyntax'` and `TS1287: A top-level 'export' modifier cannot be used on value declarations in a CommonJS module`:** with `module: nodenext` a package without `"type": "module"` is CommonJS. Add `"type": "module"` (or `.mts`), or pick module settings that match how the code runs.
- **`TS7016: Could not find a declaration file for module 'x'`:** the dependency ships no types. Install `@types/x` if it exists; otherwise add `declare module "x";` (or a typed `declare module "x" { ... }`) in a `.d.ts` that has no top-level import or export, and make sure `include` covers it.
- **`TS2307: Cannot find module 'x' or its corresponding type declarations`:** the file or package really is not there, `moduleResolution` does not match how the package is built (`exports` is only read under `node16`, `nodenext` and `bundler`), the package's `exports` has no `types` entry, or a path alias exists for `tsc` but not at runtime. `tsc --traceResolution` shows every lookup.
- **An alias (`@/x`) compiles but fails at runtime with "Cannot find module":** `paths` only affects type-checking. Configure the same alias in the bundler, or use package.json `imports` (`#/x`).
- **`TS1272: A type referenced in a decorated signature must be imported with 'import type' or a namespace import when 'isolatedModules' and 'emitDecoratorMetadata' are enabled`:** an interface or type alias used as a decorated constructor or method parameter type was imported with a regular import. Use `import type` for it. A class used for dependency injection must stay a real import: observed with `import type`, the emitted `design:paramtypes` holds `Function` instead of the class, so Nest reports "Nest can't resolve dependencies" (the nestjs skill's troubleshooting lists that error's other causes).
- **`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript enum is not supported in strip-only mode` (Node running a `.ts` file):** Node only erases types. Replace the `enum` with a literal union or an `as const` object, and turn on `erasableSyntaxOnly` so `tsc` catches it first. Parameter properties and runtime namespaces fail the same way.
- **`TS6059: File ... is not under 'rootDir'`:** a file outside `rootDir` is included, usually a test or config file picked up by `include`. Move it to a separate tsconfig, or widen `rootDir`.

## Type errors that confuse

- **`TS2769` mentioning `exactOptionalPropertyTypes: true` (for example `fetch(url, { signal })` where `signal` is optional):** an optional property no longer accepts an explicit `undefined`. Pass what the library allows (`{ signal: signal ?? null }`), build the object conditionally, or declare your own field `signal?: AbortSignal | undefined`. This friction is why the flag is "on when you model optionals carefully".
- **`'x' is possibly 'undefined'` on `arr[i]` or `record[key]`:** `noUncheckedIndexedAccess` doing its job. Narrow it (`const item = arr[i]; if (item === undefined) ...`), use `for...of` or `.at()` plus a check, or destructure with a default. Don't sprinkle `!`.
- **`Property 'x' does not exist on type 'never'`:** the compiler decided every variant was already handled, so the value is `never` here. Either the earlier checks really cover all cases (good, in a `default` branch), or the discriminant is typed too loosely (`string` instead of a literal) or the checks use a property the union members do not share.
- **A value is `any` and you did not write `any`:** `JSON.parse()`, `await res.json()`, an untyped dependency (`TS7016` with `noImplicitAny` off), `catch` with `useUnknownInCatchVariables` off, `Object.assign` and some library callbacks. Assign to `unknown` and parse it (patterns.md).
- **`TS2742`: The inferred type of 'x' cannot be named without a reference to '...'. This is likely not portable. A type annotation is necessary** (also "exceeds the maximum length the compiler will serialize"): declaration emit needs a nameable type. Add an explicit return type or export the type it points to.
- **`Object.keys(obj)` is `string[]` and `obj[key]` fails:** by design, because objects may have extra keys. Iterate with `Object.entries`, or build one typed helper (`keysOf`) that carries the single, commented cast.

## Performance and limits

- **`TS2589: Type instantiation is excessively deep and possibly infinite` or `TS2590: Expression produces a union type that is too complex to represent`:** a recursive conditional or mapped type, a very large union, or a generic that re-instantiates itself. Add an explicit type annotation at the call that blows up, bound the recursion with a depth counter, or replace the clever type with a plain interface. Do not raise limits with `any`.
- **`tsc` takes minutes:** `tsc --extendedDiagnostics` first. Then `--generateTrace trace` and `@typescript/analyze-trace` for the file and type that dominate, `--explainFiles` for an unexpectedly large program (a `node_modules` package or `dist` pulled in by `include`), and project references plus `incremental` for monorepos. TypeScript 7 is the large lever when the tooling allows it (versions.md).
- **Editor lag in one file:** usually the same type that slows `tsc`; look at its generic constraints and return type.

## Project references and monorepos

- **`TS6306: Referenced project '...' must have setting "composite": true`:** add `composite` to the referenced tsconfig.
- **`TS6305: Output file '...' has not been built from source file '...'`:** the referenced project has not been built. Use `tsc -b` (it builds dependencies first) instead of `tsc -p`.
- **`TS6307: File '...' is not listed within the file list of project '...'. Projects must list all files or use an 'include' pattern`:** a composite project imported a file its `include` does not cover. Widen `include`, or import through the package instead of its path.
- **`tsc --noEmit` at the root reports nothing and the packages are broken:** the solution file has `"files": []`, so nothing is checked there. Run `tsc -b` or the repo's typecheck script (observed: with a type error planted in a package, `tsc --noEmit` on the solution file exits 0 and `tsc -b` reports `TS2322`).
- **Different packages report different errors for shared code:** more than one TypeScript version in the workspace, or a package that does not extend the shared base tsconfig.
