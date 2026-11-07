# TypeScript review checklist

Rewritten for this plugin from the typescript-reviewer agent and TypeScript rules in affaan-m/ECC (MIT), the review checklists in the typescript-expert skills of remix-run/remix (MIT) and sickn33/agentic-awesome-skills (MIT), and the official TypeScript docs. Use it with `/agents-kit:code-review`: flag only what you can show is wrong, not preferences. Security findings follow the `security-audit` skill.

## Scope first
- [ ] The project's typecheck ran (or was read) on the tsconfig that covers the changed files, not just the root one; in a project-references repo, the repo's own script (`tsc -b`).
- [ ] If tsconfig, lint config or the TypeScript version changed in the diff: does it weaken strictness, drop a flag, or bump the major? Call it out explicitly.

## Type safety
- [ ] No new `any`, explicit or leaked in from `JSON.parse`, `res.json()` or an untyped dependency; `unknown` plus narrowing or a schema instead.
- [ ] No `as` that bypasses a check (`as unknown as T`, casts to an unrelated type, casts on external data); a needed cast sits next to the proof.
- [ ] No `!` without a nearby invariant; no `// @ts-ignore` (use `@ts-expect-error` with a reason); no `@ts-nocheck` in new code.
- [ ] Variants are discriminated unions and `switch`es over them are exhaustive, so a new variant breaks the build, not production.
- [ ] Exported functions and public methods have explicit return types; no `Function`, `Object`, `{}` or boxed primitives.
- [ ] Type predicates and assertion functions are exactly true, and are not standing in for a schema on external data.
- [ ] Generics relate at least two positions, are constrained only for what the body uses, and infer at call sites; no mapped or conditional type where an interface would do; a non-trivial type utility has a type test.
- [ ] No new `enum` (or a justified string enum); no `const enum`; optional (`a?:`) and `| undefined` are used deliberately; `null` only where the data source uses it.

## Trust boundaries
- [ ] Each new input path (HTTP, env, storage, JSON, IPC or Tauri `invoke`, queue, third-party API) is parsed with the project's schema library, and its type is derived from the schema.
- [ ] `process.env` is read in one validated config module; the parsed value is used, not the raw input; nothing is validated twice inside the boundary.
- [ ] No hand-copied interface restates a schema or an API contract that can be shared or generated.

## Errors and async
- [ ] No empty `catch`; the `catch` variable is narrowed from `unknown`; only `Error`s are thrown, with `cause` kept; expected failures follow the project's one style (result type or exceptions), not both.
- [ ] No floating promises, no `async` callback passed to `forEach`, no `await` in a loop over independent work; fan-out over large inputs is bounded; `Promise.all` vs `allSettled` is a deliberate choice.
- [ ] Cancellable work accepts and forwards an `AbortSignal`; waits are bounded (`AbortSignal.timeout`); React effects abort in cleanup.
- [ ] `JSON.parse`, `new URL` and `Number()` on user input handle failure.

## Modules and packages
- [ ] `import type` for types; no new import cycle; no deep import into another package's internals; a new barrel is justified.
- [ ] Relative import extensions match the module setting; no `require` in ESM without a reason.
- [ ] A changed `exports` map keeps `types` first, has a `.d.cts` for each `.cjs`, and still passes `attw` and `publint`.
- [ ] No hand-written `.d.ts` for the project's own code; ambient and augmentation files are minimal and covered by `include`.
- [ ] A path alias exists for the bundler or runtime as well as for `tsc`.

## tsconfig and tooling
- [ ] New code passes under the project's strictness flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) without per-file escapes.
- [ ] No deprecated option introduced (`baseUrl`, `moduleResolution: node`, `target: es5`); `strict`, `types`, `rootDir`, `module` and `target` are written explicitly.
- [ ] `skipLibCheck` is not hiding an error in the project's own declarations; lint rules are not disabled to pass (`eslint-disable` and `biome-ignore` carry a reason).
- [ ] New dependencies ship types (or have `@types/*`) and fit the project's Node and TypeScript range.

## Tests
- [ ] New behavior is tested through the public interface; type-level code has a type test; mocks are typed rather than `any`.
- [ ] Test files are inside some tsconfig, so the typecheck covers them.

## Versions
- [ ] The code fits the project's TypeScript version and module system: no 6 or 7 assumption in a 5.9 project, and no tool that needs the compiler API moved to TypeScript 7 (versions.md).
- [ ] No TypeScript major upgrade slipped into an unrelated change.
