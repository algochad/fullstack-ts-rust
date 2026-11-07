# TypeScript patterns

Rewritten for this plugin from the TypeScript handbook and tsconfig reference, the typescript-expert skill in remix-run/remix (MIT), the TypeScript reviewer and rules in affaan-m/ECC (MIT), typescript-expert in sickn33/agentic-awesome-skills (MIT), typescript-advanced-types in wshobson/agents (MIT), typescript-pro in Jeffallan/claude-skills (MIT) and setup-ts-deep-modules in mattpocock/skills (MIT); the code was written fresh. Every TypeScript block except the Vitest type test, and every tsconfig recipe, was compiled with tsc 5.9.3, 6.0.3 and 7.0.2 (Zod 4.6.7, Valibot 1.5.0, ArkType 2.2.9); the `package.json` examples were not run through `attw`.

## Discriminated unions and exhaustiveness

```ts
type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "failed"; error: Error };

function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

function label<T>(state: Load<T>): string {
  switch (state.status) {
    case "idle": return "Not started";
    case "loading": return "Loading";
    case "ready": return "Done";
    case "failed": return state.error.message;
    default: return assertNever(state);
  }
}
```

Adding a fifth variant turns `assertNever(state)` into a compile error, and the throw covers data that lies about its type. The lint rule `@typescript-eslint/switch-exhaustiveness-check` gives the same guarantee without the `default` branch. Use a literal discriminant (`status`, `kind`, `type`), never a boolean pair.

## Narrowing and type predicates

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasMessage(value: unknown): value is { message: string } {
  return isRecord(value) && typeof value["message"] === "string";
}

const names: (string | undefined)[] = ["a", undefined];
const defined: string[] = names.filter((name) => name !== undefined); // inferred predicate, no guard to write
```

A predicate is a promise the compiler cannot check: a wrong one is a lie that spreads. Keep them tiny and exactly true, and for data from outside the process use a schema instead.

## Branded types

```ts
declare const brand: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type UserId = Brand<string, "UserId">;
export type OrderId = Brand<string, "OrderId">;

export function parseUserId(raw: string): UserId {
  if (!/^usr_[a-z0-9]{12}$/.test(raw)) throw new Error(`Invalid user id: ${raw}`);
  return raw as UserId; // the one cast, next to the check that proves it
}

declare function ordersOf(user: UserId): OrderId[];
ordersOf(parseUserId("usr_abcdefghijkl"));
// ordersOf("usr_abcdefghijkl"); // error: string is not assignable to UserId
```

The brand costs nothing at runtime and exists only in the types, so mint it in exactly one function. With a schema library the parse step is the constructor:

```ts
import * as v from "valibot";
import { z } from "zod";

const ZodUserId = z.string().regex(/^usr_[a-z0-9]{12}$/).brand<"UserId">();
type ZodUserId = z.infer<typeof ZodUserId>;

const ValibotUserId = v.pipe(v.string(), v.regex(/^usr_[a-z0-9]{12}$/), v.brand("UserId"));
type ValibotUserId = v.InferOutput<typeof ValibotUserId>;
```

## `satisfies`, `as const` and derived types

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} as const satisfies Record<string, `/${string}`>;

type RouteName = keyof typeof routes; // "home" | "user"
type RoutePath = (typeof routes)[RouteName]; // "/" | "/users/:id"

const levels = ["debug", "info", "warn", "error"] as const;
type Level = (typeof levels)[number];

export const Role = { Admin: "admin", Member: "member" } as const;
export type Role = (typeof Role)[keyof typeof Role]; // the enum replacement: value and type share a name
export const allRoles = Object.values(Role);
```

`satisfies` rejects a typo in a key or value without widening the literal to `string`. The `as const` object replaces an `enum`, stays erasable, and works with Node's type stripping.

## Generics: few, related, inferred

```ts
// K relates the keys argument to the result, so the type parameter earns its place.
function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = source[key];
  return out;
}

// NoInfer keeps `fallback` from widening T: 3 is an error here, not T = string | number.
function firstOr<T>(items: readonly T[], fallback: NoInfer<T>): T {
  return items[0] ?? fallback;
}
firstOr(["a", "b"], "c");
```

A type parameter used once is just `unknown` in disguise. Constrain it (`extends`) only for what the body uses, and don't ask callers to write `<...>` when inference works. Reach for mapped and conditional types only when a plain interface or a built-in utility cannot say it, and put a type test next to them.

## Validating at the trust boundary (Standard Schema)

Zod, Valibot and ArkType all implement [Standard Schema](https://standardschema.dev) (`@standard-schema/spec` 1.1.0), so one small helper parses with whichever the project uses:

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type } from "arktype";
import * as v from "valibot";
import { z } from "zod";

export class ValidationError extends Error {
  readonly issues: readonly StandardSchemaV1.Issue[];
  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(issues.map((issue) => issue.message).join("; "));
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** Parse unknown input with any Standard Schema library; the result type comes from the schema. */
export async function parse<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
): Promise<StandardSchemaV1.InferOutput<S>> {
  const result = await schema["~standard"].validate(input);
  if (result.issues) throw new ValidationError(result.issues);
  return result.value;
}

declare const input: unknown;
const a = await parse(z.object({ id: z.string() }), input); // { id: string }
const b = await parse(v.object({ id: v.string() }), input); // { id: string }
const c = await parse(type({ id: "string" }), input); // { id: string }
```

At a boundary, derive the type from the schema and parse once at the edge:

```ts
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
});
export type Env = z.infer<typeof Env>;
export const env: Env = Env.parse(process.env); // once, at startup; the rest of the code imports `env`

const User = z.object({ id: z.string(), email: z.email() });

