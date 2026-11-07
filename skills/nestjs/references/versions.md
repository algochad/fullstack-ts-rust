# NestJS versions: what changed

Verified against the official v11 and v12 migration guides on 2026-11-07 (latest `@nestjs/core` was 12.4.0). When the project's version is older than the code you are about to write, check here first. Run `nest upgrade --dry-run` to preview a v12 upgrade.

## Before 11 (baseline)

Express 4, wildcard routes written `*`, `forRoutes('*')`, Node 16 or 18 supported, termination hooks in the same order as init hooks.

## 11

- **Node 20+ required** (16 and 18 dropped).
- **Express 5 is the default platform.** A bare `*` wildcard in a route or in `forRoutes('*')` is **automatically converted** to a valid Express 5 route in Nest 11, so old code usually still runs, but the guide says the syntax is no longer advisable: write named wildcards (`@Get('users/*splat')`, `forRoutes('{*splat}')`). The optional `?` character in paths is no longer supported (use braces), and regexp characters are not supported.
- **Query parsing:** Express 5 uses the "simple" parser, with no nested objects or arrays. Restore the old behavior with `app.set('query parser', 'extended')` on a `NestExpressApplication`.
- **Lifecycle:** termination hooks (`OnModuleDestroy`, `BeforeApplicationShutdown`, `OnApplicationShutdown`) now run in the reverse order of their init counterparts. Global modules are treated as a dependency of every other module. Middleware registered in global modules runs first.
- **Fastify 5:** only CORS-safelisted methods are allowed by default (list others in `methods`); the `(.*)` match-all syntax is gone, use `*splat`.
- **`Reflector`:** `getAllAndOverride` returns `T | undefined`; `getAllAndMerge` returns an object (not a one-element array) when there is a single object-typed metadata entry; the type argument of `ReflectableDecorator` is inferred correctly.
- **Cache manager:** the old `store` option is gone. Use Keyv stores (`stores: [new KeyvRedis('redis://localhost:6379')]` from `@keyv/redis`). Cached values are stored as `{ value, expires }`, so code that reads cache entries directly, or reads entries written by an older version, must account for that.
- **Dynamic modules:** Nest no longer generates predictable hashes for them. To share one dynamic module between several importers, assign it to a variable and import that variable.
- **`@nestjs/config` 4:** the module's internal configuration takes precedence over environment variables. `ignoreEnvVars` is deprecated in favor of `validatePredefined`, and `skipProcessEnv` blocks `process.env` access.
- **Terminus:** `HealthIndicator` and `HealthCheckError` are deprecated (removed in 12).

## 12

- **Runtime:** Node 20.19+ or 22.12+ (21 unsupported). Generating or upgrading with the CLI needs Node 22.22.3+, 24.15+ or 26+. `@nestjs/schematics` 12 needs TypeScript 6. Older `ts-jest` or `typescript-eslint` pins can block install: `npm update ts-jest typescript-eslint`.
- **All core packages ship as ESM.** CommonJS apps keep working through `require(esm)`. `nest new` asks for CommonJS or ESM; ESM defaults to Vitest, CommonJS to Jest, new projects use oxlint. **Jest loads ESM-only v12 packages only on Node 24.9+**; older Node fails with `ERR_REQUIRE_ASYNC_MODULE`. AWS Lambda CommonJS apps need `NODE_OPTIONS=--experimental-require-module`.
- **Going ESM yourself** (optional): `"type": "module"`, `nodenext` module resolution, `.js` extensions on relative imports, `import.meta.dirname` instead of `__dirname`, `createRequire` instead of `require`. Fix all imports in one pass.
- **Validation:** `ValidationPipe` and `ClassSerializerInterceptor` remain. New: Standard Schema support (Zod, Valibot, ArkType) through a `schema` option on `@Body()`, `@Query()`, `@Param()`, `@RawBody()`, plus `StandardSchemaValidationPipe` and `StandardSchemaSerializerInterceptor`; `ValidationPipe` option `errorFormat: 'list' | 'grouped'`.
- **ConfigModule:** `validationSchema` takes any Standard Schema schema. Joi still works but needs Joi 18+. Library-specific options move to `validationOptions.libraryOptions`.
- **Lifecycle:** hooks run by component hierarchy level, so the order of `onModuleInit`, `onApplicationBootstrap` and the shutdown hooks can change. Review init, teardown and tests that depend on order. The Express adapter drains in-flight requests on shutdown.
- **`@Optional()` inheritance:** a subclass with its own constructor no longer inherits the parent's `@Optional()` markers; Nest throws `UnknownDependenciesException` where 11 injected `undefined`. Redeclare the marker in the subclass constructor. (12.1+ keeps the parent's markers for a subclass with no constructor of its own; 12.0.x did not.)
- **Terminus:** the legacy `HealthIndicator` API is removed, and throwing `HealthCheckError` no longer reports unhealthy. Use `HealthIndicatorService`: `check(key)` then `up()`, `down()` or `attempt()`, with `.withTimeout()`. The `timeout` option on the database, microservice and gRPC indicators is deprecated.
- **Errors and logging:** `HttpExceptionOptions.errorCode` is serialized into the response body. `ConsoleLogger` attaches plain-object params to the same entry (nested under `params` in JSON mode, or spread with `flattenParams`); `structuredParams: false` restores the old behavior.
- **Route diagnostics (opt-in):** `routeConflictPolicy` and `routeResolutionStrategy: 'specificity'` on `NestApplicationOptions`.
- **GraphQL:** GraphiQL is the default IDE; `subscriptions-transport-ws` is removed (use `graphql-ws`).
- **NATS:** `nats` is replaced by `@nats-io/transport-node`; the string and JSON codecs are removed.
- **CLI:** `--webpack` is deprecated in favor of `--builder rspack` (the monorepo default); `bun` is a supported package manager; `nest deploy` and `@nestjs/observe` (opt-in) are new.
- **Other:** custom pipes may need type fixes (`ArgumentMetadata` is generic); gRPC exceptions map to gRPC status codes; request-scoped WebSocket gateways are supported.