export async function getUser(id: string) {
  const res = await fetch(`https://api.example.com/users/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GET user failed: ${res.status}`);
  return User.parse(await res.json()); // res.json() is any; the schema makes it a User or throws
}
```

Keep one schema module per boundary (config, each external API, storage). A schema that transforms (coerce, defaults, trimming) returns the output type, so use the parsed value and discard the raw input.

## Errors and results

```ts
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

type PortError = { code: "empty" | "not_a_port"; input: string };

function parsePort(input: string): Result<number, PortError> {
  if (input.trim() === "") return err({ code: "empty", input });
  const port = Number(input);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return err({ code: "not_a_port", input });
  return ok(port);
}

const parsed = parsePort(process.argv[2] ?? "");
if (!parsed.ok) console.error(parsed.error.code);
else listen(parsed.value);
```

```ts
export type AppErrorCode = "not_found" | "conflict" | "forbidden";

export class AppError extends Error {
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function sync(): Promise<void> {
  try {
    await work();
  } catch (cause) {
    throw new AppError("conflict", "Could not sync", { cause }); // keep the original as `cause`
  }
}
```

The class assigns its field in the constructor body (not a parameter property) so it stays valid under `erasableSyntaxOnly`. A result type is for failures the caller is expected to handle; an exception is for the unexpected. If the project already uses a Result library or throws plus a filter, follow that and do not add this helper.

## Async: cancellation, fan-out and fire-and-forget

```ts
async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(10_000);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// At most `limit` calls in flight; workers pull from one shared iterator.
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = items.entries();
  async function worker(): Promise<void> {
    for (const [index, item] of queue) results[index] = await fn(item);
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Every outcome, not just the first failure.
const settled = await Promise.allSettled(["a", "b"].map((id) => load(id)));
const loaded = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
const failed = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

// Deliberate fire-and-forget: say so, and never lose the error.
void work().catch((error: unknown) => logger.error({ error }, "work failed"));
```

`mapLimit` rejects on the first failure but the other workers keep draining the queue; if that matters, pass an `AbortSignal` into `fn` and stop on abort, or use the project's `p-limit`. `Promise.all` never cancels the other promises. In a function that takes a signal, call `signal.throwIfAborted()` between steps of a long loop.

## tsconfig recipes

Strictness lives in one base file; each package extends it and sets only the module options for how its code runs. Adapt, don't paste.

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

A bundled app (Vite, React, a Tauri frontend):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

A Node service that `tsc` compiles (package.json has `"type": "module"`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "types": ["node"],
    "erasableSyntaxOnly": true,
    "rewriteRelativeImportExtensions": true,
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src"]
}
```

Drop `erasableSyntaxOnly` for code that uses parameter properties, which includes most Nest constructors, and add what Nest needs (`experimentalDecorators`, `emitDecoratorMetadata`; see the `agents-kit:nestjs` skill).

A published library (add `declaration` and check your own `.d.ts`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "dist",
    "skipLibCheck": false,
    "types": []
  },
  "include": ["src"]
}
```

Project references: a solution file at the root, `composite` in each package, and the dependency listed in `references`. Build and check with `tsc -b`.

```json
{ "files": [], "references": [{ "path": "./packages/core" }, { "path": "./packages/web" }] }
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/.tsbuildinfo",
    "types": []
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

Migrating JavaScript: start permissive, then remove one opt-out per change.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "strict": true,
    "strictNullChecks": false,
    "strictPropertyInitialization": false,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "types": []
  },
  "include": ["src"]
}
```

(`exactOptionalPropertyTypes` needs `strictNullChecks`, so don't extend the strict base file until the opt-outs are gone.)

## `package.json` exports

An ESM-only package. In every entry, `types` comes first, because resolution takes the first condition that matches:

```json
{
  "name": "@acme/core",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./testing": { "types": "./dist/testing.d.ts", "default": "./dist/testing.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist"]
}
```

A dual package needs a declaration file per format (`.d.ts` for ESM, `.d.cts` for CJS):

```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

One compilation checks only one of the two outputs, so test both: run `attw --pack .` (`@arethetypeswrong/cli`) and `publint` before release. With `exports` present, `main` and `types` are only fallbacks for old resolvers. Prefer ESM-only for a new library when its consumers' Node versions can load ESM from CommonJS.

## Declaration files and augmentation

```ts
// types/untyped-lib.d.ts: no top-level import or export, so this is an ambient declaration
declare module "untyped-lib" {
  export function parse(input: string): unknown;
}
```

```ts
// types/express.d.ts: a top-level import makes this a module, so `declare module` augments the real one
import type { User } from "../src/users.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}
```

```ts
// types/globals.d.ts
declare global {
  interface Window {
    __APP_CONFIG__?: { apiUrl: string };
  }
}
export {};
```

Make sure the tsconfig `include` covers the `types/` folder. Augment interfaces only (type aliases cannot merge) and keep the surface to what you use; for `process.env`, parse it with a schema rather than augmenting `ProcessEnv`.

## Module boundaries

A `src/packages/<name>/` layout with entry-point files at the package root and implementation in subfolders keeps modules deep: callers import the entry point, never `lib/`. Enforce it with a tool (dependency-cruiser rules, or an ESLint boundaries rule) so the convention survives, and forbid import cycles the same way. Prefer several small entry points over one barrel that re-exports everything.

## Type tests

```ts
// pick.test-d.ts: Vitest runs `*.test-d.ts` files when its `typecheck` option is enabled
import { expectTypeOf, test } from "vitest";
import { pick } from "./pick.js";

test("pick keeps only the chosen keys", () => {
  expectTypeOf(pick({ a: 1, b: "x" }, ["a"])).toEqualTypeOf<{ a: number }>();
});
```

Write type tests for generic helpers, public library types and anything with conditional or mapped types. Application code rarely needs them.
